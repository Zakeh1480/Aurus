import type { AntiCheatIncident as PrismaAntiCheatIncident } from "@prisma/client";
import { ANTI_CHEAT_VERSION, type AntiCheatIncident } from "@aurafarming/shared";

export function toAntiCheatIncident(incident: PrismaAntiCheatIncident): AntiCheatIncident {
  return {
    id: incident.id,
    matchId: incident.matchId,
    userId: incident.userId,
    decision: incident.decision,
    trustLevel: incident.trustLevel,
    trustScore: incident.trustScore,
    discrepancyAvg: incident.discrepancyAvg,
    rejectedPacketRatio: incident.rejectedPacketRatio,
    temporalViolationCount: incident.temporalViolationCount,
    challengesIssued: incident.challengesIssued,
    challengesAnswered: incident.challengesAnswered,
    detail: incident.detail as Record<string, unknown>,
    // Carimbado como ANTI_CHEAT_VERSION na escrita (trust-score.service.ts) — cast reflete essa garantia.
    version: incident.version as typeof ANTI_CHEAT_VERSION,
    createdAt: incident.createdAt.toISOString(),
  };
}
