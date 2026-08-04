const HEX_TABLE = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => HEX_TABLE[byte]).join("");
}

/**
 * Equivalente browser de `createHmac("sha256", secret).update(payload).digest("hex")`
 * (apps/api/src/anti-cheat/hmac.util.ts). `secret` é sempre uma string
 * base64url pura-ASCII (SessionSecretService.issue) — codificá-la como UTF-8
 * produz os mesmos bytes que o Node usa implicitamente ao receber uma string
 * como chave, então as duas implementações assinam de forma idêntica.
 */
export async function hmacSha256Hex(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufferToHex(signature);
}
