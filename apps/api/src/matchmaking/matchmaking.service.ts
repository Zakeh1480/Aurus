import type { WsEventName, WsEventPayload } from '@aurafarming/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getAcceptPollIntervalMs, getRatingWindowConfig } from './matchmaking.constants';
import { type QueueMember, selectBestCandidate } from './pairing';
import { PendingMatchService } from './pending-match.service';
import { QueueService } from './queue.service';

/** Teto por chamada de `PendingMatchService.pollExpired` — `pollExpiredPendingMatches` drena em loop até vir menos que isso. */
const POLL_BATCH_SIZE = 50;

/** Room individual por usuário — join no handshake (ver MatchmakingIoAdapter), único canal de emissão. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Orquestra fila, pareamento e aceite-com-timeout. Emite eventos via
 * `Server.to(userRoom(...))` em vez de guardar referências diretas de
 * `Socket` — com o adapter Redis do Socket.IO (Prompt 17), isso alcança o
 * usuário mesmo que o socket dele esteja conectado em outra réplica da API.
 *
 * Estado de partidas pendentes (`PendingMatchService`, Prompt 19) vive em
 * Redis, não em memória — um `accept` ou uma desconexão podem chegar em
 * qualquer réplica e ainda assim encontrar/resolver a partida pendente
 * corretamente. O timeout de aceite não é mais um `setTimeout` local: é um
 * poller (`pollExpiredPendingMatches`, iniciado em `onModuleInit`) que varre
 * o ZSET de expiração compartilhado a cada `getAcceptPollIntervalMs()` — a
 * réplica que "vence" a corrida de reivindicar um matchId vencido é quem
 * processa o cancelamento; as demais recebem `not_found` e não fazem nada.
 */
