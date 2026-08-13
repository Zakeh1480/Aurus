import { describe, expect, it } from 'vitest';

import { AuraFeaturesSchema } from '../src/dtos/aura-features.dto.js';
import { AuraScoreBreakdownSchema } from '../src/dtos/aura-score.dto.js';
import {
  ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH,
  ANTI_CHEAT_TRUST_THRESHOLDS,
  ANTI_CHEAT_VERSION,
  AURA_METRIC_KEYS,
  AURA_SCORE_VERSION,
  AURA_SCORE_WEIGHTS,
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
  GESTURE_HEURISTIC_VERSION,
  MATCH_DURATION_SECONDS,
} from '../src/constants.js';

describe('AURA_SCORE_VERSION', () => {
  it('é "aura-score-v2"', () => {
    expect(AURA_SCORE_VERSION).toBe('aura-score-v2');
  });
});

describe('GESTURE_HEURISTIC_VERSION', () => {
  it('é "gesture-heuristic-v1"', () => {
    expect(GESTURE_HEURISTIC_VERSION).toBe('gesture-heuristic-v1');
  });
});

describe('AURA_SCORE_WEIGHTS', () => {
  it('soma exatamente 1.0', () => {
    const sum = Object.values(AURA_SCORE_WEIGHTS).reduce((acc, w) => acc + w, 0);
    expect(sum).toBeCloseTo(1.0, 9);
  });

  it('tem uma entrada por métrica declarada em AURA_METRIC_KEYS', () => {
    expect(Object.keys(AURA_SCORE_WEIGHTS).sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });
});

describe('AURA_METRIC_KEYS (guarda contra drift)', () => {
  it('bate com as chaves numéricas 0–1 de AuraFeaturesSchema', () => {
    const featureKeys = Object.keys(AuraFeaturesSchema.shape).filter((key) =>
      (AURA_METRIC_KEYS as readonly string[]).includes(key),
    );
    expect(featureKeys.sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });

  it('bate com as chaves de AuraScoreBreakdownSchema', () => {
    const breakdownKeys = Object.keys(AuraScoreBreakdownSchema.shape);
    expect(breakdownKeys.sort()).toEqual([...AURA_METRIC_KEYS].sort());
  });
});

describe('ANTI_CHEAT_VERSION', () => {
  it('é "anti-cheat-v1"', () => {
    expect(ANTI_CHEAT_VERSION).toBe('anti-cheat-v1');
  });
});

describe('ANTI_CHEAT_TRUST_THRESHOLDS', () => {
  it('highMin e lowMax estão em [0,1] e highMin > lowMax', () => {
    expect(ANTI_CHEAT_TRUST_THRESHOLDS.highMin).toBeGreaterThan(ANTI_CHEAT_TRUST_THRESHOLDS.lowMax);
    expect(ANTI_CHEAT_TRUST_THRESHOLDS.highMin).toBeLessThanOrEqual(1);
    expect(ANTI_CHEAT_TRUST_THRESHOLDS.lowMax).toBeGreaterThanOrEqual(0);
  });
});

describe('ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH', () => {
  it('é positivo', () => {
    expect(ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH).toBeGreaterThan(0);
  });
});

describe('MATCH_DURATION_SECONDS', () => {
  it('é positivo', () => {
    expect(MATCH_DURATION_SECONDS).toBeGreaterThan(0);
  });
});

describe('AVATAR_MAX_FILE_SIZE_BYTES', () => {
  it('é positivo', () => {
    expect(AVATAR_MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
  });
});

describe('AVATAR_ALLOWED_MIME_TYPES', () => {
  it('não é vazio e só contém tipos image/*', () => {
    expect(AVATAR_ALLOWED_MIME_TYPES.length).toBeGreaterThan(0);
    for (const mimeType of AVATAR_ALLOWED_MIME_TYPES) {
      expect(mimeType.startsWith('image/')).toBe(true);
    }
  });
});
