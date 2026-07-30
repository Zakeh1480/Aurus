import { z } from "zod";

import { QueueStatusSchema } from "../enums/queue-status.enum.js";

/** client → server */
export const QueueJoinPayloadSchema = z.object({
  userId: z.uuid(),
});
export type QueueJoinPayload = z.infer<typeof QueueJoinPayloadSchema>;

/** client → server */
export const QueueLeavePayloadSchema = z.object({
  userId: z.uuid(),
});
export type QueueLeavePayload = z.infer<typeof QueueLeavePayloadSchema>;

/** server → client */
export const QueueMatchedPayloadSchema = z.object({
  matchId: z.uuid(),
  opponentId: z.uuid(),
  queueStatus: QueueStatusSchema,
  matchedAt: z.iso.datetime(),
});
export type QueueMatchedPayload = z.infer<typeof QueueMatchedPayloadSchema>;
