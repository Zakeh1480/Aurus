import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type {
  AntiCheatIncident as PrismaAntiCheatIncident,
  Ban as PrismaBan,
  Match as PrismaMatch,
  Report as PrismaReport,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "../auth/auth.service";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationService } from "./moderation.service";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function buildReport(overrides: Partial<PrismaReport> = {}): PrismaReport {
  return {
    id: "report-1",
    reporterId: "reporter-1",
    reportedId: "reported-1",
    matchId: null,
    antiCheatIncidentId: null,
    source: "manual",
    reason: "cheating",
    details: null,
    status: "open",
    action: null,
    resolutionNote: null,
    resolvedById: null,
    resolvedAt: null,
    banId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildMatch(overrides: Partial<PrismaMatch> = {}): PrismaMatch {
  return {
    id: "match-1",
    player1Id: "reporter-1",
    player2Id: "reported-1",
    status: "completed",
    scoreVersion: "aura-score-v1",
    featuresPlayer1: null,
    featuresPlayer2: null,
    scorePlayer1: null,
    scorePlayer2: null,
    winnerId: "reporter-1",
    startedAt: NOW,
    endedAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function buildBan(overrides: Partial<PrismaBan> = {}): PrismaBan {
  return {
    id: "ban-1",
    userId: "reported-1",
    issuedById: "moderator-1",
    reason: "Denúncia #report-1",
    expiresAt: null,
    liftedAt: null,
    liftedById: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe("ModerationService", () => {
  let service: ModerationService;
  let prisma: {
    match: { findUnique: ReturnType<typeof vi.fn> };
    report: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    antiCheatIncident: { findMany: ReturnType<typeof vi.fn> };
    ban: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let authService: { forceLogout: ReturnType<typeof vi.fn> };
  let matchmakingService: { disconnectUser: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      match: { findUnique: vi.fn() },
      report: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      antiCheatIncident: { findMany: vi.fn() },
      ban: { create: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback(prisma)),
    };
    authService = { forceLogout: vi.fn().mockResolvedValue(undefined) };
    matchmakingService = { disconnectUser: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: MatchmakingService, useValue: matchmakingService },
      ],
    }).compile();

    service = moduleRef.get(ModerationService);
  });

  describe("createReport", () => {
    it("rejeita autodenúncia", async () => {
      await expect(
        service.createReport("user-1", { reportedUserId: "user-1", reason: "cheating" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it("rejeita quando matchId é informado mas o reporter não participa da partida", async () => {
      prisma.match.findUnique.mockResolvedValue(buildMatch({ player1Id: "outro-1", player2Id: "outro-2" }));

      await expect(
        service.createReport("reporter-1", { reportedUserId: "reported-1", matchId: "match-1", reason: "cheating" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("cria a denúncia manual quando o reporter participa da partida informada", async () => {
      prisma.match.findUnique.mockResolvedValue(buildMatch());
      prisma.report.create.mockResolvedValue(buildReport({ matchId: "match-1" }));

      const result = await service.createReport("reporter-1", {
        reportedUserId: "reported-1",
        matchId: "match-1",
        reason: "cheating",
      });

      expect(prisma.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: "reporter-1",
          reportedId: "reported-1",
          matchId: "match-1",
          source: "manual",
          reason: "cheating",
          details: null,
        },
      });
      expect(result.source).toBe("manual");
    });

    it("cria a denúncia sem checar participação quando nenhum matchId é informado", async () => {
      prisma.report.create.mockResolvedValue(buildReport());

      await service.createReport("reporter-1", { reportedUserId: "reported-1", reason: "harassment" });

      expect(prisma.match.findUnique).not.toHaveBeenCalled();
      expect(prisma.report.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("getReport", () => {
    it("lança NotFoundException quando a denúncia não existe", async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.getReport("inexistente")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("inclui os incidentes de anti-cheat do mesmo match/usuário como contexto", async () => {
      const report = buildReport({ matchId: "match-1" });
      const incident: PrismaAntiCheatIncident = {
        id: "incident-1",
        matchId: "match-1",
        userId: "reported-1",
        decision: "flagged",
        trustLevel: "medium",
        trustScore: 0.5,
        discrepancyAvg: null,
        rejectedPacketRatio: 0.1,
        temporalViolationCount: 0,
        challengesIssued: 2,
        challengesAnswered: 2,
        detail: {},
        version: "anti-cheat-v1",
        createdAt: NOW,
        updatedAt: NOW,
      };
      prisma.report.findUnique.mockResolvedValue(report);
      prisma.antiCheatIncident.findMany.mockResolvedValue([incident]);

      const result = await service.getReport("report-1");

      expect(prisma.antiCheatIncident.findMany).toHaveBeenCalledWith({
        where: { matchId: "match-1", userId: "reported-1" },
      });
      expect(result.relatedAntiCheatIncidents).toHaveLength(1);
      expect(result.relatedAntiCheatIncidents[0]?.id).toBe("incident-1");
    });

    it("não consulta anti-cheat quando a denúncia não está ligada a uma partida", async () => {
      prisma.report.findUnique.mockResolvedValue(buildReport({ matchId: null }));

      const result = await service.getReport("report-1");

      expect(prisma.antiCheatIncident.findMany).not.toHaveBeenCalled();
      expect(result.relatedAntiCheatIncidents).toEqual([]);
    });
  });

  describe("resolveReport", () => {
    it("lança NotFoundException quando a denúncia não existe", async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.resolveReport("inexistente", "moderator-1", { action: "dismissed" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("lança ConflictException quando a denúncia já foi resolvida", async () => {
      prisma.report.findUnique.mockResolvedValue(buildReport({ status: "resolved" }));
      await expect(service.resolveReport("report-1", "moderator-1", { action: "dismissed" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("dismissed: só atualiza o report, sem criar ban nem derrubar sessões", async () => {
      prisma.report.findUnique.mockResolvedValue(buildReport());
      prisma.report.findUniqueOrThrow.mockResolvedValue(buildReport({ status: "resolved", action: "dismissed" }));

      await service.resolveReport("report-1", "moderator-1", { action: "dismissed", note: "sem evidência" });

      expect(prisma.ban.create).not.toHaveBeenCalled();
      expect(authService.forceLogout).not.toHaveBeenCalled();
      expect(matchmakingService.disconnectUser).not.toHaveBeenCalled();
      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-1" },
        data: {
          status: "resolved",
          action: "dismissed",
          resolutionNote: "sem evidência",
          resolvedById: "moderator-1",
          resolvedAt: expect.any(Date),
        },
      });
    });

    it("banned: cria Ban, atualiza o report com banId, derruba sessões e desconecta o socket", async () => {
      prisma.report.findUnique.mockResolvedValue(buildReport());
      prisma.ban.create.mockResolvedValue(buildBan());
      prisma.report.findUniqueOrThrow.mockResolvedValue(
        buildReport({ status: "resolved", action: "banned", banId: "ban-1" }),
      );

      const result = await service.resolveReport("report-1", "moderator-1", {
        action: "banned",
        banExpiresAt: null,
        note: "cheat confirmado",
      });

      expect(prisma.ban.create).toHaveBeenCalledWith({
        data: {
          userId: "reported-1",
          issuedById: "moderator-1",
          reason: "cheat confirmado",
          expiresAt: null,
        },
      });
      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-1" },
        data: {
          status: "resolved",
          action: "banned",
          resolutionNote: "cheat confirmado",
          resolvedById: "moderator-1",
          resolvedAt: expect.any(Date),
          banId: "ban-1",
        },
      });
      expect(authService.forceLogout).toHaveBeenCalledWith("reported-1");
      expect(matchmakingService.disconnectUser).toHaveBeenCalledWith("reported-1");
      expect(result.action).toBe("banned");
    });

    it("banned com data de expiração converte o ISO string em Date", async () => {
      prisma.report.findUnique.mockResolvedValue(buildReport());
      prisma.ban.create.mockResolvedValue(buildBan({ expiresAt: new Date("2026-02-01T00:00:00.000Z") }));
      prisma.report.findUniqueOrThrow.mockResolvedValue(buildReport({ status: "resolved", action: "banned" }));

      await service.resolveReport("report-1", "moderator-1", {
        action: "banned",
        banExpiresAt: "2026-02-01T00:00:00.000Z",
      });

      expect(prisma.ban.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ expiresAt: new Date("2026-02-01T00:00:00.000Z") }) }),
      );
    });
  });
});
