import {
  AURA_METRIC_KEYS,
  AURA_SCORE_WEIGHTS,
  type AuraScore,
  type MetricExplanation,
} from '@aurafarming/shared';

export function explainMetrics(score: AuraScore): MetricExplanation[] {
  return AURA_METRIC_KEYS.map((key) => ({
    key,
    raw: score.breakdown[key],
    weight: AURA_SCORE_WEIGHTS[key],
    contribution: score.breakdown[key] * AURA_SCORE_WEIGHTS[key],
  }));
}
