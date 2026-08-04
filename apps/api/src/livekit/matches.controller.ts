import { LivekitTokenResponseSchema, type LivekitTokenResponse, type User } from "@aurafarming/shared";
import {
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
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
}
