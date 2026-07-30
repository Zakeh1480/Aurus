import { describe, expect, it } from "vitest";

import { AuraFeaturesSchema } from "../src/dtos/aura-features.dto.js";
import { AuraScoreSchema } from "../src/dtos/aura-score.dto.js";
import { AURA_METRIC_KEYS, AURA_SCORE_VERSION, AURA_SCORE_WEIGHTS } from "../src/constants.js";

describe("AURA_SCORE_VERSION", () => {
  it('é "aura-score-v1"', () => {
    expect(AURA_SCORE_VERSION).toBe("aura-score-v1");
  });
});

describe("AURA_SCORE_WEIGHTS", () => {
  it("soma exatamente 1.0", () => {
    const sum = Object.values(AURA_SCORE_WEIGHTS).reduce((acc, w) => acc + w, 0);
    expect(sum).toBeCloseTo(1.0, 9);
  });

  it("tem uma entrada por métrica declarada em AURA_METRIC_KEYS", () => {
    expect(Object.keys(AURA_SCORE_WEIGHTS).sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });
});

describe("AURA_METRIC_KEYS (guarda contra drift)", () => {
  it("bate com as chaves numéricas 0–1 de AuraFeaturesSchema", () => {
    const featureKeys = Object.keys(AuraFeaturesSchema.shape).filter((key) =>
      (AURA_METRIC_KEYS as readonly string[]).includes(key),
    );
    expect(featureKeys.sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });

  it("bate com as chaves de AuraScoreSchema.breakdown", () => {
    const breakdownKeys = Object.keys(AuraScoreSchema.shape.breakdown.shape);
    expect(breakdownKeys.sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });
});
