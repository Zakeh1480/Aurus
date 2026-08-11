import { z } from 'zod';

import { AuraScoreSchema } from './aura-score.dto.js';

const MatchResultPlayerSchema = z.object({
  userId: z.uuid(),
  score: AuraScoreSchema,

  ratingDelta: z.number().int(),
});

export const MatchResultSchema = z.object({
  id: z.uuid(),
  matchId: z.uuid(),
  player1: MatchResultPlayerSchema,
  player2: MatchResultPlayerSchema,
  winnerId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;
