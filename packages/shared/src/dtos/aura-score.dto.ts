import { z } from 'zod';

import { GESTURE_HEURISTIC_VERSION } from '../constants.js';
import { GestureLabelSchema } from '../enums/gesture-label.enum.js';

export const AuraScoreBreakdownSchema = z.object({
  posture: z.number().min(0).max(1),
  eyeContact: z.number().min(0).max(1),
  expression: z.number().min(0).max(1),
  presence: z.number().min(0).max(1),
  movement: z.number().min(0).max(1),
});

export const GestureResultSchema = z.object({
  label: GestureLabelSchema,
  confidence: z.number().min(0).max(1),
  version: z.literal(GESTURE_HEURISTIC_VERSION),
});

export type GestureResult = z.infer<typeof GestureResultSchema>;

const AuraScoreV1Schema = z.object({
  overall: z.number().min(0).max(1),
  breakdown: AuraScoreBreakdownSchema,
  version: z.literal('aura-score-v1'),
  computedAt: z.iso.datetime(),
});

const AuraScoreV2Schema = z.object({
  overall: z.number().min(0).max(1),
  breakdown: AuraScoreBreakdownSchema,
  gesture: GestureResultSchema,
  version: z.literal('aura-score-v2'),
  computedAt: z.iso.datetime(),
});

export const AuraScoreSchema = z.discriminatedUnion('version', [
  AuraScoreV1Schema,
  AuraScoreV2Schema,
]);

export type AuraScore = z.infer<typeof AuraScoreSchema>;
