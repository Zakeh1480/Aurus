import { MatchForfeitPayloadSchema } from '@aurafarming/shared';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';
import { MatchForfeitGateway } from './match-forfeit.gateway';
import { ScoringService } from '../scoring/scoring.service';

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

describe('MatchForfeitGateway', () => {
  let gateway: MatchForfeitGateway;
  let scoringService: { forfeitMatch: ReturnType<typeof vi.fn> };
  let livekit: { deleteRoom: ReturnType<typeof vi.fn> };
  let matchDurationScheduler: { cancel: ReturnType<typeof vi.fn> };
  let wsRateLimiter: { allow: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    scoringService = { forfeitMatch: vi.fn().mockResolvedValue(undefined) };
    livekit = { deleteRoom: vi.fn().mockResolvedValue(undefined) };
    matchDurationScheduler = { cancel: vi.fn() };
    wsRateLimiter = { allow: vi.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchForfeitGateway,
        { provide: ScoringService, useValue: scoringService },
        { provide: LivekitService, useValue: livekit },
        { provide: MatchDurationSchedulerService, useValue: matchDurationScheduler },
        { provide: WsRateLimiterService, useValue: wsRateLimiter },
      ],
    }).compile();

    gateway = moduleRef.get(MatchForfeitGateway);
  });

  it('usa o userId autenticado (não payload.userId) para desistir e encerra a room', async () => {
    const socket = fakeSocket({ data: { userId: 'user-real' } });

    await gateway.onForfeit(socket, { matchId: 'match-1', userId: 'user-forjado' });

    expect(scoringService.forfeitMatch).toHaveBeenCalledWith('match-1', 'user-real');
    expect(livekit.deleteRoom).toHaveBeenCalledWith('match-1');
    expect(matchDurationScheduler.cancel).toHaveBeenCalledWith('match-1');
  });

  it('não delega ao serviço quando o rate limiter estourou', async () => {
    wsRateLimiter.allow.mockResolvedValueOnce(false);
    const socket = fakeSocket({ data: { userId: 'user-real' } });

    await gateway.onForfeit(socket, { matchId: 'match-1', userId: 'user-real' });

    expect(wsRateLimiter.allow).toHaveBeenCalledWith(
      'match:forfeit:user-real',
      expect.any(Number),
      expect.any(Number),
    );
    expect(scoringService.forfeitMatch).not.toHaveBeenCalled();
    expect(livekit.deleteRoom).not.toHaveBeenCalled();
  });
});

describe('ZodValidationPipe aplicado a match:forfeit no gateway', () => {
  it('rejeita payload malformado (matchId ausente/inválido)', () => {
    const pipe = new ZodValidationPipe(MatchForfeitPayloadSchema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
    expect(() => pipe.transform({ matchId: 'não-é-um-uuid', userId: 'também-não' })).toThrow(
      BadRequestException,
    );
  });

  it('aceita payload válido', () => {
    const pipe = new ZodValidationPipe(MatchForfeitPayloadSchema);
    const matchId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = '223e4567-e89b-12d3-a456-426614174001';
    expect(pipe.transform({ matchId, userId })).toEqual({ matchId, userId });
  });
});
