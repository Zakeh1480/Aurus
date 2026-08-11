import { z } from 'zod';

import { ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH } from '../constants.js';
import { AuraFeaturesSchema } from '../dtos/aura-features.dto.js';
import { MatchResultSchema } from '../dtos/match-result.dto.js';

/** server → ambos jogadores */
export const MatchStartPayloadSchema = z.object({
  matchId: z.uuid(),
  player1Id: z.uuid(),
  player2Id: z.uuid(),
  startedAt: z.iso.datetime(),
});
export type MatchStartPayload = z.infer<typeof MatchStartPayloadSchema>;

/**
 * client → server. `nonce`/`signature` ligam o pacote à sessão
 * (matchId+userId) e impedem replay (Prompt 6b) — ver AntiCheatModule
 * (apps/api) para o formato exato assinado.
 */
export const MatchFeaturesPayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  features: AuraFeaturesSchema,
  nonce: z.string().min(16),
  signature: z.string().min(32),
});
export type MatchFeaturesPayload = z.infer<typeof MatchFeaturesPayloadSchema>;

/** server → ambos jogadores */
export const MatchScoreTickPayloadSchema = z.object({
  matchId: z.uuid(),
  tickAt: z.iso.datetime(),
  scores: z
    .array(
      z.object({
        userId: z.uuid(),
        liveScore: z.number().min(0).max(1),
      }),
    )
    .length(2),
});
export type MatchScoreTickPayload = z.infer<typeof MatchScoreTickPayloadSchema>;

/**
 * server → client. Formato final do anti-cheat (Prompt 6b) — `challengeType`
 * hoje só tem "snapshot" (pull de frame direto do LiveKit egress é stretch
 * goal do prompt original, não implementado). `nonce` liga a resposta do
 * cliente (match:verify-response) a este desafio específico.
 */
export const MatchVerifyChallengePayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),
  challengeType: z.enum(['snapshot']),
  nonce: z.string().min(16),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type MatchVerifyChallengePayload = z.infer<typeof MatchVerifyChallengePayloadSchema>;

/**
 * client → server. Resposta a match:verify-challenge — snapshot único
 * (keyframe) + features reivindicadas para aquele instante + assinatura
 * HMAC (Prompt 6b). O AntiCheatModule reencaminha para POST /verify no
 * serviço de IA depois de validar nonce+assinatura.
 */
export const MatchVerifyResponsePayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),
  nonce: z.string().min(16),
  capturedAt: z.iso.datetime(),
  keyframeBase64: z.string().min(1).max(ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH),
  claimedFeatures: AuraFeaturesSchema,
  signature: z.string().min(32),
});
export type MatchVerifyResponsePayload = z.infer<typeof MatchVerifyResponsePayloadSchema>;

/** server → ambos jogadores */
export const MatchEndPayloadSchema = z.object({
  matchId: z.uuid(),
  endedAt: z.iso.datetime(),
  reason: z.enum(['completed', 'disconnected', 'cancelled', 'forfeited']),
});
export type MatchEndPayload = z.infer<typeof MatchEndPayloadSchema>;

/** server → ambos jogadores — reaproveita MatchResultSchema, não redeclara. */
export const MatchResultPayloadSchema = MatchResultSchema;
export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;

/** client → server. Desistência voluntária de uma partida ativa. */
export const MatchForfeitPayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
});
export type MatchForfeitPayload = z.infer<typeof MatchForfeitPayloadSchema>;
