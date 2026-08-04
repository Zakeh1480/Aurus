import { describe, expect, it } from "vitest";

import { computeDownscaleDimensions } from "../../src/lib/snapshot-resize.js";

describe("computeDownscaleDimensions", () => {
  it("mantém dimensões quando já estão dentro do limite", () => {
    expect(computeDownscaleDimensions({ width: 320, height: 240 }, 480)).toEqual({ width: 320, height: 240 });
  });

  it("reduz preservando a proporção quando excede o limite", () => {
    expect(computeDownscaleDimensions({ width: 1280, height: 720 }, 320)).toEqual({ width: 320, height: 180 });
  });

  it("nunca amplia (largura igual ao máximo permanece igual)", () => {
    expect(computeDownscaleDimensions({ width: 320, height: 240 }, 320)).toEqual({ width: 320, height: 240 });
  });

  it("retorna zero para dimensões inválidas", () => {
    expect(computeDownscaleDimensions({ width: 0, height: 240 }, 320)).toEqual({ width: 0, height: 0 });
    expect(computeDownscaleDimensions({ width: 320, height: -1 }, 320)).toEqual({ width: 0, height: 0 });
  });
});
