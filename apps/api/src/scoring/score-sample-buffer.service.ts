import type { AuraFeatures } from '@aurafarming/shared';
import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getScoringConfig } from './scoring.constants';

@Injectable()
export class ScoreSampleBufferService {
  constructor(private readonly redis: RedisService) {}

  async pushSample(matchId: string, userId: string, features: AuraFeatures): Promise<void> {
    const config = getScoringConfig();
    const serialized = JSON.stringify(features);

    await this.redis.set(
      this.latestKey(matchId, userId),
      serialized,
      'EX',
      config.sampleBufferTtlSeconds,
    );

    const listKey = this.samplesKey(matchId, userId);
    await this.redis.rpush(listKey, serialized);
    await this.redis.ltrim(listKey, -config.sampleBufferMaxLength, -1);
    await this.redis.expire(listKey, config.sampleBufferTtlSeconds);
  }

  async readLatest(matchId: string, userId: string): Promise<AuraFeatures | null> {
    const raw = await this.redis.get(this.latestKey(matchId, userId));
    return raw ? (JSON.parse(raw) as AuraFeatures) : null;
  }

  async readSamples(matchId: string, userId: string): Promise<AuraFeatures[]> {
    const raw = await this.redis.lrange(this.samplesKey(matchId, userId), 0, -1);
    return raw.map((entry) => JSON.parse(entry) as AuraFeatures);
  }

  private latestKey(matchId: string, userId: string): string {
    return `score:match:${matchId}:user:${userId}:latest`;
  }

  private samplesKey(matchId: string, userId: string): string {
    return `score:match:${matchId}:user:${userId}:samples`;
  }
}
