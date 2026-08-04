import type { WsEventName, WsEventPayload } from "@aurafarming/shared";
import { Injectable, Logger } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { getAcceptTimeoutMs, getRatingWindowConfig } from "./matchmaking.constants";
import { type QueueMember, selectBestCandidate } from "./pairing";
import { QueueService } from "./queue.service";

interface PendingMatchState {
  player1Id: string;
  player2Id: string;
  accepted: Set<string>;
  timer: NodeJS.Timeout;
}

/**
 * Orquestra fila, pareamento e aceite-com-timeout. Dono único do registro
 * de sockets vivos: o timeout de aceite dispara de forma assíncrona
 * (setTimeout), fora do ciclo de qualquer mensagem que o gateway esteja
 * tratando, então precisa da sua própria forma de emitir eventos.
 *
 * Estado de partidas pendentes vive em memória (Map) — limitação assumida
 * de deploy single-instance; múltiplas instâncias exigiriam mover isso
 * para Redis/uma fila de jobs, fora de escopo agora.
 */
@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly sockets = new Map<string, Socket>();
  private readonly pendingMatches = new Map<string, PendingMatchState>();
  private readonly pendingMatchByUser = new Map<string, string>();

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  registerSocket(userId: string, socket: Socket): void {
    this.sockets.set(userId, socket);
  }

  async join(userId: string): Promise<void> {
    const guardClaimed = await this.queueService.claimGuard(userId);
    if (!guardClaimed) {
      throw new WsException("Usuário já está na fila ou em uma partida pendente.");
    }

    const openMatch = await this.prisma.match.findFirst({
      where: { status: { in: ["pending", "active"] }, OR: [{ player1Id: userId }, { player2Id: userId }] },
    });
    if (openMatch) {
      await this.queueService.releaseGuard(userId);
      throw new WsException("Usuário já está em uma partida em andamento.");
    }

    const profile = await this.usersService.getProfile(userId);
    const now = Date.now();
    await this.queueService.addToQueue(userId, profile.rating, now);
    await this.tryPairFrom(userId, profile.rating, now);
  }

  async leave(userId: string): Promise<void> {
    const matchId = this.pendingMatchByUser.get(userId);
    if (matchId) {
      await this.cancelPendingMatch(matchId, userId);
      return;
    }
    await this.queueService.leaveQueue(userId);
  }

  async accept(userId: string, matchId: string): Promise<void> {
    const expectedMatchId = this.pendingMatchByUser.get(userId);
    const state = expectedMatchId ? this.pendingMatches.get(expectedMatchId) : undefined;
    if (expectedMatchId !== matchId || !state) {
      throw new WsException("Partida não encontrada ou já expirada.");
    }

    state.accepted.add(userId);
    if (state.accepted.size < 2) {
      return;
    }

    clearTimeout(state.timer);
    this.pendingMatches.delete(matchId);
    this.pendingMatchByUser.delete(state.player1Id);
    this.pendingMatchByUser.delete(state.player2Id);

    await Promise.all([
      this.queueService.releaseGuard(state.player1Id),
      this.queueService.releaseGuard(state.player2Id),
      this.queueService.clearWaitClock(state.player1Id),
      this.queueService.clearWaitClock(state.player2Id),
    ]);

    const startedAt = new Date();
    await this.prisma.match.update({ where: { id: matchId }, data: { status: "active", startedAt } });

    const payload: WsEventPayload<"match:start"> = {
      matchId,
      player1Id: state.player1Id,
      player2Id: state.player2Id,
      startedAt: startedAt.toISOString(),
    };
    this.emitTo(state.player1Id, "match:start", payload);
    this.emitTo(state.player2Id, "match:start", payload);
  }

  async handleDisconnect(userId: string): Promise<void> {
    this.sockets.delete(userId);
    const matchId = this.pendingMatchByUser.get(userId);
    if (matchId) {
      await this.cancelPendingMatch(matchId, userId);
      return;
    }
    await this.queueService.leaveQueue(userId);
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
  private async finalizePairing(waitingMember: QueueMember, joiningMember: QueueMember): Promise<void> {
    const player1Id = waitingMember.userId;
    const player2Id = joiningMember.userId;

    const match = await this.prisma.$transaction(async (tx) => {
      const created = await tx.match.create({ data: { player1Id, player2Id, status: "pending" } });
      await tx.matchParticipant.createMany({
        data: [
          {
            matchId: created.id,
            userId: player1Id,
            side: "player1",
            ratingBefore: waitingMember.rating,
            ratingAfter: null,
          },
          {
            matchId: created.id,
            userId: player2Id,
            side: "player2",
            ratingBefore: joiningMember.rating,
            ratingAfter: null,
          },
        ],
      });
      return created;
    });

    const timer = setTimeout(() => {
      this.cancelPendingMatch(match.id).catch((error: unknown) => {
        this.logger.error(`Falha ao cancelar partida pendente ${match.id} por timeout`, error);
      });
    }, getAcceptTimeoutMs());

    const state: PendingMatchState = { player1Id, player2Id, accepted: new Set(), timer };
    this.pendingMatches.set(match.id, state);
    this.pendingMatchByUser.set(player1Id, match.id);
    this.pendingMatchByUser.set(player2Id, match.id);

    const matchedAt = match.createdAt.toISOString();
    this.emitTo(player1Id, "queue:matched", {
      matchId: match.id,
      opponentId: player2Id,
      queueStatus: "matched",
      matchedAt,
    });
    this.emitTo(player2Id, "queue:matched", {
      matchId: match.id,
      opponentId: player1Id,
      queueStatus: "matched",
      matchedAt,
    });
  }

  /** Compartilhado pelo timeout de aceite e pela desconexão — idempotente (no-op se já finalizado). */
  private async cancelPendingMatch(matchId: string, forcedNonAcceptUserId?: string): Promise<void> {
    const state = this.pendingMatches.get(matchId);
    if (!state) return;

    clearTimeout(state.timer);
    this.pendingMatches.delete(matchId);
    this.pendingMatchByUser.delete(state.player1Id);
    this.pendingMatchByUser.delete(state.player2Id);

    const endedAt = new Date();
    await this.prisma.match.update({ where: { id: matchId }, data: { status: "cancelled", endedAt } });

    const endedAtIso = endedAt.toISOString();
    this.emitTo(state.player1Id, "match:end", { matchId, endedAt: endedAtIso, reason: "cancelled" });
    this.emitTo(state.player2Id, "match:end", { matchId, endedAt: endedAtIso, reason: "cancelled" });

    for (const userId of [state.player1Id, state.player2Id]) {
      if (state.accepted.has(userId) && userId !== forcedNonAcceptUserId) {
        const now = Date.now();
        const profile = await this.usersService.getProfile(userId);
        await this.queueService.addToQueue(userId, profile.rating, now);
        await this.tryPairFrom(userId, profile.rating, now);
      } else {
        await this.queueService.leaveQueue(userId);
      }
    }
  }

  private emitTo<E extends WsEventName>(userId: string, event: E, payload: WsEventPayload<E>): void {
    this.sockets.get(userId)?.emit(event, payload);
  }
}
