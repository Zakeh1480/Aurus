/**
 * Segredo compartilhado com services/ai (Prompt 13) — enviado no header
 * x-ai-service-secret em toda chamada a /score, /score/aggregate e /verify.
 * Ler em runtime (nunca em escopo de módulo), mesma convenção dos demais
 * `*.constants.ts`. O lado FastAPI (app/security.py) falha fechado — sem o
 * header correto, a chamada nunca chega ao scoring/verify.
 */
export function getAiServiceSecret(): string {
  return process.env["AI_SERVICE_SHARED_SECRET"] ?? "change-me";
}
