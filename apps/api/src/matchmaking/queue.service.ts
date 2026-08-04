import { Injectable } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";
import { getGuardTtlMs } from "./matchmaking.constants";

const ZSET_KEY = "mm:queue:zset";
const JOINED_KEY = "mm:queue:joined";

function guardKey(userId: string): string {
  return `mm:user:${userId}:guard`;
}

/**
 * Script Lua: só remove os dois membros do ZSET se AMBOS ainda estiverem
 * presentes — fecha a corrida entre dois `queue:join` quase simultâneos
 * tentando parear o mesmo par usando a serialização single-thread do Redis,
 * sem precisar de um lock distribuído.
 */
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

  /** Fast-path de idempotência: true se conseguiu reivindicar (usuário livre), false se já estava marcado. */
  async claimGuard(userId: string): Promise<boolean> {
    const result = await this.redis.set(guardKey(userId), "1", "PX", getGuardTtlMs(), "NX");
    return result === "OK";
  }

  async releaseGuard(userId: string): Promise<void> {
    await this.redis.del(guardKey(userId));
  }

  /** Adiciona ao ZSET e marca o relógio de espera só se ainda não existir (preserva espera acumulada em requeue). */
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

  /** Zera só o relógio de espera (usado quando ambos aceitam — ZSET/guard já foram tratados à parte). */
  async clearWaitClock(userId: string): Promise<void> {
    await this.redis.hdel(JOINED_KEY, userId);
  }

  /** Candidatos dentro do teto de rating configurado (filtragem fina de janela fica por conta do chamador). */
  async findCandidates(selfRating: number, maxWindow: number): Promise<{ userId: string; rating: number }[]> {
    const raw = await this.redis.zrangebyscore(
      ZSET_KEY,
      selfRating - maxWindow,
      selfRating + maxWindow,
      "WITHSCORES",
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

  /** true se esta chamada foi quem capturou o par (responsável por criar o Match); false se outra chamada já capturou. */
  async claimPair(selfId: string, candidateId: string): Promise<boolean> {
    const result = await this.redis.eval(CLAIM_PAIR_SCRIPT, 1, ZSET_KEY, selfId, candidateId);
    return result === 1;
  }
}
