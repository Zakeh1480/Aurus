export interface ScoringConfig {
  aiServiceUrl: string;
  aiScoreTimeoutMs: number;
  tickIntervalMs: number;
  sampleBufferMaxLength: number;
  sampleBufferTtlSeconds: number;
  eloKFactor: number;
}

/**
 * Sem @nestjs/config (convenção do repo — ver anti-cheat.constants.ts /
 * matchmaking.constants.ts): lê process.env diretamente, chamado sempre em
 * tempo de execução (nunca no import de módulo).
 */
export function getScoringConfig(): ScoringConfig {
  return {
    aiServiceUrl: process.env["AI_SERVICE_URL"] ?? "http://localhost:8000",
    aiScoreTimeoutMs: Number(process.env["MATCH_SCORE_AI_TIMEOUT_MS"] ?? 3000),
    tickIntervalMs: Number(process.env["MATCH_SCORE_TICK_INTERVAL_MS"] ?? 5000),
    sampleBufferMaxLength: Number(process.env["MATCH_SCORE_SAMPLE_BUFFER_MAX_LENGTH"] ?? 2000),
    sampleBufferTtlSeconds: Number(process.env["MATCH_SCORE_SAMPLE_BUFFER_TTL_SECONDS"] ?? 3600),
    eloKFactor: Number(process.env["MATCH_ELO_K_FACTOR"] ?? 32),
  };
}
