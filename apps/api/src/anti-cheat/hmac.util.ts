import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assina identificadores + nonce + timestamp/sequência, NUNCA os valores das
 * métricas — HMAC prova só "veio de quem tem o segredo" e "não é replay",
 * não que os números são verdadeiros. Conteúdo forjado é pego pelo /verify
 * (discrepancy) e pela checagem de plausibilidade temporal, não pela
 * assinatura.
 */
export function buildFeaturesSigningPayload(input: {
  matchId: string;
  userId: string;
  nonce: string;
  sequence: number;
  capturedAt: string;
}): string {
  return `${input.matchId}:${input.userId}:${input.nonce}:${input.sequence}:${input.capturedAt}`;
}

export function buildVerifyResponseSigningPayload(input: {
  matchId: string;
  userId: string;
  challengeId: string;
  nonce: string;
  capturedAt: string;
}): string {
  return `${input.matchId}:${input.userId}:${input.challengeId}:${input.nonce}:${input.capturedAt}`;
}

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
