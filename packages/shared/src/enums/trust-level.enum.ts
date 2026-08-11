import { z } from 'zod';

export const TrustLevelSchema = z.enum(['high', 'medium', 'low']);

export type TrustLevel = z.infer<typeof TrustLevelSchema>;
