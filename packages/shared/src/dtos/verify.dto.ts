import { z } from "zod";

import { ANTI_CHEAT_VERSION } from "../constants.js";
import { AuraFeaturesSchema } from "./aura-features.dto.js";

/**
 * Body de POST /verify no serviço de IA (Prompt 6b). Espelhado manualmente em
 * services/ai/app/schemas.py (Python não importa este pacote TS).
 */
export const VerifyRequestSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),
  keyframeBase64: z.string().min(1),
  claimedFeatures: AuraFeaturesSchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

/**
 * Flags produzidas pela heurística OpenCV single-frame (Haar cascade +
 * variância de Laplaciano) — sem comparação temporal entre frames, isso é
 * responsabilidade do AntiCheatModule (apps/api), não deste endpoint stateless.
 */
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
  /** 0 = features batem com a estimativa re-extraída; 1 = discrepância máxima. */
  discrepancy: z.number().min(0).max(1),
  /** Soma dos pesos das dimensões que este heurístico consegue reavaliar (presence/eyeContact); hoje sempre 1.0. */
  discrepancyConfidence: z.number().min(0).max(1),
  liveness: LivenessFlagsSchema,
  version: z.literal(ANTI_CHEAT_VERSION),
  computedAt: z.iso.datetime(),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;
