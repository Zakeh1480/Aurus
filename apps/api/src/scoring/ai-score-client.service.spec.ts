import type { AuraFeatures } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiScoreClientService } from "./ai-score-client.service";

const FEATURES: AuraFeatures = {
  posture: 0.8,
  eyeContact: 0.7,
  expression: 0.6,
  presence: 0.9,
  movement: 0.5,
  sequence: 0,
  capturedAt: "2026-01-01T00:00:00.000Z",
};

const VALID_SCORE_BODY = {
  overall: 0.72,
  breakdown: { posture: 0.8, eyeContact: 0.7, expression: 0.6, presence: 0.9, movement: 0.5 },
  version: "aura-score-v1",
  computedAt: "2026-01-01T00:00:01.000Z",
};

describe("AiScoreClientService", () => {
  let service: AiScoreClientService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AiScoreClientService] }).compile();
    service = moduleRef.get(AiScoreClientService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("score() faz POST /score e retorna o AuraScore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(VALID_SCORE_BODY) }),
    );

    const result = await service.score(FEATURES);

    expect(result.overall).toBe(0.72);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/score",
      expect.objectContaining({ method: "POST", body: JSON.stringify(FEATURES) }),
    );
  });

  it("aggregate() faz POST /score/aggregate com envelope { samples } e retorna o AuraScore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(VALID_SCORE_BODY) }),
    );

    const result = await service.aggregate([FEATURES, FEATURES]);

    expect(result.overall).toBe(0.72);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/score/aggregate",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ samples: [FEATURES, FEATURES] }) }),
    );
  });

  it("lança quando a resposta HTTP não é 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    await expect(service.score(FEATURES)).rejects.toThrow();
  });

  it("lança quando o corpo da resposta não bate com AuraScoreSchema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ garbage: true }) }),
    );
    await expect(service.score(FEATURES)).rejects.toThrow();
  });

  it("aborta a chamada após aiScoreTimeoutMs (timeout configurável)", async () => {
    vi.useFakeTimers();
    vi.stubEnv("MATCH_SCORE_AI_TIMEOUT_MS", "3000");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }),
    );

    const assertion = expect(service.score(FEATURES)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });
});
