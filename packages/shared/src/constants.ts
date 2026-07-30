/**
 * Versão da função de scoring `score = f(features, AURA_SCORE_VERSION)`.
 * Todo AuraScore persistido carimba essa versão (CLAUDE.md, regra 4).
 */
export const AURA_SCORE_VERSION = "aura-score-v1";

export const AURA_METRIC_KEYS = [
  "posture",
  "eyeContact",
  "expression",
  "presence",
  "movement",
] as const;

export type AuraMetricKey = (typeof AURA_METRIC_KEYS)[number];

/** Pesos do Aura Score — devem somar 1.0 (validado em test/constants.test.ts). */
export const AURA_SCORE_WEIGHTS: Record<AuraMetricKey, number> = {
  posture: 0.3,
  eyeContact: 0.25,
  expression: 0.2,
  presence: 0.15,
  movement: 0.1,
};
