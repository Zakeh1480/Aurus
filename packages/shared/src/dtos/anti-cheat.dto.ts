import { z } from 'zod';

import { ANTI_CHEAT_VERSION } from '../constants.js';
import { AntiCheatDecisionSchema } from '../enums/anti-cheat-decision.enum.js';
import { TrustLevelSchema } from '../enums/trust-level.enum.js';

export const LivenessFlagCountsSchema = z.object({
  noFaceDetectedCount: z.number().int().nonnegative(),
  staticImageSuspectedCount: z.number().int().nonnegative(),
  lowDetailSuspectedCount: z.number().int().nonnegative(),
  multipleFacesDetectedCount: z.number().int().nonnegative(),
  duplicateKeyframeCount: z.number().int().nonnegative(),
});

export type LivenessFlagCounts = z.infer<typeof LivenessFlagCountsSchema>;

export const TrustAssessmentSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  trustScore: z.number().min(0).max(1),
  trustLevel: TrustLevelSchema,
  decision: AntiCheatDecisionSchema,

  discrepancyAvg: z.number().min(0).max(1).nullable(),
  livenessFlagCounts: LivenessFlagCountsSchema,
  rejectedPacketRatio: z.number().min(0).max(1),
  temporalViolationCount: z.number().int().nonnegative(),
  challengesIssued: z.number().int().nonnegative(),
  challengesAnswered: z.number().int().nonnegative(),
  version: z.literal(ANTI_CHEAT_VERSION),
  evaluatedAt: z.iso.datetime(),
});

export type TrustAssessment = z.infer<typeof TrustAssessmentSchema>;

export const MatchTrustDecisionSchema = z.object({
  matchId: z.uuid(),
  player1: TrustAssessmentSchema,
  player2: TrustAssessmentSchema,

  overallDecision: AntiCheatDecisionSchema,
  evaluatedAt: z.iso.datetime(),
});

export type MatchTrustDecision = z.infer<typeof MatchTrustDecisionSchema>;

export const AntiCheatIncidentSchema = z.object({
  id: z.uuid(),
  matchId: z.uuid(),
  userId: z.uuid(),
  decision: AntiCheatDecisionSchema,
  trustLevel: TrustLevelSchema,
  trustScore: z.number().min(0).max(1),
  discrepancyAvg: z.number().min(0).max(1).nullable(),
  rejectedPacketRatio: z.number().min(0).max(1),
  temporalViolationCount: z.number().int().nonnegative(),
  challengesIssued: z.number().int().nonnegative(),
  challengesAnswered: z.number().int().nonnegative(),
  detail: z.record(z.string(), z.unknown()),
  version: z.literal(ANTI_CHEAT_VERSION),
  createdAt: z.iso.datetime(),
});

export type AntiCheatIncident = z.infer<typeof AntiCheatIncidentSchema>;
