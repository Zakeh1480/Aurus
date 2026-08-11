import {
  type AntiCheatSessionSecretResponse,
  AntiCheatSessionSecretResponseSchema,
  type User,
} from '@aurafarming/shared';
import {
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengeSchedulerService } from './challenge-scheduler.service';
import { SessionSecretService } from './session-secret.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class AntiCheatSessionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionSecretService: SessionSecretService,
    private readonly challengeScheduler: ChallengeSchedulerService,
  ) {}

  @Post(':id/anti-cheat-secret')
  async issueSecret(
    @Param('id', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: User,
  ): Promise<AntiCheatSessionSecretResponse> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException('Partida não encontrada.');
    }
    if (match.player1Id !== user.id && match.player2Id !== user.id) {
      throw new ForbiddenException('Você não participa desta partida.');
    }
    if (match.status !== 'active') {
      throw new ConflictException('Partida não está ativa.');
    }

    const { secret, expiresAt } = await this.sessionSecretService.issue(matchId, user.id);
    this.challengeScheduler.ensureScheduledForMatch(matchId, match.player1Id, match.player2Id);

    return AntiCheatSessionSecretResponseSchema.parse({
      matchId,
      userId: user.id,
      sessionSecret: secret,
      expiresAt: expiresAt.toISOString(),
    });
  }
}
