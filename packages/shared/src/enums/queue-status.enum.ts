import { z } from "zod";

export const QueueStatusSchema = z.enum(["idle", "queued", "matched"]);

export type QueueStatus = z.infer<typeof QueueStatusSchema>;
