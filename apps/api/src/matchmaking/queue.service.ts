import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getGuardTtlMs } from './matchmaking.constants';

const ZSET_KEY = 'mm:queue:zset';
const JOINED_KEY = 'mm:queue:joined';

function guardKey(userId: string): string {
  return `mm:user:${userId}:guard`;
}

const CLAIM_PAIR_SCRIPT = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) and redis.call('ZSCORE', KEYS[1], ARGV[2]) then
  redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
  return 1
end
return 0
`;

@Injectable()
export class QueueService {
  constructor(private readonly redis: RedisService) {}

  async claimGuard(userId: string): Promise<boolean> {
    const result = await this.redis.set(guardKey(userId), '1', 'PX', getGuardTtlMs(), 'NX');
    return result === 'OK';
  }

  async releaseGuard(userId: string): Promise<void> {
    await this.redis.del(guardKey(userId));
  }

  async addToQueue(userId: string, rating: number, now: number): Promise<void> {
    await this.redis.zadd(ZSET_KEY, rating, userId);
    await this.redis.hsetnx(JOINED_KEY, userId, String(now));
  }

  async leaveQueue(userId: string): Promise<void> {
    await this.redis.zrem(ZSET_KEY, userId);
    await this.redis.hdel(JOINED_KEY, userId);
    await this.releaseGuard(userId);
  }

  async getJoinedAt(userId: string): Promise<number | null> {
    const value = await this.redis.hget(JOINED_KEY, userId);
    return value === null ? null : Number(value);
  }

  async clearWaitClock(userId: string): Promise<void> {
    await this.redis.hdel(JOINED_KEY, userId);
  }

  async findCandidates(
    selfRating: number,
    maxWindow: number,
  ): Promise<{ userId: string; rating: number }[]> {
    const raw = await this.redis.zrangebyscore(
      ZSET_KEY,
      selfRating - maxWindow,
      selfRating + maxWindow,
      'WITHSCORES',
    );
    const candidates: { userId: string; rating: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const userId = raw[i];
      const rating = raw[i + 1];
      if (userId !== undefined && rating !== undefined) {
        candidates.push({ userId, rating: Number(rating) });
      }
    }
    return candidates;
  }

  async claimPair(selfId: string, candidateId: string): Promise<boolean> {
    const result = await this.redis.eval(CLAIM_PAIR_SCRIPT, 1, ZSET_KEY, selfId, candidateId);
    return result === 1;
  }
}
