import { MATCH_DURATION_SECONDS } from '@aurafarming/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { ScoringService } from '../scoring/scoring.service';
import { getMatchDurationPollIntervalMs } from './livekit.constants';
import { LivekitService } from './livekit.service';

const DUE_ZSET_KEY = 'lk:match-duration:expiry';

const POLL_BATCH_SIZE = 50;

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

  scheduleForMatch(matchId: string, startedAt: Date): void {
    const dueAtMs = startedAt.getTime() + MATCH_DURATION_SECONDS * 1000;
    this.redis.zadd(DUE_ZSET_KEY, 'NX', dueAtMs, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao agendar encerramento por tempo da partida ${matchId}`, error);
    });
  }

  cancel(matchId: string): void {
    this.redis.zrem(DUE_ZSET_KEY, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao cancelar encerramento por tempo da partida ${matchId}`, error);
    });
  }

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
