import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getAntiCheatConfig } from './anti-cheat.constants';

@Injectable()
export class SessionSecretService {
  constructor(private readonly redis: RedisService) {}

  async issue(matchId: string, userId: string): Promise<{ secret: string; expiresAt: Date }> {
    const { sessionSecretTtlSeconds } = getAntiCheatConfig();
    const key = this.key(matchId, userId);
    const candidate = randomBytes(32).toString('base64url');
    const created = await this.redis.set(key, candidate, 'EX', sessionSecretTtlSeconds, 'NX');
    const secret = created === 'OK' ? candidate : ((await this.redis.get(key)) ?? candidate);
    const ttl = await this.redis.ttl(key);
    return { secret, expiresAt: new Date(Date.now() + Math.max(ttl, 0) * 1000) };
  }

  get(matchId: string, userId: string): Promise<string | null> {
    return this.redis.get(this.key(matchId, userId));
  }

  private key(matchId: string, userId: string): string {
    return `ac:match:${matchId}:user:${userId}:secret`;
  }
}
