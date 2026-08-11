import { z } from 'zod';

import { RegisterRequestSchema } from './auth.dto.js';
import { UserSchema } from './user.dto.js';

/**
 * Troca de senha/e-mail exige a senha atual (defesa contra sessão
 * sequestrada) — `newPassword`/`newEmail` reaproveitam os mesmos limites já
 * usados no registro, sem redeclarar (CLAUDE.md, regra 1).
 */
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: RegisterRequestSchema.shape.password,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ChangeEmailRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newEmail: UserSchema.shape.email,
});
export type ChangeEmailRequest = z.infer<typeof ChangeEmailRequestSchema>;
