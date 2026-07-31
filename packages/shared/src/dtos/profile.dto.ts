import { z } from "zod";

export const ProfileSchema = z.object({
  userId: z.uuid(),
  /** Identidade pública do jogador — pode divergir de User.displayName/avatarUrl. */
  nickname: z.string().min(1).max(32),
  avatarUrl: z.url().nullable(),
  bio: z.string().max(280).nullable(),
  rating: z.number().int().nonnegative(),
  auraScoreAvg: z.number().min(0).max(1).nullable(),
  matchesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;
