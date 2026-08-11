import { z } from 'zod';

import { ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH, ANTI_CHEAT_VERSION } from '../constants.js';
import { AuraFeaturesSchema } from './aura-features.dto.js';

export const VerifyRequestSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),

  keyframeBase64: z.string().min(1).max(ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH),
  claimedFeatures: AuraFeaturesSchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const LivenessFlagsSchema = z.object({
  noFaceDetected: z.boolean(),
  staticImageSuspected: z.boolean(),
  lowDetailSuspected: z.boolean(),
  multipleFacesDetected: z.boolean(),
});

export type LivenessFlags = z.infer<typeof LivenessFlagsSchema>;

export const VerifyResponseSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),

  discrepancy: z.number().min(0).max(1),

  discrepancyConfidence: z.number().min(0).max(1),
  liveness: LivenessFlagsSchema,
  version: z.literal(ANTI_CHEAT_VERSION),
  computedAt: z.iso.datetime(),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;
