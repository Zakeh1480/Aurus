import { z } from 'zod';

export const AntiCheatSessionSecretResponseSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  sessionSecret: z.string().min(32),
  expiresAt: z.iso.datetime(),
});

export type AntiCheatSessionSecretResponse = z.infer<typeof AntiCheatSessionSecretResponseSchema>;
