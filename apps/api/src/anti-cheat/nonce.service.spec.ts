import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { NonceService } from "./nonce.service";

describe("NonceService", () => {
  let redis: { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };
  let service: NonceService;

  beforeEach(async () => {
    redis = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [NonceService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(NonceService);
  });

  describe("consumeFeatureNonce", () => {
    it("retorna true na primeira vez que o nonce é visto (SET NX captura a chave)", async () => {
      redis.set.mockResolvedValue("OK");
      await expect(service.consumeFeatureNonce("match-1", "user-a", "nonce-1")).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        "ac:match:match-1:user:user-a:fnonce:nonce-1",
        "1",
        "PX",
        expect.any(Number),
        "NX",
      );
    });

    it("retorna false num replay do mesmo nonce (SET NX retorna null)", async () => {
      redis.set.mockResolvedValue(null);
      await expect(service.consumeFeatureNonce("match-1", "user-a", "nonce-1")).resolves.toBe(false);
    });
  });

  describe("issueChallengeNonce", () => {
    it("armazena o nonce vinculado ao challengeId com o TTL informado", async () => {
      await service.issueChallengeNonce("match-1", "user-a", "challenge-1", "nonce-xyz", 30_000);
      expect(redis.set).toHaveBeenCalledWith(
        "ac:match:match-1:user:user-a:challenge:challenge-1",
        "nonce-xyz",
        "PX",
        30_000,
        "NX",
      );
    });
  });

  describe("consumeChallengeNonce", () => {
    it("retorna true e apaga a chave quando o nonce bate com o desafio emitido", async () => {
      redis.get.mockResolvedValue("nonce-xyz");
      await expect(service.consumeChallengeNonce("match-1", "user-a", "challenge-1", "nonce-xyz")).resolves.toBe(
        true,
      );
      expect(redis.del).toHaveBeenCalledWith("ac:match:match-1:user:user-a:challenge:challenge-1");
    });

    it("retorna false quando o nonce não bate com o armazenado", async () => {
      redis.get.mockResolvedValue("nonce-correto");
      await expect(service.consumeChallengeNonce("match-1", "user-a", "challenge-1", "nonce-errado")).resolves.toBe(
        false,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("retorna false quando o desafio já expirou/foi consumido (chave ausente)", async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.consumeChallengeNonce("match-1", "user-a", "challenge-1", "nonce-xyz")).resolves.toBe(
        false,
      );
    });

    it("segunda chamada com o mesmo nonce falha (replay) porque a chave já foi apagada", async () => {
      redis.get.mockResolvedValueOnce("nonce-xyz").mockResolvedValueOnce(null);
      await expect(service.consumeChallengeNonce("match-1", "user-a", "challenge-1", "nonce-xyz")).resolves.toBe(
        true,
      );
      await expect(service.consumeChallengeNonce("match-1", "user-a", "challenge-1", "nonce-xyz")).resolves.toBe(
        false,
      );
    });
  });
});
