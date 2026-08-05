import type { Report as PrismaReport } from "@prisma/client";
import type { Report } from "@aurafarming/shared";

export function toReport(report: PrismaReport): Report {
  return {
    id: report.id,
    reporterId: report.reporterId,
    reportedId: report.reportedId,
    matchId: report.matchId,
    source: report.source,
    reason: report.reason,
    details: report.details,
    status: report.status,
    action: report.action,
    resolutionNote: report.resolutionNote,
    resolvedById: report.resolvedById,
    resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
    banId: report.banId,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}
