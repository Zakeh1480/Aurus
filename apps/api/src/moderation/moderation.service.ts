import {
  type CreateReportRequest,
  type ModerationActionRequest,
  type Report,
  type ReportDetail,
  type ReportListQuery,
  type ReportListResponse,
} from '@aurafarming/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { toAntiCheatIncident } from './mappers/to-anti-cheat-incident.mapper';
import { toReport } from './mappers/to-report.mapper';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  async createReport(reporterId: string, input: CreateReportRequest): Promise<Report> {
    if (input.reportedUserId === reporterId) {
      throw new BadRequestException('Não é possível denunciar a si mesmo.');
    }

    if (input.matchId) {
      const match = await this.prisma.match.findUnique({ where: { id: input.matchId } });
      if (!match || (match.player1Id !== reporterId && match.player2Id !== reporterId)) {
        throw new ForbiddenException('Você não participa desta partida.');
      }
    }

    const created = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: input.reportedUserId,
        matchId: input.matchId ?? null,
        source: 'manual',
        reason: input.reason,
        details: input.details ?? null,
      },
    });
    return toReport(created);
  }

  async listReports(query: ReportListQuery): Promise<ReportListResponse> {
    const where = query.status ? { status: query.status } : {};
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { entries: reports.map(toReport), limit: query.limit, offset: query.offset, total };
  }

  async getReport(id: string): Promise<ReportDetail> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Denúncia não encontrada.');
    }

    const relatedAntiCheatIncidents = report.matchId
      ? await this.prisma.antiCheatIncident.findMany({
          where: { matchId: report.matchId, userId: report.reportedId },
        })
      : [];

    return {
      ...toReport(report),
      relatedAntiCheatIncidents: relatedAntiCheatIncidents.map(toAntiCheatIncident),
    };
  }

  async resolveReport(
    id: string,
    moderatorId: string,
    input: ModerationActionRequest,
  ): Promise<Report> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Denúncia não encontrada.');
    }
    if (report.status !== 'open') {
      throw new ConflictException('Esta denúncia já foi resolvida.');
    }

    const resolvedAt = new Date();

    if (input.action === 'banned') {
      await this.prisma.$transaction(async (tx) => {
        const ban = await tx.ban.create({
          data: {
            userId: report.reportedId,
            issuedById: moderatorId,
            reason: input.note ?? `Denúncia #${report.id}`,
            expiresAt: input.banExpiresAt ? new Date(input.banExpiresAt) : null,
          },
        });
        await tx.report.update({
          where: { id: report.id },
          data: {
            status: 'resolved',
            action: 'banned',
            resolutionNote: input.note ?? null,
            resolvedById: moderatorId,
            resolvedAt,
            banId: ban.id,
          },
        });
      });

      await this.authService.forceLogout(report.reportedId);
      this.matchmakingService.disconnectUser(report.reportedId);
    } else {
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: 'resolved',
          action: input.action,
          resolutionNote: input.note ?? null,
          resolvedById: moderatorId,
          resolvedAt,
        },
      });
    }

    const updated = await this.prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    return toReport(updated);
  }
}
