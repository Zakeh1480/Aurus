import type { AuraFeatures } from '@aurafarming/shared';
import { describe, expect, it } from 'vitest';

import { checkTemporalContinuity } from './temporal-plausibility';

const CONFIG = { maxMetricDeltaPerSecond: 2.0 };

function features(overrides: Partial<AuraFeatures> = {}): AuraFeatures {
  return {
    posture: 0.5,
    eyeContact: 0.5,
    expression: 0.5,
    presence: 0.5,
    movement: 0.5,
    sequence: 0,
    capturedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('checkTemporalContinuity', () => {
  it('não viola para um delta pequeno num intervalo normal', () => {
    const prev = features({ sequence: 0, capturedAt: '2026-01-01T00:00:00.000Z', posture: 0.5 });
    const next = features({ sequence: 1, capturedAt: '2026-01-01T00:00:01.000Z', posture: 0.6 });
    expect(checkTemporalContinuity(prev, next, CONFIG)).toEqual({ violated: false });
  });

  it('viola quando uma métrica salta mais que o limite permitido no intervalo', () => {
    const strictConfig = { maxMetricDeltaPerSecond: 0.5 };
    const prev = features({ sequence: 0, capturedAt: '2026-01-01T00:00:00.000Z', posture: 0.0 });
    const next = features({ sequence: 1, capturedAt: '2026-01-01T00:00:01.000Z', posture: 1.0 });
    const result = checkTemporalContinuity(prev, next, strictConfig);
    expect(result.violated).toBe(true);
    expect(result.reason).toContain('posture');
  });

  it('viola quando sequence não avança (fora de ordem)', () => {
    const prev = features({ sequence: 5, capturedAt: '2026-01-01T00:00:00.000Z' });
    const next = features({ sequence: 5, capturedAt: '2026-01-01T00:00:01.000Z' });
    expect(checkTemporalContinuity(prev, next, CONFIG).violated).toBe(true);
  });

  it('viola quando sequence regride', () => {
    const prev = features({ sequence: 5, capturedAt: '2026-01-01T00:00:00.000Z' });
    const next = features({ sequence: 4, capturedAt: '2026-01-01T00:00:01.000Z' });
    expect(checkTemporalContinuity(prev, next, CONFIG).violated).toBe(true);
  });

  it('viola quando capturedAt não avança', () => {
    const prev = features({ sequence: 0, capturedAt: '2026-01-01T00:00:01.000Z' });
    const next = features({ sequence: 1, capturedAt: '2026-01-01T00:00:00.000Z' });
    expect(checkTemporalContinuity(prev, next, CONFIG).violated).toBe(true);
  });

  it('usa um piso de dt para não deixar o limite explodir com amostras quase simultâneas', () => {
    const prev = features({ sequence: 0, capturedAt: '2026-01-01T00:00:00.000Z', posture: 0.0 });
    const next = features({ sequence: 1, capturedAt: '2026-01-01T00:00:00.010Z', posture: 0.5 });

    expect(checkTemporalContinuity(prev, next, CONFIG).violated).toBe(true);
  });
});
