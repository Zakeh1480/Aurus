import { describe, expect, it } from "vitest";

import { buildFeaturesSigningPayload, buildVerifyResponseSigningPayload, signHmac, verifyHmac } from "./hmac.util";

const SECRET = "s".repeat(32);

describe("buildFeaturesSigningPayload", () => {
  it("concatena matchId:userId:nonce:sequence:capturedAt", () => {
    const payload = buildFeaturesSigningPayload({
      matchId: "match-1",
      userId: "user-a",
      nonce: "nonce-1",
      sequence: 5,
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(payload).toBe("match-1:user-a:nonce-1:5:2026-01-01T00:00:00.000Z");
  });
});

describe("buildVerifyResponseSigningPayload", () => {
  it("concatena matchId:userId:challengeId:nonce:capturedAt", () => {
    const payload = buildVerifyResponseSigningPayload({
      matchId: "match-1",
      userId: "user-a",
      challengeId: "challenge-1",
      nonce: "nonce-1",
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(payload).toBe("match-1:user-a:challenge-1:nonce-1:2026-01-01T00:00:00.000Z");
  });
});

describe("signHmac / verifyHmac", () => {
  it("round-trip: assinatura gerada com o segredo certo verifica com sucesso", () => {
    const signature = signHmac("payload-de-teste", SECRET);
    expect(verifyHmac("payload-de-teste", SECRET, signature)).toBe(true);
  });

  it("rejeita quando o payload foi adulterado", () => {
    const signature = signHmac("payload-original", SECRET);
    expect(verifyHmac("payload-adulterado", SECRET, signature)).toBe(false);
  });

  it("rejeita quando a assinatura foi adulterada", () => {
    const signature = signHmac("payload-de-teste", SECRET);
    const tampered = signature.slice(0, -2) + (signature.endsWith("00") ? "ff" : "00");
    expect(verifyHmac("payload-de-teste", SECRET, tampered)).toBe(false);
  });

  it("rejeita quando o segredo usado para verificar é diferente do usado para assinar", () => {
    const signature = signHmac("payload-de-teste", SECRET);
    expect(verifyHmac("payload-de-teste", "outro-segredo-completamente-diferente", signature)).toBe(false);
  });

  it("não lança em assinatura malformada (hex inválido/vazio)", () => {
    expect(verifyHmac("payload-de-teste", SECRET, "")).toBe(false);
    expect(verifyHmac("payload-de-teste", SECRET, "not-hex-zz")).toBe(false);
  });
});
