import { z } from "zod";

export const ProfileSchema = z.object({
  userId: z.uuid(),
  rating: z.number().int().nonnegative(),
  auraScoreAvg: z.number().min(0).max(1).nullable(),
  matchesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;
