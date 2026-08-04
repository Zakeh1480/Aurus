import { describe, expect, it } from "vitest";

import { signHmac, verifyHmac } from "./hmac.util";

const SECRET = "s".repeat(32);

// buildFeaturesSigningPayload/buildVerifyResponseSigningPayload são testados
// em packages/shared/test/match-signing.test.ts (fonte de verdade da string
// canônica, compartilhada com apps/web).
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
