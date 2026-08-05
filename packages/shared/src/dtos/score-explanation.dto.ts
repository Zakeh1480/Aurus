import { z } from "zod";

import { AURA_METRIC_KEYS } from "../constants.js";
import { AuraScoreSchema } from "./aura-score.dto.js";

/**
 * Resposta de GET /matches/:id/score-explanation — não altera AuraScoreSchema
 * nem MatchResultSchema (congelados pelo contrato WS `match:result`
 * existente); envolve o breakdown bruto com peso/contribuição por métrica
 * (AURA_SCORE_WEIGHTS) para permitir contestação de resultado (fairness,
 * Prompt 13).
 */
const MetricExplanationSchema = z.object({
  key: z.enum(AURA_METRIC_KEYS),
  raw: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  contribution: z.number().min(0).max(1),
});

export type MetricExplanation = z.infer<typeof MetricExplanationSchema>;

const PlayerScoreExplanationSchema = z.object({
  userId: z.uuid(),
  score: AuraScoreSchema,
  ratingDelta: z.number().int(),
  metrics: z.array(MetricExplanationSchema).length(AURA_METRIC_KEYS.length),
});

export const MatchScoreExplanationSchema = z.object({
  matchId: z.uuid(),
  scoreVersion: z.string(),
  player1: PlayerScoreExplanationSchema,
  player2: PlayerScoreExplanationSchema,
  winnerId: z.uuid().nullable(),
});

export type MatchScoreExplanation = z.infer<typeof MatchScoreExplanationSchema>;
