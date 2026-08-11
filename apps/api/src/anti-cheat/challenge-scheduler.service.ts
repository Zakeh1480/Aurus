import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { getAntiCheatConfig } from './anti-cheat.constants';
import { NonceService } from './nonce.service';
import { TrustScoreService } from './trust-score.service';

const DUE_ZSET_KEY = 'ac:challenge-schedule:due';

const POLL_BATCH_SIZE = 50;

function scheduleKey(matchId: string, userId: string): string {
  return `ac:match:${matchId}:user:${userId}:challenge-schedule`;
}

function scheduleMember(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}

function splitMember(member: string): [matchId: string, userId: string] {
  const [matchId, userId] = member.split(':') as [string, string];
  return [matchId, userId];
}

const CREATE_SCHEDULE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('HSET', KEYS[1], 'targetCount', ARGV[1], 'issuedSoFar', '0', 'sessionStartedAt', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[3])
return 1
`;

const CLAIM_AND_ADVANCE_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[2], ARGV[1])
if score == false then
  return {0}
end
if tonumber(score) > tonumber(ARGV[2]) then
  return {0}
end
redis.call('ZREM', KEYS[2], ARGV[1])
local issuedSoFar = tonumber(redis.call('HGET', KEYS[1], 'issuedSoFar'))
local targetCount = tonumber(redis.call('HGET', KEYS[1], 'targetCount'))
local sessionStartedAt = redis.call('HGET', KEYS[1], 'sessionStartedAt')
local newIssuedSoFar = issuedSoFar + 1
if newIssuedSoFar >= targetCount then
  redis.call('DEL', KEYS[1])
  return {1, sessionStartedAt, 1}
end
redis.call('HSET', KEYS[1], 'issuedSoFar', newIssuedSoFar)
return {1, sessionStartedAt, 0}
`;

@Injectable()
export class ChallengeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChallengeSchedulerService.name);
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly nonceService: NonceService,
    private readonly trustScoreService: TrustScoreService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      this.pollDueChallenges().catch((error: unknown) => {
        this.logger.error('Falha ao varrer desafios de anti-cheat vencidos', error);
      });
    }, getAntiCheatConfig().challengePollIntervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.pollTimer);
  }

  ensureScheduledForMatch(matchId: string, player1Id: string, player2Id: string): void {
    for (const userId of [player1Id, player2Id]) {
      this.createSchedule(matchId, userId).catch((error: unknown) => {
        this.logger.error(`Falha ao agendar desafios para match ${matchId}, user ${userId}`, error);
      });
    }
  }

  private async createSchedule(matchId: string, userId: string): Promise<void> {
    const config = getAntiCheatConfig();
    const targetCount =
      config.challengesMin +
      Math.floor(Math.random() * (config.challengesMax - config.challengesMin + 1));
    const sessionStartedAt = Date.now();
    const delay =
      config.challengeIntervalMinMs +
      Math.random() * (config.challengeIntervalMaxMs - config.challengeIntervalMinMs);
    if (delay > config.maxSessionMs) return;

    await this.redis.eval(
      CREATE_SCHEDULE_SCRIPT,
      2,
      scheduleKey(matchId, userId),
      DUE_ZSET_KEY,
      targetCount,
      sessionStartedAt,
      scheduleMember(matchId, userId),
      sessionStartedAt + delay,
    );
  }

  async pollDueChallenges(): Promise<void> {
    const now = Date.now();
    for (;;) {
      const dueMembers = await this.redis.zrangebyscore(
        DUE_ZSET_KEY,
        '-inf',
        now,
        'LIMIT',
        0,
        POLL_BATCH_SIZE,
      );
      for (const member of dueMembers) {
        await this.claimAndFire(member, now).catch((error: unknown) => {
          this.logger.error(`Falha ao processar desafio vencido (${member})`, error);
        });
      }
      if (dueMembers.length < POLL_BATCH_SIZE) return;
    }
  }

  private async claimAndFire(member: string, now: number): Promise<void> {
    const [matchId, userId] = splitMember(member);
    const result = (await this.redis.eval(
      CLAIM_AND_ADVANCE_SCRIPT,
      2,
      scheduleKey(matchId, userId),
      DUE_ZSET_KEY,
      member,
      now,
    )) as [number, string?, number?];
    if (result[0] !== 1) return;

    const sessionStartedAt = Number(result[1]);
    const isLast = result[2] === 1;

    await this.fireChallenge(matchId, userId).catch((error: unknown) => {
      this.logger.error(`Falha ao emitir desafio para match ${matchId}, user ${userId}`, error);
    });

    if (!isLast) {
      await this.scheduleNextFire(matchId, userId, sessionStartedAt).catch((error: unknown) => {
        this.logger.error(
          `Falha ao reagendar próximo desafio para match ${matchId}, user ${userId}`,
          error,
        );
      });
    }
  }

  private async scheduleNextFire(
    matchId: string,
    userId: string,
    sessionStartedAt: number,
  ): Promise<void> {
    const config = getAntiCheatConfig();
    const delay =
      config.challengeIntervalMinMs +
      Math.random() * (config.challengeIntervalMaxMs - config.challengeIntervalMinMs);
    const nextDueAtMs = Date.now() + delay;
    if (nextDueAtMs - sessionStartedAt > config.maxSessionMs) {
      await this.redis.del(scheduleKey(matchId, userId));
      return;
    }
    await this.redis.zadd(DUE_ZSET_KEY, nextDueAtMs, scheduleMember(matchId, userId));
  }

  private async fireChallenge(matchId: string, userId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== 'active') return;

    const config = getAntiCheatConfig();
    const challengeId = randomUUID();
    const nonce = randomBytes(16).toString('base64url');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + config.challengeTtlMs);

    await this.nonceService.issueChallengeNonce(
      matchId,
      userId,
      challengeId,
      nonce,
      config.challengeTtlMs,
    );
    await this.trustScoreService.recordChallengeIssued(matchId, userId);

    this.matchmakingService.emitToUser(userId, 'match:verify-challenge', {
      matchId,
      userId,
      challengeId,
      challengeType: 'snapshot',
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }
}
