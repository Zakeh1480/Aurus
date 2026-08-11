import {
  type QueueAcceptPayload,
  QueueAcceptPayloadSchema,
  type QueueJoinPayload,
  QueueJoinPayloadSchema,
  type QueueLeavePayload,
  QueueLeavePayloadSchema,
} from '@aurafarming/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  type OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { MatchmakingService } from './matchmaking.service';

const QUEUE_JOIN_LIMIT = 10;
const QUEUE_LEAVE_LIMIT = 10;
const QUEUE_ACCEPT_LIMIT = 10;
const QUEUE_RATE_WINDOW_MS = 60_000;

@WebSocketGateway()
export class MatchmakingGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(MatchmakingGateway.name);

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly wsRateLimiter: WsRateLimiterService,
  ) {}

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    this.matchmakingService.handleDisconnect(userId).catch((error: unknown) => {
      this.logger.error(`Falha ao limpar estado de ${userId} na desconexão`, error);
    });
  }

  @SubscribeMessage('queue:join')
  async onQueueJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueJoinPayloadSchema)) payload: QueueJoinPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    if (
      !(await this.wsRateLimiter.allow(
        `queue:join:${userId}`,
        QUEUE_JOIN_LIMIT,
        QUEUE_RATE_WINDOW_MS,
      ))
    )
      return;
    await this.matchmakingService.join(userId);
  }

  @SubscribeMessage('queue:leave')
  async onQueueLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueLeavePayloadSchema)) payload: QueueLeavePayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    if (
      !(await this.wsRateLimiter.allow(
        `queue:leave:${userId}`,
        QUEUE_LEAVE_LIMIT,
        QUEUE_RATE_WINDOW_MS,
      ))
    )
      return;
    await this.matchmakingService.leave(userId);
  }

  @SubscribeMessage('queue:accept')
  async onQueueAccept(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueAcceptPayloadSchema)) payload: QueueAcceptPayload,
  ): Promise<void> {
    const userId = socket.data.userId as string;
    if (
      !(await this.wsRateLimiter.allow(
        `queue:accept:${userId}`,
        QUEUE_ACCEPT_LIMIT,
        QUEUE_RATE_WINDOW_MS,
      ))
    )
      return;
    await this.matchmakingService.accept(userId, payload.matchId);
  }

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
