import { z } from 'zod';

export const ProfileSchema = z.object({
  userId: z.uuid(),

  nickname: z.string().min(1).max(32),

  avatarUrl: z.url({ protocol: /^https?$/ }).nullable(),
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

export const UpdateProfileRequestSchema = z
  .object({
    nickname: ProfileSchema.shape.nickname,
    avatarUrl: ProfileSchema.shape.avatarUrl,
    bio: ProfileSchema.shape.bio,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
