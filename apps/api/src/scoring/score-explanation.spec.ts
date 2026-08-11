import { AURA_METRIC_KEYS, AURA_SCORE_WEIGHTS, type AuraScore } from '@aurafarming/shared';
import { describe, expect, it } from 'vitest';

import { explainMetrics } from './score-explanation';

function buildScore(overrides: Partial<AuraScore['breakdown']> = {}): AuraScore {
  const breakdown = {
    posture: 0.8,
    eyeContact: 0.7,
    expression: 0.6,
    presence: 0.9,
    movement: 0.5,
    ...overrides,
  };

  const overall = AURA_METRIC_KEYS.reduce(
    (total, key) => total + breakdown[key] * AURA_SCORE_WEIGHTS[key],
    0,
  );
  return { overall, breakdown, version: 'aura-score-v1', computedAt: '2026-01-01T00:00:00.000Z' };
}

describe('explainMetrics', () => {
  it('retorna uma entrada por métrica, na ordem de AURA_METRIC_KEYS', () => {
    const metrics = explainMetrics(buildScore());
    expect(metrics).toHaveLength(AURA_METRIC_KEYS.length);
    expect(metrics.map((metric) => metric.key)).toEqual(AURA_METRIC_KEYS);
  });

  it('raw reflete o breakdown bruto e weight vem de AURA_SCORE_WEIGHTS, sem alterar nenhum dos dois', () => {
    const score = buildScore();
    const metrics = explainMetrics(score);
    for (const metric of metrics) {
      expect(metric.raw).toBe(score.breakdown[metric.key]);
      expect(metric.weight).toBe(AURA_SCORE_WEIGHTS[metric.key]);
    }
  });

  it('contribution = raw × weight para cada métrica', () => {
    const score = buildScore({
      posture: 0.4,
      eyeContact: 1,
      expression: 0,
      presence: 0.25,
      movement: 0.6,
    });
    const metrics = explainMetrics(score);
    for (const metric of metrics) {
      expect(metric.contribution).toBeCloseTo(metric.raw * metric.weight, 10);
    }
  });

  it('soma das contribuições bate com AuraScore.overall (pesos somam 1.0)', () => {
    const score = buildScore();
    const metrics = explainMetrics(score);
    const sum = metrics.reduce((total, metric) => total + metric.contribution, 0);
    expect(sum).toBeCloseTo(score.overall, 10);
  });
});
