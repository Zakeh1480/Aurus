import { z } from 'zod';

export const LivekitTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  roomName: z.string(),
  identity: z.uuid(),
  expiresAt: z.iso.datetime(),
});
export type LivekitTokenResponse = z.infer<typeof LivekitTokenResponseSchema>;
