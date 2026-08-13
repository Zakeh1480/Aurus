import { z } from 'zod';

import { SecurityEventTypeSchema } from '../enums/security-event-type.enum.js';

export const SecurityEventSchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable(),
  type: SecurityEventTypeSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

export const SecurityEventListQuerySchema = z.object({
  type: SecurityEventTypeSchema.optional(),
  userId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type SecurityEventListQuery = z.infer<typeof SecurityEventListQuerySchema>;

export const SecurityEventListResponseSchema = z.object({
  entries: z.array(SecurityEventSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type SecurityEventListResponse = z.infer<typeof SecurityEventListResponseSchema>;
