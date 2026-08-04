import { z } from "zod";

import { RankingEntrySchema } from "./ranking-entry.dto.js";

/**
 * Resposta de GET /ranking/me — `entry` é `null` quando o usuário ainda não
 * tem partida registrada (RankingEntrySchema exige matchesPlayed >= 1, e o
 * zset ranking:global / ranking_snapshots só ganham uma linha dele em
 * RankingService.recordMatchResult).
 */
export const RankingMeResponseSchema = z.object({
  entry: RankingEntrySchema.nullable(),
});

export type RankingMeResponse = z.infer<typeof RankingMeResponseSchema>;
