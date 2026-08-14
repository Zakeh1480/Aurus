import { z } from 'zod';

export const WsTicketResponseSchema = z.object({
  ticket: z.string().min(16),
  expiresAt: z.iso.datetime(),
});
export type WsTicketResponse = z.infer<typeof WsTicketResponseSchema>;
