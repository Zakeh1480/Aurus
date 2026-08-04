import type { AuraFeatures } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { ScoreSampleBufferService } from "./score-sample-buffer.service";

function features(overrides: Partial<AuraFeatures> = {}): AuraFeatures {
  return {
    posture: 0.5,
    eyeContact: 0.5,
    expression: 0.5,
    presence: 0.5,
    movement: 0.5,
    sequence: 0,
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ScoreSampleBufferService", () => {
  let redis: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    rpush: ReturnType<typeof vi.fn>;
    ltrim: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    lrange: ReturnType<typeof vi.fn>;
  };
  let service: ScoreSampleBufferService;

  beforeEach(async () => {
    redis = {
      set: vi.fn(),
      get: vi.fn(),
      rpush: vi.fn(),
      ltrim: vi.fn(),
      expire: vi.fn(),
      lrange: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ScoreSampleBufferService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(ScoreSampleBufferService);
  });

  it("pushSample grava a última amostra e acrescenta à lista limitada com TTL", async () => {
    const sample = features({ sequence: 3 });
    await service.pushSample("match-1", "user-a", sample);

    expect(redis.set).toHaveBeenCalledWith(
      "score:match:match-1:user:user-a:latest",
      JSON.stringify(sample),
      "EX",
      expect.any(Number),
    );
    expect(redis.rpush).toHaveBeenCalledWith("score:match:match-1:user:user-a:samples", JSON.stringify(sample));
    expect(redis.ltrim).toHaveBeenCalledWith(
      "score:match:match-1:user:user-a:samples",
      expect.any(Number),
      -1,
    );
    expect(redis.expire).toHaveBeenCalledWith("score:match:match-1:user:user-a:samples", expect.any(Number));
  });

  it("readLatest retorna null quando não há amostra", async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.readLatest("match-1", "user-a")).toBeNull();
  });

  it("readLatest desserializa a última amostra gravada", async () => {
    const sample = features({ sequence: 7 });
    redis.get.mockResolvedValue(JSON.stringify(sample));
    expect(await service.readLatest("match-1", "user-a")).toEqual(sample);
  });

  it("readSamples retorna lista vazia quando não há histórico", async () => {
    redis.lrange.mockResolvedValue([]);
    expect(await service.readSamples("match-1", "user-a")).toEqual([]);
  });

  it("readSamples desserializa todas as amostras do histórico, em ordem", async () => {
    const s1 = features({ sequence: 0 });
    const s2 = features({ sequence: 1 });
    redis.lrange.mockResolvedValue([JSON.stringify(s1), JSON.stringify(s2)]);

    const result = await service.readSamples("match-1", "user-a");

    expect(result).toEqual([s1, s2]);
    expect(redis.lrange).toHaveBeenCalledWith("score:match:match-1:user:user-a:samples", 0, -1);
  });
});
