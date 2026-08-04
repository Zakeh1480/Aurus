import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { KeyframeHistoryService } from "./keyframe-history.service";

describe("KeyframeHistoryService", () => {
  let redis: {
    sismember: ReturnType<typeof vi.fn>;
    sadd: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
  };
  let service: KeyframeHistoryService;

  beforeEach(async () => {
    redis = { sismember: vi.fn(), sadd: vi.fn(), expire: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [KeyframeHistoryService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(KeyframeHistoryService);
  });

  it("primeiro keyframe: não é duplicado, e o hash é registrado", async () => {
    redis.sismember.mockResolvedValue(0);
    const isDuplicate = await service.checkAndRecord("match-1", "user-a", "ZmFrZS1rZXlmcmFtZQ==");
    expect(isDuplicate).toBe(false);
    expect(redis.sadd).toHaveBeenCalledWith("ac:match:match-1:user:user-a:keyframe-hashes", expect.any(String));
  });

  it("keyframe com os mesmos bytes enviado de novo: é detectado como duplicado", async () => {
    redis.sismember.mockResolvedValue(1);
    const isDuplicate = await service.checkAndRecord("match-1", "user-a", "ZmFrZS1rZXlmcmFtZQ==");
    expect(isDuplicate).toBe(true);
  });

  it("keyframes com bytes diferentes produzem hashes diferentes", async () => {
    redis.sismember.mockResolvedValue(0);
    await service.checkAndRecord("match-1", "user-a", "aW1hZ2VtLTE=");
    const firstHash = redis.sadd.mock.calls[0]?.[1] as string;
    await service.checkAndRecord("match-1", "user-a", "aW1hZ2VtLTI=");
    const secondHash = redis.sadd.mock.calls[1]?.[1] as string;
    expect(firstHash).not.toBe(secondHash);
  });
});
