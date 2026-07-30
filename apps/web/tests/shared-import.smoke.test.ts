import { describe, expect, it } from "vitest";

import { AURA_SCORE_VERSION, AuraFeaturesSchema } from "../src/smoke.js";

describe("import de @aurafarming/shared em apps/web", () => {
  it("importa a versão do Aura Score corretamente", () => {
    expect(AURA_SCORE_VERSION).toBe("aura-score-v1");
  });

  it("valida um AuraFeatures com o schema importado de shared", () => {
    const result = AuraFeaturesSchema.safeParse({
      posture: 0.5,
      eyeContact: 0.5,
      expression: 0.5,
      presence: 0.5,
      movement: 0.5,
      sequence: 0,
      capturedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});
