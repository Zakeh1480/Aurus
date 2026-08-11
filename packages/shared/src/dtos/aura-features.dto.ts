import { z } from 'zod';

export const AuraFeaturesSchema = z.object({
  posture: z.number().min(0).max(1),
  eyeContact: z.number().min(0).max(1),
  expression: z.number().min(0).max(1),
  presence: z.number().min(0).max(1),
  movement: z.number().min(0).max(1),
  sequence: z.number().int().nonnegative(),
  capturedAt: z.iso.datetime(),
});

export type AuraFeatures = z.infer<typeof AuraFeaturesSchema>;
