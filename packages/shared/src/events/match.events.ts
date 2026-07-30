import { z } from "zod";

import { AuraFeaturesSchema } from "../dtos/aura-features.dto.js";
import { MatchResultSchema } from "../dtos/match-result.dto.js";

/** server → ambos jogadores */
export const MatchStartPayloadSchema = z.object({
  matchId: z.uuid(),
  player1Id: z.uuid(),
  player2Id: z.uuid(),
  startedAt: z.iso.datetime(),
});
export type MatchStartPayload = z.infer<typeof MatchStartPayloadSchema>;

/** client → server */
export const MatchFeaturesPayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  features: AuraFeaturesSchema,
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
 * server → client. `challengeType` fica livre (string) de propósito — o
 * formato do anti-cheat é definido no Prompt 6b, não travamos aqui.
 */
export const MatchVerifyChallengePayloadSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  challengeId: z.uuid(),
  challengeType: z.string().min(1),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type MatchVerifyChallengePayload = z.infer<typeof MatchVerifyChallengePayloadSchema>;

/** server → ambos jogadores */
export const MatchEndPayloadSchema = z.object({
  matchId: z.uuid(),
  endedAt: z.iso.datetime(),
  reason: z.enum(["completed", "disconnected", "cancelled"]),
});
export type MatchEndPayload = z.infer<typeof MatchEndPayloadSchema>;

/** server → ambos jogadores — reaproveita MatchResultSchema, não redeclara. */
export const MatchResultPayloadSchema = MatchResultSchema;
export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;
