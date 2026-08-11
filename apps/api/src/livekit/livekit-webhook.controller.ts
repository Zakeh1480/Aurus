import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type { WebhookEvent } from 'livekit-server-sdk';

import { ScoringService } from '../scoring/scoring.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';

/** Sem JwtAuthGuard — a autenticação aqui é a assinatura do LiveKit no header Authorization, não um JWT de usuário. */
@Controller('livekit')
export class LivekitWebhookController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly scoringService: ScoringService,
    private readonly matchDurationScheduler: MatchDurationSchedulerService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ received: true }> {
    if (!authHeader || !req.rawBody) {
      throw new UnauthorizedException();
    }

    let event: WebhookEvent;
    try {
      event = await this.livekit.verifyWebhook(req.rawBody.toString('utf8'), authHeader);
    } catch {
      throw new UnauthorizedException('Assinatura de webhook inválida.');
    }

    if (event.event === 'participant_left' && event.room?.name && event.participant?.identity) {
      // forfeitMatch é idempotente (status !== 'active' vira no-op) — cobre
      // tanto uma desconexão real no meio da partida (derrota automática de
      // quem saiu) quanto o participant_left tardio que o próprio deleteRoom
      // de um encerramento normal (finalizeMatch, duração esgotada) dispara
      // pros dois lados saindo da room.
      await this.scoringService.forfeitMatch(event.room.name, event.participant.identity);
      await this.livekit.deleteRoom(event.room.name);
      this.matchDurationScheduler.cancel(event.room.name);
    }

    return { received: true };
  }
}
