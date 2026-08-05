import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

/**
 * Lê WEB_ORIGIN (lista separada por vírgula, para suportar múltiplos
 * previews/ambientes) e devolve as opções de CORS — deve ser chamada em
 * runtime (nunca em escopo de módulo/classe), com o .env já carregado.
 * Fonte única usada por main.ts (REST) e matchmaking-io.adapter.ts (WS) para
 * nunca divergir (Prompt 13).
 */
export function getCorsOptions(): CorsOptions {
  const origins = (process.env["WEB_ORIGIN"] ?? "http://localhost:3000").split(",").map((origin) => origin.trim());
  return { origin: origins, credentials: true };
}
