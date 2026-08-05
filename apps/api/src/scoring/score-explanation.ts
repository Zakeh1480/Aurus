import { AURA_METRIC_KEYS, AURA_SCORE_WEIGHTS, type AuraScore, type MetricExplanation } from "@aurafarming/shared";

/**
 * Envolve o breakdown bruto de um AuraScore com peso/contribuição por
 * métrica (AURA_SCORE_WEIGHTS) — usado só para exibição/explicação
 * (GET /matches/:id/score-explanation), nunca recalcula o score em si
 * (função pura e versionada, CLAUDE.md regra 4).
 */
export function explainMetrics(score: AuraScore): MetricExplanation[] {
  return AURA_METRIC_KEYS.map((key) => ({
    key,
    raw: score.breakdown[key],
    weight: AURA_SCORE_WEIGHTS[key],
    contribution: score.breakdown[key] * AURA_SCORE_WEIGHTS[key],
  }));
}
