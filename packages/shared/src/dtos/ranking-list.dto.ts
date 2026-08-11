import { z } from 'zod';

import { RankingEntrySchema } from './ranking-entry.dto.js';

export const RankingListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type RankingListQuery = z.infer<typeof RankingListQuerySchema>;

export const RankingListResponseSchema = z.object({
  entries: z.array(RankingEntrySchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type RankingListResponse = z.infer<typeof RankingListResponseSchema>;
