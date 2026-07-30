import { z } from "zod";

export const RankingEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.uuid(),
  displayName: z.string().min(1).max(32),
  rating: z.number().int().nonnegative(),
  auraScoreAvg: z.number().min(0).max(1),
  matchesPlayed: z.number().int().positive(),
});

export type RankingEntry = z.infer<typeof RankingEntrySchema>;
