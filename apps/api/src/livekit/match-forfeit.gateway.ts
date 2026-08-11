import { type MatchForfeitPayload, MatchForfeitPayloadSchema } from '@aurafarming/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { ScoringService } from '../scoring/scoring.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';

/** Janela fixa de 60s — @nestjs/throttler não cobre gateways WS (mesmo padrão de MatchmakingGateway). */
const FORFEIT_LIMIT = 3;
const FORFEIT_RATE_WINDOW_MS = 60_000;

/**
 * Vive em LivekitModule (não em ScoringModule) para não criar um ciclo de
 * módulos: LivekitModule já importa ScoringModule (para ScoringService, via
 * LivekitWebhookController) e já é dono local de LivekitService/
 * MatchDurationSchedulerService — colocar o gateway aqui reaproveita as duas
 * dependências sem ScoringModule precisar importar LivekitModule de volta.
 */
@WebSocketGateway()
export class MatchForfeitGateway {
  private readonly logger = new Logger(MatchForfeitGateway.name);

  constructor(
    private readonly scoringService: ScoringService,
    private readonly livekit: LivekitService,
    private readonly matchDurationScheduler: MatchDurationSchedulerService,
    private readonly wsRateLimiter: WsRateLimiterService,
  ) {}

  @SubscribeMessage('match:forfeit')
  async onForfeit(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(MatchForfeitPayloadSchema)) payload: MatchForfeitPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    if (
      !(await this.wsRateLimiter.allow(
        `match:forfeit:${userId}`,
        FORFEIT_LIMIT,
        FORFEIT_RATE_WINDOW_MS,
      ))
    ) {
      return;
    }

    await this.scoringService.forfeitMatch(payload.matchId, userId);
    await this.livekit.deleteRoom(payload.matchId);
    this.matchDurationScheduler.cancel(payload.matchId);
  }

  /** Nunca confia em payload.userId para autorização — mesmo padrão das outras gateways. */
  private requireUserId(socket: Socket, payloadUserId: string): string {
    const userId = socket.data.userId as string;
    if (payloadUserId !== userId) {
      this.logger.warn(
        `payload.userId (${payloadUserId}) não bate com o socket autenticado (${userId})`,
      );
    }
    return userId;
  }
}
