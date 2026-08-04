import { z } from "zod";

/** Resposta de POST /matches/:id/anti-cheat-secret — segredo HMAC de sessão do anti-cheat (Prompt 6b). */
export const AntiCheatSessionSecretResponseSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  sessionSecret: z.string().min(32),
  expiresAt: z.iso.datetime(),
});

export type AntiCheatSessionSecretResponse = z.infer<typeof AntiCheatSessionSecretResponseSchema>;
