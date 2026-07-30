import { z } from "zod";

import { AURA_SCORE_VERSION } from "../constants.js";

/** Saída da função pura de scoring `score = f(features, AURA_SCORE_VERSION)`. */
export const AuraScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  breakdown: z.object({
    posture: z.number().min(0).max(1),
    eyeContact: z.number().min(0).max(1),
    expression: z.number().min(0).max(1),
    presence: z.number().min(0).max(1),
    movement: z.number().min(0).max(1),
  }),
  version: z.literal(AURA_SCORE_VERSION),
  computedAt: z.iso.datetime(),
});

export type AuraScore = z.infer<typeof AuraScoreSchema>;
