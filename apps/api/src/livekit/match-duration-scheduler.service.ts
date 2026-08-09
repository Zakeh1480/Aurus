import { MATCH_DURATION_SECONDS } from '@aurafarming/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { ScoringService } from '../scoring/scoring.service';
import { getMatchDurationPollIntervalMs } from './livekit.constants';
import { LivekitService } from './livekit.service';

/** ZSET compartilhado entre réplicas — score = instante (epoch ms) em que a partida deve ser forçada a terminar. */
const DUE_ZSET_KEY = 'lk:match-duration:expiry';

/** Teto por chamada de ZRANGEBYSCORE — pollDueMatches drena em loop até vir menos que isso (mesmo padrão de MatchmakingService.pollExpiredPendingMatches). */
const POLL_BATCH_SIZE = 50;

/**
 * Força o fim de uma partida MATCH_DURATION_SECONDS após Match.startedAt,
 * mesmo que os dois participantes continuem conectados na room do LiveKit.
 * Vive em LivekitModule (não ScoringModule) porque precisa de
 * LivekitService.deleteRoom — mesma dupla finalizeMatch + deleteRoom que
 * LivekitWebhookController já faz para o encerramento por participant_left,
 * só que disparada por tempo em vez de webhook. finalizeMatch é idempotente
 * (no-op se a partida não está mais "active"), então uma corrida entre este
 * timer e o webhook nunca finaliza a partida duas vezes.
 *
 * Estado mora em Redis (Prompt 20), não em Map local — mesma classe de
 * correção do Prompt 19 (PendingMatchService), mas sem script Lua: ao
 * contrário do aceite-com-timeout do matchmaking, aqui não há sub-estado
 * mutável por partida (nada como os flags de aceite de dois jogadores), só
 * um único timestamp de vencimento por matchId. Um ZADD NX (agendar,
 * idempotente) + um ZREM (cancelar/reivindicar) já bastam: ZREM é atômico
 * por si só no Redis (comando único, servidor single-threaded), então seu
 * valor de retorno (0 ou 1) já serve como sinal de quem venceu a corrida —
 * entre o poller de uma réplica e outra, ou entre o poller e um cancel()
 * concorrente do webhook.
 */
@Injectable()
export class MatchDurationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchDurationSchedulerService.name);
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly redis: RedisService,
    private readonly scoringService: ScoringService,
    private readonly livekit: LivekitService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      this.pollDueMatches().catch((error: unknown) => {
        this.logger.error('Falha ao varrer partidas com tempo esgotado', error);
      });
    }, getMatchDurationPollIntervalMs());
  }

  onModuleDestroy(): void {
    clearInterval(this.pollTimer);
  }

  /**
   * Idempotente — chamado toda vez que um participante pede o token do
   * LiveKit (até 2x por partida, uma por jogador). `startedAt` vem do
   * Prisma (carimbado uma única vez em MatchmakingService.accept), então o
   * prazo é calculado a partir do início real da partida, não do momento em
   * que este método é chamado. NX garante que a segunda chamada não
   * sobrescreve o score já agendado pela primeira.
   */
  scheduleForMatch(matchId: string, startedAt: Date): void {
    const dueAtMs = startedAt.getTime() + MATCH_DURATION_SECONDS * 1000;
    this.redis.zadd(DUE_ZSET_KEY, 'NX', dueAtMs, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao agendar encerramento por tempo da partida ${matchId}`, error);
    });
  }

  /** Chamado pelo webhook quando a partida já terminou por outro caminho (participant_left). */
  cancel(matchId: string): void {
    this.redis.zrem(DUE_ZSET_KEY, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao cancelar encerramento por tempo da partida ${matchId}`, error);
    });
  }

  /**
   * Varre o ZSET cross-instance achando matchIds vencidos e reivindica cada
   * um via ZREM — seu retorno (0 ou 1) já é o sinal atômico de quem venceu
   * a corrida (outra réplica no mesmo poll, ou um cancel() concorrente do
   * webhook): só quem recebe 1 dispara fire(). Chamado periodicamente pelo
   * poller de onModuleInit, mas exposto como método público porque testes
   * chamam direto, sem depender de timers reais (mesmo padrão de
   * MatchmakingService.pollExpiredPendingMatches).
   */
  async pollDueMatches(): Promise<void> {
    const now = Date.now();
    for (;;) {
      const dueMatchIds = await this.redis.zrangebyscore(
        DUE_ZSET_KEY,
        '-inf',
        now,
        'LIMIT',
        0,
        POLL_BATCH_SIZE,
      );
      for (const matchId of dueMatchIds) {
        const claimed = await this.redis.zrem(DUE_ZSET_KEY, matchId);
        if (claimed !== 1) continue;
        await this.fire(matchId).catch((error: unknown) => {
          this.logger.error(`Falha ao forçar fim por tempo da partida ${matchId}`, error);
        });
      }
      if (dueMatchIds.length < POLL_BATCH_SIZE) return;
    }
  }

  private async fire(matchId: string): Promise<void> {
    await this.scoringService.finalizeMatch(matchId);
    await this.livekit.deleteRoom(matchId);
  }
}
