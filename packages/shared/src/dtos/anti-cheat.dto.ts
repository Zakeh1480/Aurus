import { z } from "zod";

import { ANTI_CHEAT_VERSION } from "../constants.js";
import { AntiCheatDecisionSchema } from "../enums/anti-cheat-decision.enum.js";
import { TrustLevelSchema } from "../enums/trust-level.enum.js";

/**
 * Contagens agregadas de flags ao longo da partida para um participante. As 4
 * primeiras chaves espelham LivenessFlagsSchema (verify.dto.ts) — uma
 * contagem por flag reportada pelo /verify. `duplicateKeyframeCount` é
 * calculado só em apps/api (hash dos bytes do keyframe comparado ao
 * histórico da partida em Redis) — não vem do serviço de IA, por isso não
 * tem equivalente em LivenessFlagsSchema.
 */
export const LivenessFlagCountsSchema = z.object({
  noFaceDetectedCount: z.number().int().nonnegative(),
  staticImageSuspectedCount: z.number().int().nonnegative(),
  lowDetailSuspectedCount: z.number().int().nonnegative(),
  multipleFacesDetectedCount: z.number().int().nonnegative(),
  duplicateKeyframeCount: z.number().int().nonnegative(),
});

export type LivenessFlagCounts = z.infer<typeof LivenessFlagCountsSchema>;

/** Avaliação de confiança de UM participante em UMA partida — unidade atômica do anti-cheat. */
export const TrustAssessmentSchema = z.object({
  matchId: z.uuid(),
  userId: z.uuid(),
  trustScore: z.number().min(0).max(1),
  trustLevel: TrustLevelSchema,
  decision: AntiCheatDecisionSchema,
  /** null se nenhum /verify foi concluído com sucesso (sem evidência de discrepância). */
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

/** Decisão consolidada da partida — o que Prompt 7 consulta antes de gravar resultado/ranking. */
export const MatchTrustDecisionSchema = z.object({
  matchId: z.uuid(),
  player1: TrustAssessmentSchema,
  player2: TrustAssessmentSchema,
  /** pior-caso entre os dois: discarded > flagged > valid. */
  overallDecision: AntiCheatDecisionSchema,
  evaluatedAt: z.iso.datetime(),
});

export type MatchTrustDecision = z.infer<typeof MatchTrustDecisionSchema>;

/** Espelha o modelo Prisma AntiCheatIncident — persistido só quando decision != "valid". */
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
