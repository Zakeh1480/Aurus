import { z } from 'zod';

import { RankingEntrySchema } from './ranking-entry.dto.js';

export const RankingMeResponseSchema = z.object({
  entry: RankingEntrySchema.nullable(),
});

export type RankingMeResponse = z.infer<typeof RankingMeResponseSchema>;
