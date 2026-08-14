export const AURA_SCORE_VERSION = 'aura-score-v2';

export const AURA_METRIC_KEYS = [
  'posture',
  'eyeContact',
  'expression',
  'presence',
  'movement',
] as const;

export type AuraMetricKey = (typeof AURA_METRIC_KEYS)[number];

export const AURA_SCORE_WEIGHTS: Record<AuraMetricKey, number> = {
  posture: 0.3,
  eyeContact: 0.25,
  expression: 0.2,
  presence: 0.15,
  movement: 0.1,
};

export const GESTURE_HEURISTIC_VERSION = 'gesture-heuristic-v1';

export const ANTI_CHEAT_VERSION = 'anti-cheat-v1';

export const ANTI_CHEAT_TRUST_THRESHOLDS = {
  highMin: 0.75,
  lowMax: 0.4,
} as const satisfies Record<'highMin' | 'lowMax', number>;

export const ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH = 400_000;

export const MATCH_DURATION_SECONDS = 60;

export const AVATAR_MAX_FILE_SIZE_BYTES = 5_000_000;
export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const REFRESH_COOKIE_NAME = 'refresh_token';
