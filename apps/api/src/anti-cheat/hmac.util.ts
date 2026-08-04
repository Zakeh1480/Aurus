import { createHmac, timingSafeEqual } from "node:crypto";

// Strings canônicas assinadas vivem em `shared` — o cliente browser (Web
// Crypto, apps/web) precisa montá-las de forma idêntica, então há uma única
// fonte de verdade em vez de duas implementações que podem divergir.
export { buildFeaturesSigningPayload, buildVerifyResponseSigningPayload } from "@aurafarming/shared";

export function signHmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmac(payload: string, secret: string, signature: string): boolean {
  // Buffer.from(_, "hex") nunca lança — entrada inválida só produz bytes
  // truncados/vazios, cobertos pela checagem de tamanho abaixo.
  const expected = Buffer.from(signHmac(payload, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
