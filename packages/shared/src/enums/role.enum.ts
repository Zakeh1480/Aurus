import { z } from 'zod';

export const RoleSchema = z.enum(['user', 'moderator']);

export type Role = z.infer<typeof RoleSchema>;
