import type { AuraFeatures } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedisService } from "../redis/redis.service";
import { FeatureBufferService } from "./feature-buffer.service";

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

describe("FeatureBufferService", () => {
  let redis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let service: FeatureBufferService;

  beforeEach(async () => {
    redis = { get: vi.fn(), set: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [FeatureBufferService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(FeatureBufferService);
  });

  it("primeira amostra da partida: nada para comparar, não viola", async () => {
    redis.get.mockResolvedValue(null);
    const result = await service.pushAndCheck("match-1", "user-a", features({ sequence: 0 }));
    expect(result).toEqual({ violated: false });
    expect(redis.set).toHaveBeenCalledWith(
      "ac:match:match-1:user:user-a:last-features",
      JSON.stringify(features({ sequence: 0 })),
      "EX",
      expect.any(Number),
    );
  });

  it("segunda amostra dentro dos limites físicos: não viola", async () => {
    redis.get.mockResolvedValue(JSON.stringify(features({ sequence: 0, posture: 0.5 })));
    const result = await service.pushAndCheck(
      "match-1",
      "user-a",
      features({ sequence: 1, posture: 0.6, capturedAt: "2026-01-01T00:00:01.000Z" }),
    );
    expect(result.violated).toBe(false);
  });

  it("segunda amostra com salto impossível: viola", async () => {
    redis.get.mockResolvedValue(
      JSON.stringify(features({ sequence: 0, posture: 0.0, capturedAt: "2026-01-01T00:00:00.000Z" })),
    );
    // Salto máximo possível (0 -> 1) em uma janela quase instantânea — mesmo
    // com o piso de dt (MIN_DT_SECONDS), excede o default de maxMetricDeltaPerSecond.
    const result = await service.pushAndCheck(
      "match-1",
      "user-a",
      features({ sequence: 1, posture: 1.0, capturedAt: "2026-01-01T00:00:00.010Z" }),
    );
    expect(result.violated).toBe(true);
  });
});
