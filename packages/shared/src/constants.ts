/**
 * Versão da função de scoring `score = f(features, AURA_SCORE_VERSION)`.
 * Todo AuraScore persistido carimba essa versão (CLAUDE.md, regra 4).
 */
export const AURA_SCORE_VERSION = 'aura-score-v1';

export const AURA_METRIC_KEYS = [
  'posture',
  'eyeContact',
  'expression',
  'presence',
  'movement',
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

/**
 * Versão do algoritmo de trust-score do anti-cheat (Prompt 6b) — carimbada
 * em todo TrustAssessment/AntiCheatIncident persistido.
 */
export const ANTI_CHEAT_VERSION = 'anti-cheat-v1';

/**
 * Cutoffs padrão (0-1) das 3 faixas de TrustLevel: score >= highMin => "high";
 * lowMax <= score < highMin => "medium"; score < lowMax => "low". São o
 * FALLBACK que apps/api's getAntiCheatConfig() usa quando as env vars
 * ANTI_CHEAT_TRUST_HIGH_MIN / ANTI_CHEAT_TRUST_LOW_MAX não estão definidas —
 * ao contrário de AURA_SCORE_VERSION (fixo), esses thresholds são tunáveis.
 */
export const ANTI_CHEAT_TRUST_THRESHOLDS = {
  highMin: 0.75,
  lowMax: 0.4,
} as const satisfies Record<'highMin' | 'lowMax', number>;

/** Tamanho máx. (chars) de um keyframe base64 aceito em match:verify-response — ~300KB decodificados. */
export const ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH = 400_000;

/**
 * Duração fixa de uma partida, em segundos (Prompt 15). Contrato entre
 * client (countdown cosmético em ScoreHud) e server (encerramento forçado
 * via MatchDurationSchedulerService, a partir de Match.startedAt) — os dois
 * lados importam daqui para não divergir.
 */
export const MATCH_DURATION_SECONDS = 60;
