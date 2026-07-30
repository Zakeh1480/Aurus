import { z } from "zod";

import { MatchStatusSchema } from "../enums/match-status.enum.js";

export const MatchSchema = z.object({
  id: z.uuid(),
  player1Id: z.uuid(),
  player2Id: z.uuid(),
  status: MatchStatusSchema,
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Match = z.infer<typeof MatchSchema>;
