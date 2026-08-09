import { ANTI_CHEAT_TRUST_THRESHOLDS } from '@aurafarming/shared';

export interface AntiCheatTrustWeights {
  discrepancy: number;
  liveness: number;
  rejected: number;
  temporal: number;
  coverage: number;
}

export interface AntiCheatConfig {
  aiServiceUrl: string;
  aiVerifyTimeoutMs: number;
  sessionSecretTtlSeconds: number;
  challengeTtlMs: number;
  challengesMin: number;
  challengesMax: number;
  challengeIntervalMinMs: number;
  challengeIntervalMaxMs: number;
  challengePollIntervalMs: number;
  maxSessionMs: number;
  featureNonceWindowMs: number;
  featureClockSkewMs: number;
  maxMetricDeltaPerSecond: number;
  temporalViolationSaturation: number;
  statsTtlSeconds: number;
  trustHighMin: number;
  trustLowMax: number;
  trustWeights: AntiCheatTrustWeights;
}

/**
 * Sem @nestjs/config (convenção do repo — ver matchmaking.constants.ts /
 * livekit.constants.ts): lê process.env diretamente, chamado sempre em tempo
 * de execução (nunca no import de módulo), já que o .env só é carregado
 * explicitamente em main.ts.
 */
export function getAntiCheatConfig(): AntiCheatConfig {
  return {
    aiServiceUrl: process.env['AI_SERVICE_URL'] ?? 'http://localhost:8000',
    aiVerifyTimeoutMs: Number(process.env['ANTI_CHEAT_AI_VERIFY_TIMEOUT_MS'] ?? 3000),
    sessionSecretTtlSeconds: Number(process.env['ANTI_CHEAT_SESSION_SECRET_TTL_SECONDS'] ?? 10_800),
    challengeTtlMs: Number(process.env['ANTI_CHEAT_CHALLENGE_TTL_MS'] ?? 30_000),
    challengesMin: Number(process.env['ANTI_CHEAT_CHALLENGES_MIN'] ?? 2),
    challengesMax: Number(process.env['ANTI_CHEAT_CHALLENGES_MAX'] ?? 4),
    challengeIntervalMinMs: Number(process.env['ANTI_CHEAT_CHALLENGE_INTERVAL_MIN_MS'] ?? 60_000),
    challengeIntervalMaxMs: Number(process.env['ANTI_CHEAT_CHALLENGE_INTERVAL_MAX_MS'] ?? 180_000),
    challengePollIntervalMs: Number(process.env['ANTI_CHEAT_CHALLENGE_POLL_INTERVAL_MS'] ?? 1000),
    maxSessionMs: Number(process.env['ANTI_CHEAT_MAX_SESSION_MS'] ?? 1_800_000),
    featureNonceWindowMs: Number(process.env['ANTI_CHEAT_FEATURE_NONCE_WINDOW_MS'] ?? 10_000),
    featureClockSkewMs: Number(process.env['ANTI_CHEAT_FEATURE_CLOCK_SKEW_MS'] ?? 5000),
    maxMetricDeltaPerSecond: Number(process.env['ANTI_CHEAT_MAX_METRIC_DELTA_PER_SECOND'] ?? 2.0),
    temporalViolationSaturation: Number(
      process.env['ANTI_CHEAT_TEMPORAL_VIOLATION_SATURATION'] ?? 5,
    ),
    statsTtlSeconds: Number(process.env['ANTI_CHEAT_STATS_TTL_SECONDS'] ?? 3600),
    trustHighMin: Number(
      process.env['ANTI_CHEAT_TRUST_HIGH_MIN'] ?? ANTI_CHEAT_TRUST_THRESHOLDS.highMin,
    ),
    trustLowMax: Number(
      process.env['ANTI_CHEAT_TRUST_LOW_MAX'] ?? ANTI_CHEAT_TRUST_THRESHOLDS.lowMax,
    ),
    trustWeights: {
      discrepancy: Number(process.env['ANTI_CHEAT_TRUST_WEIGHT_DISCREPANCY'] ?? 0.35),
      liveness: Number(process.env['ANTI_CHEAT_TRUST_WEIGHT_LIVENESS'] ?? 0.3),
      rejected: Number(process.env['ANTI_CHEAT_TRUST_WEIGHT_REJECTED'] ?? 0.2),
      temporal: Number(process.env['ANTI_CHEAT_TRUST_WEIGHT_TEMPORAL'] ?? 0.1),
      coverage: Number(process.env['ANTI_CHEAT_TRUST_WEIGHT_COVERAGE'] ?? 0.05),
    },
  };
}
