import { z } from 'zod';

import { MatchSideSchema } from '../enums/match-side.enum.js';
import { MatchStatusSchema } from '../enums/match-status.enum.js';
import { ConsentSchema } from './consent.dto.js';
import { ProfileSchema } from './profile.dto.js';
import { UserSchema } from './user.dto.js';

export const MatchHistoryEntrySchema = z.object({
  matchId: z.uuid(),
  side: MatchSideSchema,
  status: MatchStatusSchema,
  ratingBefore: z.number().int(),

  ratingAfter: z.number().int().nullable(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type MatchHistoryEntry = z.infer<typeof MatchHistoryEntrySchema>;

export const UserDataExportSchema = z.object({
  user: UserSchema,
  profile: ProfileSchema.nullable(),
  consents: z.array(ConsentSchema),
  matchHistory: z.array(MatchHistoryEntrySchema),
  exportedAt: z.iso.datetime(),
});
export type UserDataExport = z.infer<typeof UserDataExportSchema>;
