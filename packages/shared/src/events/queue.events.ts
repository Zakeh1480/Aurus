import { z } from 'zod';

import { QueueStatusSchema } from '../enums/queue-status.enum.js';

export const QueueJoinPayloadSchema = z.object({
  userId: z.uuid(),
});
export type QueueJoinPayload = z.infer<typeof QueueJoinPayloadSchema>;

export const QueueLeavePayloadSchema = z.object({
  userId: z.uuid(),
});
export type QueueLeavePayload = z.infer<typeof QueueLeavePayloadSchema>;

export const QueueMatchedPayloadSchema = z.object({
  matchId: z.uuid(),
  opponentId: z.uuid(),
  queueStatus: QueueStatusSchema,
  matchedAt: z.iso.datetime(),
});
export type QueueMatchedPayload = z.infer<typeof QueueMatchedPayloadSchema>;

export const QueueAcceptPayloadSchema = z.object({
  matchId: z.uuid(),
});
export type QueueAcceptPayload = z.infer<typeof QueueAcceptPayloadSchema>;
