import { z } from 'zod';

export const AntiCheatDecisionSchema = z.enum(['valid', 'flagged', 'discarded']);

export type AntiCheatDecision = z.infer<typeof AntiCheatDecisionSchema>;
