import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hmacSha256Hex } from "../../src/lib/hmac-browser.js";

/**
 * O AntiCheatGateway descarta silenciosamente qualquer match:features /
 * match:verify-response cuja assinatura não bata — não há erro nem ack. Este
 * teste garante paridade byte-a-byte com apps/api/src/anti-cheat/hmac.util.ts
 * (createHmac("sha256", secret)), não só que a função "parece certa".
 */
function nodeReference(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("hmacSha256Hex", () => {
  it("bate com createHmac('sha256', secret) do node:crypto para um segredo base64url", async () => {
    const secret = "s".repeat(43); // shape de randomBytes(32).toString("base64url")
    const payload = "match-1:user-a:nonce-1:5:2026-01-01T00:00:00.000Z";

    const result = await hmacSha256Hex(payload, secret);

    expect(result).toBe(nodeReference(payload, secret));
  });

  it("bate com o node para vários pares payload/segredo, incluindo caracteres do alfabeto base64url", async () => {
    const cases = [
      { secret: "AAAA-BBBB_CCCC1234567890abcdefghijklmnop", payload: "" },
      { secret: "9f8e7d6c5b4a3-_ZYXWVUTSRQPONMLKJIHGFEDCBA", payload: "match-2:user-b:nonce-2:0:2026-01-01T00:00:00.000Z" },
      {
        secret: "a1B2c3D4e5F6g7H8i9J0-_a1B2c3D4e5F6g7H8i9J0",
        payload: "match-3:user-c:challenge-1:nonce-3:2026-01-01T00:00:02.000Z",
      },
    ];

    for (const { secret, payload } of cases) {
      expect(await hmacSha256Hex(payload, secret)).toBe(nodeReference(payload, secret));
    }
  });

  it("produz um hex de 64 caracteres (sha256 digest)", async () => {
    const result = await hmacSha256Hex("payload", "s".repeat(32));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("assinaturas diferem quando o payload muda", async () => {
    const secret = "s".repeat(32);
    const a = await hmacSha256Hex("payload-a", secret);
    const b = await hmacSha256Hex("payload-b", secret);
    expect(a).not.toBe(b);
  });
});
