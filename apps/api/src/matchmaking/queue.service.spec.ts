import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { QueueService } from "./queue.service";

describe("QueueService", () => {
  let redis: {
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    zadd: ReturnType<typeof vi.fn>;
    hsetnx: ReturnType<typeof vi.fn>;
    zrem: ReturnType<typeof vi.fn>;
    hdel: ReturnType<typeof vi.fn>;
    hget: ReturnType<typeof vi.fn>;
    zrangebyscore: ReturnType<typeof vi.fn>;
    eval: ReturnType<typeof vi.fn>;
  };
  let queueService: QueueService;

  beforeEach(async () => {
    redis = {
      set: vi.fn(),
      del: vi.fn(),
      zadd: vi.fn(),
      hsetnx: vi.fn(),
      zrem: vi.fn(),
      hdel: vi.fn(),
      hget: vi.fn(),
      zrangebyscore: vi.fn(),
      eval: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [QueueService, { provide: RedisService, useValue: redis }],
    }).compile();
    queueService = moduleRef.get(QueueService);
  });

  describe("claimGuard", () => {
    it("retorna true quando o SET NX captura a chave", async () => {
      redis.set.mockResolvedValue("OK");
      await expect(queueService.claimGuard("user-a")).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith("mm:user:user-a:guard", "1", "PX", expect.any(Number), "NX");
    });

    it("retorna false quando a chave já existe (SET NX retorna null)", async () => {
      redis.set.mockResolvedValue(null);
      await expect(queueService.claimGuard("user-a")).resolves.toBe(false);
    });
  });

  describe("addToQueue", () => {
    it("faz ZADD e HSETNX (não sobrescreve relógio de espera existente)", async () => {
      await queueService.addToQueue("user-a", 1000, 123);
      expect(redis.zadd).toHaveBeenCalledWith("mm:queue:zset", 1000, "user-a");
      expect(redis.hsetnx).toHaveBeenCalledWith("mm:queue:joined", "user-a", "123");
    });
  });

  describe("leaveQueue", () => {
    it("faz ZREM, HDEL e libera o guard", async () => {
      await queueService.leaveQueue("user-a");
      expect(redis.zrem).toHaveBeenCalledWith("mm:queue:zset", "user-a");
      expect(redis.hdel).toHaveBeenCalledWith("mm:queue:joined", "user-a");
      expect(redis.del).toHaveBeenCalledWith("mm:user:user-a:guard");
    });
  });

  describe("getJoinedAt", () => {
    it("retorna o timestamp numérico quando existe", async () => {
      redis.hget.mockResolvedValue("999");
      await expect(queueService.getJoinedAt("user-a")).resolves.toBe(999);
    });

    it("retorna null quando não existe", async () => {
      redis.hget.mockResolvedValue(null);
      await expect(queueService.getJoinedAt("user-a")).resolves.toBeNull();
    });
  });

  describe("clearWaitClock", () => {
    it("faz HDEL só na hash de espera, sem tocar ZSET/guard", async () => {
      await queueService.clearWaitClock("user-a");
      expect(redis.hdel).toHaveBeenCalledWith("mm:queue:joined", "user-a");
      expect(redis.zrem).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("findCandidates", () => {
    it("converte o retorno WITHSCORES em pares userId/rating", async () => {
      redis.zrangebyscore.mockResolvedValue(["user-b", "1010", "user-c", "990"]);
      await expect(queueService.findCandidates(1000, 400)).resolves.toEqual([
        { userId: "user-b", rating: 1010 },
        { userId: "user-c", rating: 990 },
      ]);
      expect(redis.zrangebyscore).toHaveBeenCalledWith("mm:queue:zset", 600, 1400, "WITHSCORES");
    });
  });

  describe("claimPair", () => {
    it("retorna true quando o script Lua retorna 1", async () => {
      redis.eval.mockResolvedValue(1);
      await expect(queueService.claimPair("user-a", "user-b")).resolves.toBe(true);
      expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, "mm:queue:zset", "user-a", "user-b");
    });

    it("retorna false quando o script Lua retorna 0 (outra chamada já capturou)", async () => {
      redis.eval.mockResolvedValue(0);
      await expect(queueService.claimPair("user-a", "user-b")).resolves.toBe(false);
    });
  });
});
