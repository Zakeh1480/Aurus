import type { AuraFeatures } from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";
import { getAntiCheatConfig } from "./anti-cheat.constants";
import { checkTemporalContinuity, type TemporalCheckResult } from "./temporal-plausibility";

@Injectable()
export class FeatureBufferService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Compara com a última amostra guardada e devolve se houve violação de
   * continuidade física — janela O(1) (só a amostra anterior), sem histórico
   * multi-amostra.
   */
  async pushAndCheck(matchId: string, userId: string, features: AuraFeatures): Promise<TemporalCheckResult> {
    const config = getAntiCheatConfig();
    const key = this.key(matchId, userId);
    const prevRaw = await this.redis.get(key);
    await this.redis.set(key, JSON.stringify(features), "EX", config.statsTtlSeconds);

    if (!prevRaw) {
      return { violated: false };
    }
    const prev = JSON.parse(prevRaw) as AuraFeatures;
    return checkTemporalContinuity(prev, features, config);
  }

  private key(matchId: string, userId: string): string {
    return `ac:match:${matchId}:user:${userId}:last-features`;
  }
}
