import { z } from 'zod';

export const ModerationActionTypeSchema = z.enum(['dismissed', 'warned', 'banned']);

export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;
