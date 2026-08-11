import type { WsEventPayload } from '@aurafarming/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AiScoreClientService } from './ai-score-client.service';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { getScoringConfig } from './scoring.constants';

const DUE_ZSET_KEY = 'score:tick:due';

const POLL_BATCH_SIZE = 50;

const CLAIM_TICK_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if score == false then
  return 0
end
if tonumber(score) > tonumber(ARGV[2]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
return 1
`;

@Injectable()
export class ScoreTickSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScoreTickSchedulerService.name);
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly sampleBuffer: ScoreSampleBufferService,
    private readonly aiScoreClient: AiScoreClientService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      this.pollDueTicks().catch((error: unknown) => {
        this.logger.error('Falha ao varrer ticks de score vencidos', error);
      });
    }, getScoringConfig().tickPollIntervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.pollTimer);
  }

  ensureScheduledForMatch(matchId: string): void {
    const dueAtMs = Date.now() + getScoringConfig().tickIntervalMs;
    this.redis.zadd(DUE_ZSET_KEY, 'NX', dueAtMs, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao agendar tick de score para match ${matchId}`, error);
    });
  }

  cancel(matchId: string): void {
    this.redis.zrem(DUE_ZSET_KEY, matchId).catch((error: unknown) => {
      this.logger.error(`Falha ao cancelar tick de score para match ${matchId}`, error);
    });
  }

  async pollDueTicks(): Promise<void> {
    const now = Date.now();
    const nextDueAtMs = now + getScoringConfig().tickIntervalMs;
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
        const claimed = (await this.redis.eval(
          CLAIM_TICK_SCRIPT,
          1,
          DUE_ZSET_KEY,
          matchId,
          now,
          nextDueAtMs,
        )) as number;
        if (claimed !== 1) continue;
        await this.tick(matchId).catch((error: unknown) => {
          this.logger.error(`Falha ao processar tick de score para match ${matchId}`, error);
        });
      }
      if (dueMatchIds.length < POLL_BATCH_SIZE) return;
    }
  }

  private async tick(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== 'active') {
      this.cancel(matchId);
      return;
    }

    const [features1, features2] = await Promise.all([
      this.sampleBuffer.readLatest(matchId, match.player1Id),
      this.sampleBuffer.readLatest(matchId, match.player2Id),
    ]);

    if (!features1 || !features2) return;

    const [score1, score2] = await Promise.all([
      this.aiScoreClient.score(features1),
      this.aiScoreClient.score(features2),
    ]);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        featuresPlayer1: features1,
        featuresPlayer2: features2,
        scorePlayer1: score1,
        scorePlayer2: score2,
      },
    });

    const payload: WsEventPayload<'match:score-tick'> = {
      matchId,
      tickAt: new Date().toISOString(),
      scores: [
        { userId: match.player1Id, liveScore: score1.overall },
        { userId: match.player2Id, liveScore: score2.overall },
      ],
    };
    this.matchmakingService.emitToUser(match.player1Id, 'match:score-tick', payload);
    this.matchmakingService.emitToUser(match.player2Id, 'match:score-tick', payload);
  }
}
