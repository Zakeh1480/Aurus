/**
 * Segredo compartilhado com services/ai (Prompt 13) — enviado no header
 * x-ai-service-secret em toda chamada a /score, /score/aggregate e /verify.
 * Ler em runtime (nunca em escopo de módulo), mesma convenção dos demais
 * `*.constants.ts`. O lado FastAPI (app/security.py) falha fechado — sem o
 * header correto, a chamada nunca chega ao scoring/verify. Este lado precisa
 * do mesmo comportamento: sem a env var, lança em vez de cair num literal
 * conhecido (`"change-me"`) que poderia acidentalmente combinar com o
 * default do outro lado.
 */
export function getAiServiceSecret(): string {
  const secret = process.env['AI_SERVICE_SHARED_SECRET'];
  if (!secret) {
    throw new Error(
      'AI_SERVICE_SHARED_SECRET não definido — verifique o .env na raiz do monorepo.',
    );
  }
  return secret;
}
