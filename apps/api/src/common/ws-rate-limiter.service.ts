import { Injectable } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";

/**
 * Rate limiting de janela fixa para eventos WS — @nestjs/throttler cobre só
 * HTTP, não gateways Socket.IO (Prompt 13). Reusa o Redis já usado pelo
 * anti-cheat (nonce.service.ts) em vez de trazer uma dependência nova.
 */
@Injectable()
export class WsRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  /** true = dentro do limite (segue); false = estourou (handler deve dropar/ignorar). */
  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    const redisKey = `ws-rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }
    return count <= limit;
  }
}
