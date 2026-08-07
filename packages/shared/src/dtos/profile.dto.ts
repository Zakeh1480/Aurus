import { z } from 'zod';

export const ProfileSchema = z.object({
  userId: z.uuid(),
  /** Identidade pública do jogador — pode divergir de User.displayName/avatarUrl. */
  nickname: z.string().min(1).max(32),
  // protocol restrito a http(s) — mesmo motivo de UserSchema.avatarUrl
  // (user.dto.ts): sem allowlist de scheme, um valor armazenado aceitaria
  // javascript:/data:/vbscript:.
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

/**
 * Reaproveita os campos editáveis de ProfileSchema, sem redeclarar limites —
 * contract-first (CLAUDE.md, regra 1).
 */
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
