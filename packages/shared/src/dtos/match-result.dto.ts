import { z } from "zod";

import { AuraScoreSchema } from "./aura-score.dto.js";

const MatchResultPlayerSchema = z.object({
  userId: z.uuid(),
  score: AuraScoreSchema,
  /** Variação de rating aplicada a este jogador por causa deste resultado. */
  ratingDelta: z.number().int(),
});

/**
 * Reaproveitado, sem redeclarar, como payload do evento WebSocket
 * `match:result` — contract-first (CLAUDE.md, regra 1).
 */
export const MatchResultSchema = z.object({
  id: z.uuid(),
  matchId: z.uuid(),
  player1: MatchResultPlayerSchema,
  player2: MatchResultPlayerSchema,
  winnerId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;
