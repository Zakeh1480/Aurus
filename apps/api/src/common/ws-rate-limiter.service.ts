import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class WsRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    const redisKey = `ws-rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }
    return count <= limit;
  }
}
