import { AURA_METRIC_KEYS, type AuraFeatures } from "@aurafarming/shared";

export interface TemporalPlausibilityConfig {
  maxMetricDeltaPerSecond: number;
}

export interface TemporalCheckResult {
  violated: boolean;
  reason?: string;
}

// Piso para evitar que o limite exploda quando dt é próximo de zero (amostras quase simultâneas).
const MIN_DT_SECONDS = 0.1;

/**
 * Continuidade física entre duas amostras consecutivas de AuraFeatures:
 * sequência/timestamp devem avançar, e nenhuma métrica pode saltar mais que
 * `maxMetricDeltaPerSecond` por segundo decorrido. Checagem estatística
 * barata, sem IA (CLAUDE.md/prompt 6b passo 5).
 */
export function checkTemporalContinuity(
  prev: AuraFeatures,
  next: AuraFeatures,
  config: TemporalPlausibilityConfig,
): TemporalCheckResult {
  if (next.sequence <= prev.sequence) {
    return { violated: true, reason: "sequence não avança (fora de ordem ou duplicado)" };
  }

  const dtSeconds = (Date.parse(next.capturedAt) - Date.parse(prev.capturedAt)) / 1000;
  if (dtSeconds <= 0) {
    return { violated: true, reason: "capturedAt não avança" };
  }

  const boundedDt = Math.max(dtSeconds, MIN_DT_SECONDS);
  for (const key of AURA_METRIC_KEYS) {
    const delta = Math.abs(next[key] - prev[key]);
    if (delta > config.maxMetricDeltaPerSecond * boundedDt) {
      return { violated: true, reason: `métrica ${key} saltou ${delta.toFixed(3)} em ${dtSeconds.toFixed(3)}s` };
    }
  }

  return { violated: false };
}
