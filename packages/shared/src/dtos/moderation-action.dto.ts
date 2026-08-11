import { z } from 'zod';

import { ModerationActionTypeSchema } from '../enums/moderation-action-type.enum.js';

export const ModerationActionRequestSchema = z
  .object({
    action: ModerationActionTypeSchema,
    note: z.string().max(1000).optional(),
    banExpiresAt: z.iso.datetime().nullable().optional(),
  })
  .refine((value) => value.action !== 'banned' || value.banExpiresAt !== undefined, {
    message: 'banExpiresAt é obrigatório (use null para permanente) quando action é "banned".',
    path: ['banExpiresAt'],
  });

export type ModerationActionRequest = z.infer<typeof ModerationActionRequestSchema>;
