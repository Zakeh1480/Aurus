import { z } from "zod";

import { UserSchema } from "./user.dto.js";

/**
 * Reaproveitados de UserSchema, sem redeclarar limites — contract-first
 * (CLAUDE.md, regra 1).
 */
export const RegisterRequestSchema = z.object({
  email: UserSchema.shape.email,
  password: z.string().min(8).max(128),
  displayName: UserSchema.shape.displayName,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: UserSchema.shape.email,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
