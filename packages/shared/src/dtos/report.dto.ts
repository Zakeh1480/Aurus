import { z } from "zod";

import { ModerationActionTypeSchema } from "../enums/moderation-action-type.enum.js";
import { ReportReasonSchema } from "../enums/report-reason.enum.js";
import { ReportSourceSchema } from "../enums/report-source.enum.js";
import { ReportStatusSchema } from "../enums/report-status.enum.js";
import { AntiCheatIncidentSchema } from "./anti-cheat.dto.js";

/**
 * Caso de moderação — criado manualmente (denúncia de um jogador) ou
 * automaticamente pelo AntiCheatModule (source="anti_cheat", reporterId nulo)
 * quando um incidente não-"valid" é persistido (Prompt 13).
 */
export const ReportSchema = z.object({
  id: z.uuid(),
  reporterId: z.uuid().nullable(),
  reportedId: z.uuid(),
  matchId: z.uuid().nullable(),
  source: ReportSourceSchema,
  reason: ReportReasonSchema,
  details: z.string().max(500).nullable(),
  status: ReportStatusSchema,
  action: ModerationActionTypeSchema.nullable(),
  resolutionNote: z.string().max(1000).nullable(),
  resolvedById: z.uuid().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  banId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Report = z.infer<typeof ReportSchema>;

/** Body de POST /reports — denúncia manual de um jogador (opcionalmente ligada a uma partida). */
export const CreateReportRequestSchema = z.object({
  reportedUserId: z.uuid(),
  matchId: z.uuid().optional(),
  reason: ReportReasonSchema,
  details: z.string().max(500).optional(),
});

export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

/** Query params de GET /moderation/reports — paginação + filtro por status. */
export const ReportListQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;

/** Envelope de paginação em volta de ReportSchema (contract-first, CLAUDE.md regra 1). */
export const ReportListResponseSchema = z.object({
  entries: z.array(ReportSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type ReportListResponse = z.infer<typeof ReportListResponseSchema>;

/**
 * Detalhe de um Report para o moderador — inclui os AntiCheatIncident (Prompt
 * 6b) da mesma partida/usuário como evidência contextual, mesmo em denúncias
 * manuais (não só nas geradas automaticamente).
 */
export const ReportDetailSchema = ReportSchema.extend({
  relatedAntiCheatIncidents: z.array(AntiCheatIncidentSchema),
});

export type ReportDetail = z.infer<typeof ReportDetailSchema>;
