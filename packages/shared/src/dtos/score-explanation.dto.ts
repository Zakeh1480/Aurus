import { z } from 'zod';

import { AURA_METRIC_KEYS } from '../constants.js';
import { AuraScoreSchema } from './aura-score.dto.js';

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
