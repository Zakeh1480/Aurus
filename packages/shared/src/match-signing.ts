/**
 * Strings canônicas assinadas por HMAC no fluxo anti-cheat (Prompt 6b).
 * Vivem em `shared` (não em `apps/api`) porque tanto o servidor
 * (`apps/api`, Node `crypto`) quanto o cliente (`apps/web`, Web Crypto)
 * precisam montar exatamente a mesma string — divergência aqui faz o
 * `AntiCheatGateway` descartar o pacote silenciosamente.
 *
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
