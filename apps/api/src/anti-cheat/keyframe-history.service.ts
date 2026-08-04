import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";
import { getAntiCheatConfig } from "./anti-cheat.constants";

@Injectable()
export class KeyframeHistoryService {
  constructor(private readonly redis: RedisService) {}

  /**
   * SHA-256 dos bytes decodificados — pega só repetição BYTE-A-BYTE (ataque
   * ingênuo de reenviar a mesma imagem/loop exato). Um perceptual hash real
   * (dHash/pHash, tolerante a recompressão) exigiria decodificar pixels, o
   * que duplicaria em Node a capacidade de CV que já existe em services/ai —
   * deliberadamente fora de escopo aqui.
   */
  async checkAndRecord(matchId: string, userId: string, keyframeBase64: string): Promise<boolean> {
    const hash = createHash("sha256").update(Buffer.from(keyframeBase64, "base64")).digest("hex");
    const key = this.key(matchId, userId);
    const isDuplicate = (await this.redis.sismember(key, hash)) === 1;
    await this.redis.sadd(key, hash);
    await this.redis.expire(key, getAntiCheatConfig().statsTtlSeconds);
    return isDuplicate;
  }

  private key(matchId: string, userId: string): string {
    return `ac:match:${matchId}:user:${userId}:keyframe-hashes`;
  }
}