@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);
  private server?: Server;
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly queueService: QueueService,
    private readonly pendingMatchService: PendingMatchService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      this.pollExpiredPendingMatches().catch((error: unknown) => {
        this.logger.error('Falha ao varrer partidas pendentes vencidas', error);
      });
    }, getAcceptPollIntervalMs());
  }

  onModuleDestroy(): void {
    clearInterval(this.pollTimer);
  }

  /**
   * Chamado uma única vez por `MatchmakingIoAdapter.createIOServer`, no
   * bootstrap — mesmo padrão do middleware de autenticação (Prompt 16):
   * garantia estrutural do adapter, não efeito colateral de qual gateway o
   * Nest instancia primeiro.
   */
  setServer(server: Server): void {
    this.server = server;
  }

  async join(userId: string): Promise<void> {
    const guardClaimed = await this.queueService.claimGuard(userId);
    if (!guardClaimed) {
      throw new WsException('Usuário já está na fila ou em uma partida pendente.');
    }

    const openMatch = await this.prisma.match.findFirst({
      where: {
        status: { in: ['pending', 'active'] },
        OR: [{ player1Id: userId }, { player2Id: userId }],
      },
    });
    if (openMatch) {
      await this.queueService.releaseGuard(userId);
      throw new WsException('Usuário já está em uma partida em andamento.');
    }

    const profile = await this.usersService.getProfile(userId);
    const now = Date.now();
    await this.queueService.addToQueue(userId, profile.rating, now);
    await this.tryPairFrom(userId, profile.rating, now);
  }

  async leave(userId: string): Promise<void> {
    const matchId = await this.pendingMatchService.getPendingMatchId(userId);
    if (matchId) {
      await this.cancelPendingMatch(matchId, userId);
      return;
    }
    await this.queueService.leaveQueue(userId);
  }

  async accept(userId: string, matchId: string): Promise<void> {
    const result = await this.pendingMatchService.accept(matchId, userId);
    if (result.status === 'not_found') {
      throw new WsException('Partida não encontrada ou já expirada.');
    }
    if (result.status === 'waiting') {
      return;
    }

    const { player1Id, player2Id } = result;
    await Promise.all([
      this.queueService.releaseGuard(player1Id),
      this.queueService.releaseGuard(player2Id),
      this.queueService.clearWaitClock(player1Id),
      this.queueService.clearWaitClock(player2Id),
    ]);

    const startedAt = new Date();
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'active', startedAt },
    });

    const payload: WsEventPayload<'match:start'> = {
      matchId,
      player1Id,
      player2Id,
      startedAt: startedAt.toISOString(),
    };
    this.emitTo(player1Id, 'match:start', payload);
    this.emitTo(player2Id, 'match:start', payload);
  }

  /**
   * Idêntico a `leave` desde que o registro direto de sockets saiu daqui
   * (Prompt 17, Redis adapter) — mantido como método próprio porque o
   * gateway o chama a partir de um hook de lifecycle diferente
   * (`OnGatewayDisconnect`), não de uma mensagem `queue:leave`.
   */
  async handleDisconnect(userId: string): Promise<void> {
    await this.leave(userId);
  }

  /**
   * Chamado pelo webhook do LiveKit quando um participante sai da room de uma
   * partida em andamento. Idempotente (no-op se a partida já não está `active`)
   * — não reaproveita `cancelPendingMatch` porque essa lida com estado de
   * pareamento pendente que não existe mais após o match virar `active`.
   */
  async endActiveMatch(matchId: string, reason: 'disconnected' | 'cancelled'): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== 'active') {
      return;
    }

    const endedAt = new Date();
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'cancelled', endedAt },
    });

    const endedAtIso = endedAt.toISOString();
    this.emitTo(match.player1Id, 'match:end', { matchId, endedAt: endedAtIso, reason });
    this.emitTo(match.player2Id, 'match:end', { matchId, endedAt: endedAtIso, reason });
  }

  private async tryPairFrom(selfId: string, selfRating: number, now: number): Promise<void> {
    const config = getRatingWindowConfig();
    const rawCandidates = await this.queueService.findCandidates(selfRating, config.max);
    const selfJoinedAt = (await this.queueService.getJoinedAt(selfId)) ?? now;
    const self: QueueMember = { userId: selfId, rating: selfRating, waitMs: now - selfJoinedAt };

    let remaining: QueueMember[] = await Promise.all(
      rawCandidates
        .filter((candidate) => candidate.userId !== selfId)
        .map(async (candidate) => {
          const joinedAt = (await this.queueService.getJoinedAt(candidate.userId)) ?? now;
          return { userId: candidate.userId, rating: candidate.rating, waitMs: now - joinedAt };
        }),
    );

    for (;;) {
      const best = selectBestCandidate(self, remaining, config);
      if (!best) return;

      const claimed = await this.queueService.claimPair(selfId, best.userId);
      if (claimed) {
        await this.finalizePairing(best, self);
        return;
      }
      remaining = remaining.filter((candidate) => candidate.userId !== best.userId);
    }
  }

  /** `waitingMember` já estava na fila (vira player1); `joiningMember` disparou este pareamento (vira player2). */
  private async finalizePairing(
    waitingMember: QueueMember,
    joiningMember: QueueMember,
  ): Promise<void> {
    const player1Id = waitingMember.userId;
    const player2Id = joiningMember.userId;

    const match = await this.prisma.$transaction(async (tx) => {
      const created = await tx.match.create({ data: { player1Id, player2Id, status: 'pending' } });
      await tx.matchParticipant.createMany({
        data: [
          {
            matchId: created.id,
            userId: player1Id,
            side: 'player1',
            ratingBefore: waitingMember.rating,
            ratingAfter: null,
          },
          {
            matchId: created.id,
            userId: player2Id,
            side: 'player2',
            ratingBefore: joiningMember.rating,
            ratingAfter: null,
          },
        ],
      });
      return created;
    });

    await this.pendingMatchService.create(match.id, player1Id, player2Id);

    const matchedAt = match.createdAt.toISOString();
    this.emitTo(player1Id, 'queue:matched', {
      matchId: match.id,
      opponentId: player2Id,
      queueStatus: 'matched',
      matchedAt,
    });
    this.emitTo(player2Id, 'queue:matched', {
      matchId: match.id,
      opponentId: player1Id,
      queueStatus: 'matched',
      matchedAt,
    });
  }

  /**
   * Varre o ZSET de expiração cross-instance e reivindica cada matchId vencido — chamada
   * periodicamente pelo poller de `onModuleInit`, mas exposta como método público porque é
   * análoga a um hook de lifecycle (testes chamam diretamente, sem depender de timers reais).
   * Drena em loop dentro do próprio tick (em vez de processar só uma página por intervalo) para
   * não deixar backlog crescer se, por algum motivo, mais candidatos vencerem do que o teto de
   * uma única chamada de `pollExpired`.
   */
  async pollExpiredPendingMatches(): Promise<void> {
    const now = Date.now();
    for (;;) {
      const dueMatchIds = await this.pendingMatchService.pollExpired(now, POLL_BATCH_SIZE);
      for (const matchId of dueMatchIds) {
        await this.cancelPendingMatch(matchId).catch((error: unknown) => {
          this.logger.error(`Falha ao cancelar partida pendente ${matchId} por timeout`, error);
        });
      }
      if (dueMatchIds.length < POLL_BATCH_SIZE) {
        return;
      }
    }
  }

  /** Compartilhado pelo poller de timeout e pela desconexão — idempotente (no-op se já finalizado). */
  private async cancelPendingMatch(matchId: string, forcedNonAcceptUserId?: string): Promise<void> {
    const result = await this.pendingMatchService.claimAndCancel(matchId);
    if (result.status === 'not_found') return;

    const { player1Id, player2Id, acceptedUserIds } = result;

    const endedAt = new Date();
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'cancelled', endedAt },
    });

    const endedAtIso = endedAt.toISOString();
    this.emitTo(player1Id, 'match:end', {
      matchId,
      endedAt: endedAtIso,
      reason: 'cancelled',
    });
    this.emitTo(player2Id, 'match:end', {
      matchId,
      endedAt: endedAtIso,
      reason: 'cancelled',
    });

    for (const userId of [player1Id, player2Id]) {
      if (acceptedUserIds.includes(userId) && userId !== forcedNonAcceptUserId) {
        const now = Date.now();
        const profile = await this.usersService.getProfile(userId);
        await this.queueService.addToQueue(userId, profile.rating, now);
        await this.tryPairFrom(userId, profile.rating, now);
      } else {
        await this.queueService.leaveQueue(userId);
      }
    }
  }

  private emitTo<E extends WsEventName>(
    userId: string,
    event: E,
    payload: WsEventPayload<E>,
  ): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  /**
   * Exposto para o AntiCheatModule emitir eventos server->client fora do
   * fluxo de matchmaking (ex.: match:verify-challenge) — mesmo padrão de
   * endActiveMatch já exportado para o LivekitModule.
   */
  emitToUser<E extends WsEventName>(userId: string, event: E, payload: WsEventPayload<E>): void {
    this.emitTo(userId, event, payload);
  }

  /**
   * Chamado pelo ModerationModule (Prompt 13) logo após um ban ser aplicado —
   * desconexão nativa do Socket.IO (não é um WsEventSchemas validado); a
   * próxima chamada REST/refresh do usuário já rejeita via activeBanWhere().
   * `disconnectSockets` (via a room do usuário) alcança o socket mesmo que
   * ele esteja conectado em outra réplica da API — no-op se não houver
   * nenhum socket vivo na room.
   */
  disconnectUser(userId: string): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}
