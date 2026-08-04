import { describe, expect, it } from "vitest";

import {
  computeEyeContact,
  computeExpression,
  computeMovement,
  computePosture,
  computePresence,
  extractAuraMetrics,
  type FaceDetectionSample,
} from "../../src/lib/aura-features-extraction.js";

/** Rosto olhando reto para a câmera, nivelado, centralizado no frame. */
function frontalFace(): FaceDetectionSample {
  const landmarks: Array<{ x: number; y: number }> = [];
  landmarks[1] = { x: 0.5, y: 0.5 }; // nariz
  landmarks[33] = { x: 0.4, y: 0.45 }; // olho direito
  landmarks[263] = { x: 0.6, y: 0.45 }; // olho esquerdo
  return { landmarks, blendshapes: {} };
}

describe("computePresence", () => {
  it("retorna 0 quando não há amostra", () => {
    expect(computePresence(null)).toBe(0);
  });

  it("retorna 1 quando há landmarks", () => {
    expect(computePresence(frontalFace())).toBe(1);
  });

  it("retorna 0 quando a amostra não tem landmarks", () => {
    expect(computePresence({ landmarks: [], blendshapes: {} })).toBe(0);
  });
});

describe("computeEyeContact", () => {
  it("é alto para um rosto simétrico (olhando para a câmera)", () => {
    expect(computeEyeContact(frontalFace())).toBeGreaterThan(0.9);
  });

  it("cai quando a cabeça vira para o lado (distâncias assimétricas)", () => {
    const turned = frontalFace();
    turned.landmarks[33] = { x: 0.48, y: 0.45 }; // olho direito muito perto do nariz (virou p/ direita)
    expect(computeEyeContact(turned)).toBeLessThan(computeEyeContact(frontalFace()));
  });

  it("retorna 0 sem amostra", () => {
    expect(computeEyeContact(null)).toBe(0);
  });
});

describe("computeExpression", () => {
  it("é 0 sem blendshapes de sorriso/sobrancelha", () => {
    expect(computeExpression(frontalFace())).toBe(0);
  });

  it("aumenta com blendshapes de sorriso", () => {
    const smiling: FaceDetectionSample = {
      ...frontalFace(),
      blendshapes: { mouthSmileLeft: 0.8, mouthSmileRight: 0.9 },
    };
    expect(computeExpression(smiling)).toBeGreaterThan(0.5);
  });

  it("resultado sempre clampado em [0,1]", () => {
    const maxed: FaceDetectionSample = {
      ...frontalFace(),
      blendshapes: {
        mouthSmileLeft: 1,
        mouthSmileRight: 1,
        browInnerUp: 1,
        browOuterUpLeft: 1,
        browOuterUpRight: 1,
      },
    };
    expect(computeExpression(maxed)).toBeLessThanOrEqual(1);
  });
});

describe("computePosture", () => {
  it("é alto para um rosto nivelado e centralizado", () => {
    expect(computePosture(frontalFace())).toBeGreaterThan(0.9);
  });

  it("cai quando a linha dos olhos está inclinada (roll)", () => {
    const tilted = frontalFace();
    tilted.landmarks[33] = { x: 0.4, y: 0.3 };
    tilted.landmarks[263] = { x: 0.6, y: 0.6 };
    expect(computePosture(tilted)).toBeLessThan(computePosture(frontalFace()));
  });

  it("retorna 0 sem amostra", () => {
    expect(computePosture(null)).toBe(0);
  });
});

describe("computeMovement", () => {
  it("é 0 no primeiro frame (sem amostra anterior)", () => {
    expect(computeMovement(frontalFace(), null)).toBe(0);
  });

  it("é 0 quando o rosto não se moveu entre frames", () => {
    const sample = frontalFace();
    expect(computeMovement(sample, sample)).toBe(0);
  });

  it("aumenta com o deslocamento da ponta do nariz", () => {
    const previous = frontalFace();
    const current = frontalFace();
    current.landmarks[1] = { x: 0.6, y: 0.5 };
    expect(computeMovement(current, previous)).toBeGreaterThan(0);
  });
});

describe("extractAuraMetrics", () => {
  it("retorna as 5 métricas, todas clampadas em [0,1]", () => {
    const metrics = extractAuraMetrics(frontalFace(), null);
    for (const value of Object.values(metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("zera tudo quando nenhum rosto foi detectado", () => {
    const metrics = extractAuraMetrics(null, null);
    expect(metrics).toEqual({ posture: 0, eyeContact: 0, expression: 0, presence: 0, movement: 0 });
  });
});
