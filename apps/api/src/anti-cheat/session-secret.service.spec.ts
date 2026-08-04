import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { SessionSecretService } from "./session-secret.service";

describe("SessionSecretService", () => {
  let redis: { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; ttl: ReturnType<typeof vi.fn> };
  let service: SessionSecretService;

  beforeEach(async () => {
    redis = { set: vi.fn(), get: vi.fn(), ttl: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [SessionSecretService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(SessionSecretService);
  });

  describe("issue", () => {
    it("na primeira chamada, cria e retorna um novo segredo (SET NX bem-sucedido)", async () => {
      redis.set.mockResolvedValue("OK");
      redis.ttl.mockResolvedValue(10_800);

      const { secret, expiresAt } = await service.issue("match-1", "user-a");

      expect(redis.set).toHaveBeenCalledWith(
        "ac:match:match-1:user:user-a:secret",
        expect.any(String),
        "EX",
        expect.any(Number),
        "NX",
      );
      expect(secret.length).toBeGreaterThan(0);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("na segunda chamada, retorna o MESMO segredo já armazenado (não rotaciona)", async () => {
      redis.set.mockResolvedValue(null);
      redis.get.mockResolvedValue("segredo-ja-existente");
      redis.ttl.mockResolvedValue(5000);

      const { secret } = await service.issue("match-1", "user-a");

      expect(secret).toBe("segredo-ja-existente");
    });
  });

  describe("get", () => {
    it("retorna o segredo armazenado", async () => {
      redis.get.mockResolvedValue("segredo-existente");
      await expect(service.get("match-1", "user-a")).resolves.toBe("segredo-existente");
      expect(redis.get).toHaveBeenCalledWith("ac:match:match-1:user:user-a:secret");
    });

    it("retorna null quando não há segredo emitido", async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.get("match-1", "user-a")).resolves.toBeNull();
    });
  });
});
