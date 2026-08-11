import { type MatchFeaturesPayload, MatchFeaturesPayloadSchema } from '@aurafarming/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';

@WebSocketGateway()
export class MatchScoringGateway {
  private readonly logger = new Logger(MatchScoringGateway.name);
  private readonly tickStarted = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleBuffer: ScoreSampleBufferService,
    private readonly scoreTickScheduler: ScoreTickSchedulerService,
  ) {}

  @SubscribeMessage('match:features')
  async onFeatures(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(MatchFeaturesPayloadSchema)) payload: MatchFeaturesPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    await this.sampleBuffer.pushSample(payload.matchId, userId, payload.features);

    if (this.tickStarted.has(payload.matchId)) return;

    const match = await this.prisma.match.findUnique({ where: { id: payload.matchId } });
    if (match?.status !== 'active' || this.tickStarted.has(payload.matchId)) return;

    this.tickStarted.add(payload.matchId);
    this.scoreTickScheduler.ensureScheduledForMatch(payload.matchId);
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
