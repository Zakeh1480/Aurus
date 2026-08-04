import { QueueJoinPayloadSchema } from "@aurafarming/shared";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Server, Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { MatchmakingGateway } from "./matchmaking.gateway";
import { MatchmakingService } from "./matchmaking.service";
import { WsAuthService } from "./ws-auth.service";

function fakeSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: "socket-1",
    data: {},
    handshake: { auth: {} },
    disconnect: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  } as unknown as Socket;
}

describe("MatchmakingGateway", () => {
  let gateway: MatchmakingGateway;
  let matchmakingService: {
    registerSocket: ReturnType<typeof vi.fn>;
    join: ReturnType<typeof vi.fn>;
    leave: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    handleDisconnect: ReturnType<typeof vi.fn>;
  };
  let wsAuthService: { authenticate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    matchmakingService = {
      registerSocket: vi.fn(),
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      accept: vi.fn().mockResolvedValue(undefined),
      handleDisconnect: vi.fn().mockResolvedValue(undefined),
    };
    wsAuthService = { authenticate: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchmakingGateway,
        { provide: MatchmakingService, useValue: matchmakingService },
        { provide: WsAuthService, useValue: wsAuthService },
      ],
    }).compile();

    gateway = moduleRef.get(MatchmakingGateway);
  });

  describe("afterInit — middleware de autenticação no handshake", () => {
    /**
     * Autenticação roda como middleware do Socket.IO (server.use), não em
     * handleConnection — middleware roda DURANTE o handshake, antes do
     * evento `connect` chegar ao cliente, então socket.data.userId já está
     * garantidamente populado antes de qualquer @SubscribeMessage rodar
     * (sem corrida entre autenticação assíncrona e uma mensagem enviada
     * imediatamente após "connect").
     */
    function captureMiddleware(): (socket: Socket, next: (err?: Error) => void) => void {
      const use = vi.fn();
      const server = { use } as unknown as Server;
      gateway.afterInit(server);
      expect(use).toHaveBeenCalledTimes(1);
      return use.mock.calls[0]![0] as (socket: Socket, next: (err?: Error) => void) => void;
    }

    it("aceita e registra o socket quando o token é válido, chamando next() sem erro", async () => {
      wsAuthService.authenticate.mockResolvedValue("user-a");
      const middleware = captureMiddleware();
      const socket = fakeSocket({ handshake: { auth: { token: "valid-token" } } as never });
      const next = vi.fn();

      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalled());

      expect(socket.data.userId).toBe("user-a");
      expect(matchmakingService.registerSocket).toHaveBeenCalledWith("user-a", socket);
      expect(next).toHaveBeenCalledWith();
    });

    it("chama next(erro) quando o token é inválido — vira connect_error no cliente, nunca chega a conectar", async () => {
      wsAuthService.authenticate.mockRejectedValue(new Error("token inválido"));
      const middleware = captureMiddleware();
      const socket = fakeSocket({ handshake: { auth: { token: "bad-token" } } as never });
      const next = vi.fn();

      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalled());

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(matchmakingService.registerSocket).not.toHaveBeenCalled();
      expect(socket.data.userId).toBeUndefined();
    });

    it("chama next(erro) quando não há token no handshake", async () => {
      wsAuthService.authenticate.mockRejectedValue(new Error("sem token"));
      const middleware = captureMiddleware();
      const socket = fakeSocket({ handshake: { auth: {} } as never });
      const next = vi.fn();

      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalled());

      expect(wsAuthService.authenticate).toHaveBeenCalledWith(undefined);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("handleDisconnect", () => {
    it("delega ao serviço quando o socket foi autenticado", () => {
      const socket = fakeSocket({ data: { userId: "user-a" } });
      gateway.handleDisconnect(socket);
      expect(matchmakingService.handleDisconnect).toHaveBeenCalledWith("user-a");
    });

    it("não chama o serviço se o socket nunca autenticou (userId ausente)", () => {
      const socket = fakeSocket({ data: {} });
      gateway.handleDisconnect(socket);
      expect(matchmakingService.handleDisconnect).not.toHaveBeenCalled();
    });
  });

  describe("mensagens — sempre usam socket.data.userId, nunca payload.userId", () => {
    it("queue:join ignora payload.userId divergente e usa o userId autenticado", async () => {
      const socket = fakeSocket({ data: { userId: "user-real" } });
      await gateway.onQueueJoin(socket, { userId: "user-forjado" });
      expect(matchmakingService.join).toHaveBeenCalledWith("user-real");
    });

    it("queue:leave ignora payload.userId divergente e usa o userId autenticado", async () => {
      const socket = fakeSocket({ data: { userId: "user-real" } });
      await gateway.onQueueLeave(socket, { userId: "user-forjado" });
      expect(matchmakingService.leave).toHaveBeenCalledWith("user-real");
    });

    it("queue:accept usa o userId autenticado e o matchId do payload", async () => {
      const socket = fakeSocket({ data: { userId: "user-real" } });
      await gateway.onQueueAccept(socket, { matchId: "match-1" });
      expect(matchmakingService.accept).toHaveBeenCalledWith("user-real", "match-1");
    });
  });
});

describe("ZodValidationPipe aplicado a queue:join no gateway", () => {
  it("rejeita payload malformado (userId ausente/inválido)", () => {
    const pipe = new ZodValidationPipe(QueueJoinPayloadSchema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
    expect(() => pipe.transform({ userId: "não-é-um-uuid" })).toThrow(BadRequestException);
  });

  it("aceita payload válido", () => {
    const pipe = new ZodValidationPipe(QueueJoinPayloadSchema);
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(pipe.transform({ userId: uuid })).toEqual({ userId: uuid });
  });
});
