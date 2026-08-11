import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getAntiCheatConfig } from './anti-cheat.constants';

@Injectable()
export class NonceService {
  constructor(private readonly redis: RedisService) {}

  async consumeFeatureNonce(matchId: string, userId: string, nonce: string): Promise<boolean> {
    const { featureNonceWindowMs } = getAntiCheatConfig();
    const result = await this.redis.set(
      this.featureKey(matchId, userId, nonce),
      '1',
      'PX',
      featureNonceWindowMs,
      'NX',
    );
    return result === 'OK';
  }

  async issueChallengeNonce(
    matchId: string,
    userId: string,
    challengeId: string,
    nonce: string,
    ttlMs: number,
  ): Promise<void> {
    await this.redis.set(this.challengeKey(matchId, userId, challengeId), nonce, 'PX', ttlMs, 'NX');
  }

  async consumeChallengeNonce(
    matchId: string,
    userId: string,
    challengeId: string,
    nonce: string,
  ): Promise<boolean> {
    const key = this.challengeKey(matchId, userId, challengeId);
    const stored = await this.redis.get(key);
    if (stored === null || stored !== nonce) return false;
    await this.redis.del(key);
    return true;
  }

  private featureKey(matchId: string, userId: string, nonce: string): string {
    return `ac:match:${matchId}:user:${userId}:fnonce:${nonce}`;
  }

  private challengeKey(matchId: string, userId: string, challengeId: string): string {
    return `ac:match:${matchId}:user:${userId}:challenge:${challengeId}`;
  }
}
