import { z } from "zod";

/**
 * Vetor de features extraído NO CLIENTE (MediaPipe WASM no browser).
 * O backend/serviço de IA só recebe este vetor, nunca vídeo cru
 * (CLAUDE.md, regra 5 — decisão de custo + LGPD).
 */
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
