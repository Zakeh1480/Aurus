import {
  AuraScoreSchema,
  LivekitTokenResponseSchema,
  MatchScoreExplanationSchema,
  type LivekitTokenResponse,
  type MatchScoreExplanation,
  type User,
} from "@aurafarming/shared";
import {
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { explainMetrics } from "../scoring/score-explanation";
import { LivekitService } from "./livekit.service";

@Controller("matches")
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
  ) {}

  @Post(":id/token")
  async issueToken(
    @Param("id", ParseUUIDPipe) matchId: string,
    @CurrentUser() user: User,
  ): Promise<LivekitTokenResponse> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException("Partida não encontrada.");
    }
    if (match.player1Id !== user.id && match.player2Id !== user.id) {
      throw new ForbiddenException("Você não participa desta partida.");
    }
    if (match.status !== "active") {
      throw new ConflictException("Partida não está ativa.");
    }

    await this.livekit.ensureRoom(matchId);
    const { token, expiresAt } = await this.livekit.createToken(matchId, user.id);

    return LivekitTokenResponseSchema.parse({
      token,
      url: this.livekit.publicUrl,
      roomName: matchId,
      identity: user.id,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Fairness (Prompt 13): breakdown com peso/contribuição por métrica, para
   * contestação de resultado. Acesso: participante da partida ou moderador
   * (revisão de denúncia) — mesmo padrão de autorização de issueToken acima,
   * estendido para role=moderator.
   */
  @Get(":id/score-explanation")
  async getScoreExplanation(
    @Param("id", ParseUUIDPipe) matchId: string,
    @CurrentUser() user: User,
  ): Promise<MatchScoreExplanation> {
    const result = await this.prisma.matchResult.findUnique({ where: { matchId } });
    if (!result) {
      throw new NotFoundException("Resultado da partida não encontrado.");
    }

    const isParticipant = result.player1Id === user.id || result.player2Id === user.id;
    if (!isParticipant && user.role !== "moderator") {
      throw new ForbiddenException("Você não participa desta partida.");
    }

    const score1 = AuraScoreSchema.parse(result.player1Score);
    const score2 = AuraScoreSchema.parse(result.player2Score);

    return MatchScoreExplanationSchema.parse({
      matchId,
      scoreVersion: score1.version,
      player1: {
        userId: result.player1Id,
        score: score1,
        ratingDelta: result.player1RatingDelta,
        metrics: explainMetrics(score1),
      },
      player2: {
        userId: result.player2Id,
        score: score2,
        ratingDelta: result.player2RatingDelta,
        metrics: explainMetrics(score2),
      },
      winnerId: result.winnerId,
    });
  }
}
