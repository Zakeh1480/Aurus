import { z } from "zod";

import { ConsentTypeSchema } from "../enums/consent-type.enum.js";

export const ConsentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: ConsentTypeSchema,
  termsVersion: z.string().min(1),
  grantedAt: z.iso.datetime(),
});
export type Consent = z.infer<typeof ConsentSchema>;

/**
 * Reaproveita `type`/`termsVersion` de ConsentSchema — contract-first
 * (CLAUDE.md, regra 1).
 */
export const GrantConsentRequestSchema = z.object({
  type: ConsentSchema.shape.type,
  termsVersion: ConsentSchema.shape.termsVersion.max(32),
});
export type GrantConsentRequest = z.infer<typeof GrantConsentRequestSchema>;

/**
 * Estado consultável de um tipo de consentimento — usado pelo front
 * (Prompt 9) para bloquear entrada em partida sem consentimento de câmera.
 */
export const ConsentStatusSchema = z.object({
  type: ConsentTypeSchema,
  granted: z.boolean(),
  termsVersion: z.string().nullable(),
  grantedAt: z.iso.datetime().nullable(),
});
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;
