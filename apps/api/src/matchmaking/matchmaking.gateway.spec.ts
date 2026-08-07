import { QueueJoinPayloadSchema } from '@aurafarming/shared';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';

function fakeSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: 'socket-1',
    data: {},
    handshake: { auth: {} },
    disconnect: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  } as unknown as Socket;
}

describe('MatchmakingGateway', () => {
  let gateway: MatchmakingGateway;
  let matchmakingService: {
    registerSocket: ReturnType<typeof vi.fn>;
    join: ReturnType<typeof vi.fn>;
    leave: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    handleDisconnect: ReturnType<typeof vi.fn>;
  };
  let wsRateLimiter: { allow: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    matchmakingService = {
      registerSocket: vi.fn(),
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      accept: vi.fn().mockResolvedValue(undefined),
      handleDisconnect: vi.fn().mockResolvedValue(undefined),
    };
    // Default: sempre dentro do limite — testes de rate limiting específicos
    // sobrescrevem com mockResolvedValueOnce(false) quando necessário.
    wsRateLimiter = { allow: vi.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchmakingGateway,
        { provide: MatchmakingService, useValue: matchmakingService },
        { provide: WsRateLimiterService, useValue: wsRateLimiter },
      ],
    }).compile();

    gateway = moduleRef.get(MatchmakingGateway);
  });

  describe('handleDisconnect', () => {
    it('delega ao serviço quando o socket foi autenticado', () => {
      const socket = fakeSocket({ data: { userId: 'user-a' } });
      gateway.handleDisconnect(socket);
      expect(matchmakingService.handleDisconnect).toHaveBeenCalledWith('user-a');
    });

    it('não chama o serviço se o socket nunca autenticou (userId ausente)', () => {
      const socket = fakeSocket({ data: {} });
      gateway.handleDisconnect(socket);
      expect(matchmakingService.handleDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('mensagens — sempre usam socket.data.userId, nunca payload.userId', () => {
    it('queue:join ignora payload.userId divergente e usa o userId autenticado', async () => {
      const socket = fakeSocket({ data: { userId: 'user-real' } });
      await gateway.onQueueJoin(socket, { userId: 'user-forjado' });
      expect(matchmakingService.join).toHaveBeenCalledWith('user-real');
    });

    it('queue:leave ignora payload.userId divergente e usa o userId autenticado', async () => {
      const socket = fakeSocket({ data: { userId: 'user-real' } });
      await gateway.onQueueLeave(socket, { userId: 'user-forjado' });
      expect(matchmakingService.leave).toHaveBeenCalledWith('user-real');
    });

    it('queue:accept usa o userId autenticado e o matchId do payload', async () => {
      const socket = fakeSocket({ data: { userId: 'user-real' } });
      await gateway.onQueueAccept(socket, { matchId: 'match-1' });
      expect(matchmakingService.accept).toHaveBeenCalledWith('user-real', 'match-1');
    });
  });

  describe('rate limiting de eventos WS (Prompt 13 — @nestjs/throttler não cobre gateways)', () => {
    it('queue:join não delega ao serviço quando o rate limiter estourou', async () => {
      wsRateLimiter.allow.mockResolvedValueOnce(false);
      const socket = fakeSocket({ data: { userId: 'user-real' } });

      await gateway.onQueueJoin(socket, { userId: 'user-real' });

      expect(wsRateLimiter.allow).toHaveBeenCalledWith(
        'queue:join:user-real',
        expect.any(Number),
        expect.any(Number),
      );
      expect(matchmakingService.join).not.toHaveBeenCalled();
    });
  });
});

describe('ZodValidationPipe aplicado a queue:join no gateway', () => {
  it('rejeita payload malformado (userId ausente/inválido)', () => {
    const pipe = new ZodValidationPipe(QueueJoinPayloadSchema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
    expect(() => pipe.transform({ userId: 'não-é-um-uuid' })).toThrow(BadRequestException);
  });

  it('aceita payload válido', () => {
    const pipe = new ZodValidationPipe(QueueJoinPayloadSchema);
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(pipe.transform({ userId: uuid })).toEqual({ userId: uuid });
  });
});
