import {
  type QueueAcceptPayload,
  QueueAcceptPayloadSchema,
  type QueueJoinPayload,
  QueueJoinPayloadSchema,
  type QueueLeavePayload,
  QueueLeavePayloadSchema,
} from "@aurafarming/shared";
import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WsRateLimiterService } from "../common/ws-rate-limiter.service";
import { MatchmakingService } from "./matchmaking.service";
import { WsAuthService } from "./ws-auth.service";

/** Janela fixa de 60s — @nestjs/throttler não cobre gateways WS (Prompt 13). */
const QUEUE_JOIN_LIMIT = 10;
const QUEUE_LEAVE_LIMIT = 10;
const QUEUE_ACCEPT_LIMIT = 10;
const QUEUE_RATE_WINDOW_MS = 60_000;

@WebSocketGateway()
export class MatchmakingGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(MatchmakingGateway.name);

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly wsAuthService: WsAuthService,
    private readonly wsRateLimiter: WsRateLimiterService,
  ) {}

  /**
   * Autenticação via middleware do Socket.IO (não via `handleConnection`):
   * middleware roda DURANTE o handshake, antes do evento `connect` chegar
   * ao cliente — `handleConnection` só roda DEPOIS que o cliente já se
   * considera conectado (e pode emitir mensagens), o que abriria uma
   * corrida entre a autenticação assíncrona (JWT + Postgres) e uma mensagem
   * enviada imediatamente. Middleware fecha essa corrida: `socket.data.userId`
   * está garantidamente populado antes de qualquer `@SubscribeMessage` rodar,
   * e um token inválido vira `connect_error` no cliente em vez de um
   * connect-e-desconecta-na-hora.
   */
  afterInit(server: Server): void {
    server.use((socket: Socket, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.["token"] as string | undefined;
      this.wsAuthService
        .authenticate(token)
        .then((userId) => {
          socket.data.userId = userId;
          this.matchmakingService.registerSocket(userId, socket);
          next();
        })
        .catch(() => next(new Error("Unauthorized")));
    });
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    this.matchmakingService.handleDisconnect(userId).catch((error: unknown) => {
      this.logger.error(`Falha ao limpar estado de ${userId} na desconexão`, error);
    });
  }

  @SubscribeMessage("queue:join")
  async onQueueJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueJoinPayloadSchema)) payload: QueueJoinPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    if (!(await this.wsRateLimiter.allow(`queue:join:${userId}`, QUEUE_JOIN_LIMIT, QUEUE_RATE_WINDOW_MS))) return;
    await this.matchmakingService.join(userId);
  }

  @SubscribeMessage("queue:leave")
  async onQueueLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueLeavePayloadSchema)) payload: QueueLeavePayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);
    if (!(await this.wsRateLimiter.allow(`queue:leave:${userId}`, QUEUE_LEAVE_LIMIT, QUEUE_RATE_WINDOW_MS))) return;
    await this.matchmakingService.leave(userId);
  }

  @SubscribeMessage("queue:accept")
  async onQueueAccept(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(QueueAcceptPayloadSchema)) payload: QueueAcceptPayload,
  ): Promise<void> {
    const userId = socket.data.userId as string;
    if (!(await this.wsRateLimiter.allow(`queue:accept:${userId}`, QUEUE_ACCEPT_LIMIT, QUEUE_RATE_WINDOW_MS))) return;
    await this.matchmakingService.accept(userId, payload.matchId);
  }

  /**
   * Nunca confia em `payload.userId` para autorização — o contrato
   * congelado em `packages/shared` exige o campo, mas quem manda é sempre
   * `socket.data.userId` (resolvido do JWT verificado no middleware de
   * conexão). Um mismatch é logado, não aceito.
   */
  private requireUserId(socket: Socket, payloadUserId: string): string {
    const userId = socket.data.userId as string;
    if (payloadUserId !== userId) {
      this.logger.warn(`payload.userId (${payloadUserId}) não bate com o socket autenticado (${userId})`);
    }
    return userId;
  }
}
