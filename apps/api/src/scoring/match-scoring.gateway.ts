import { type MatchFeaturesPayload, MatchFeaturesPayloadSchema } from "@aurafarming/shared";
import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import type { Socket } from "socket.io";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { ScoreSampleBufferService } from "./score-sample-buffer.service";
import { ScoreTickSchedulerService } from "./score-tick-scheduler.service";

/**
 * Segundo consumidor independente de match:features, ao lado de
 * AntiCheatGateway (Prompt 6b) — múltiplos gateways sem namespace explícito
 * compartilham o mesmo Server/socket, então o Socket.IO invoca os dois
 * handlers para cada mensagem. Este aqui NÃO revalida HMAC/nonce: é
 * "melhor esforço" para o tick ao vivo. A fonte de verdade sobre validade da
 * partida é AntiCheatService.getMatchDecision, consultada só no encerramento
 * (ScoringService.finalizeMatch) — não aqui.
 */
@WebSocketGateway()
export class MatchScoringGateway {
  private readonly logger = new Logger(MatchScoringGateway.name);
  private readonly tickStarted = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleBuffer: ScoreSampleBufferService,
    private readonly scoreTickScheduler: ScoreTickSchedulerService,
  ) {}

  @SubscribeMessage("match:features")
  async onFeatures(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(MatchFeaturesPayloadSchema)) payload: MatchFeaturesPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    await this.sampleBuffer.pushSample(payload.matchId, userId, payload.features);

    if (this.tickStarted.has(payload.matchId)) return;

    const match = await this.prisma.match.findUnique({ where: { id: payload.matchId } });
    if (match?.status !== "active" || this.tickStarted.has(payload.matchId)) return;

    this.tickStarted.add(payload.matchId);
    this.scoreTickScheduler.ensureScheduledForMatch(payload.matchId, match.player1Id, match.player2Id);
  }

  /** Nunca confia em payload.userId para autorização — mesmo padrão das outras gateways. */
  private requireUserId(socket: Socket, payloadUserId: string): string {
    const userId = socket.data.userId as string;
    if (payloadUserId !== userId) {
      this.logger.warn(`payload.userId (${payloadUserId}) não bate com o socket autenticado (${userId})`);
    }
    return userId;
  }
}
