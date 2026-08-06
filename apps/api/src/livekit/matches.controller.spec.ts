import type { User } from '@aurafarming/shared';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';
import { MatchesController } from './matches.controller';

const USER_A = '123e4567-e89b-12d3-a456-426614174000';
const USER_B = '223e4567-e89b-12d3-a456-426614174001';
const USER_C = '323e4567-e89b-12d3-a456-426614174002';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_A,
    email: 'player@example.com',
    displayName: 'Player One',
    avatarUrl: null,
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const VALID_AURA_SCORE = {
  overall: 0.72,
  breakdown: { posture: 0.8, eyeContact: 0.7, expression: 0.6, presence: 0.9, movement: 0.5 },
  version: 'aura-score-v1' as const,
  computedAt: '2026-01-01T00:10:00.000Z',
};

describe('MatchesController', () => {
  let controller: MatchesController;
  let prisma: {
    match: { findUnique: ReturnType<typeof vi.fn> };
    matchResult: { findUnique: ReturnType<typeof vi.fn> };
  };
  let livekit: {
    ensureRoom: ReturnType<typeof vi.fn>;
    createToken: ReturnType<typeof vi.fn>;
    publicUrl: string;
  };
  let matchDurationScheduler: { scheduleForMatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { match: { findUnique: vi.fn() }, matchResult: { findUnique: vi.fn() } };
    livekit = {
      ensureRoom: vi.fn().mockResolvedValue(undefined),
      createToken: vi.fn().mockResolvedValue({
        token: 'jwt.token.value',
        expiresAt: new Date('2026-01-01T02:00:00.000Z'),
      }),
      publicUrl: 'wss://aurafarming.livekit.cloud',
    };
    matchDurationScheduler = { scheduleForMatch: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: LivekitService, useValue: livekit },
        { provide: MatchDurationSchedulerService, useValue: matchDurationScheduler },
      ],
    }).compile();

    controller = moduleRef.get(MatchesController);
  });

  it('emite o token quando o usuário é player1 de uma partida active', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      player1Id: USER_A,
      player2Id: USER_B,
      status: 'active',
      startedAt,
    });

    const result = await controller.issueToken('match-1', buildUser({ id: USER_A }));

    expect(livekit.ensureRoom).toHaveBeenCalledWith('match-1');
    expect(matchDurationScheduler.scheduleForMatch).toHaveBeenCalledWith('match-1', startedAt);
    expect(livekit.createToken).toHaveBeenCalledWith('match-1', USER_A);
    expect(result).toEqual({
      token: 'jwt.token.value',
      url: 'wss://aurafarming.livekit.cloud',
      roomName: 'match-1',
      identity: USER_A,
      expiresAt: '2026-01-01T02:00:00.000Z',
    });
  });

  it('emite o token quando o usuário é player2 de uma partida active', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      player1Id: USER_A,
      player2Id: USER_B,
      status: 'active',
    });

    await expect(
      controller.issueToken('match-1', buildUser({ id: USER_B })),
    ).resolves.toMatchObject({
      identity: USER_B,
    });
  });

  it('lança 404 quando a partida não existe', async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    await expect(controller.issueToken('match-inexistente', buildUser())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(livekit.createToken).not.toHaveBeenCalled();
  });

  it('lança 403 quando o usuário autenticado não participa da partida', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      player1Id: USER_A,
      player2Id: USER_B,
      status: 'active',
    });

    await expect(
      controller.issueToken('match-1', buildUser({ id: USER_C })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(livekit.createToken).not.toHaveBeenCalled();
  });

  it('lança 409 quando a partida ainda não está active', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 'match-1',
      player1Id: USER_A,
      player2Id: USER_B,
      status: 'pending',
    });

    await expect(
      controller.issueToken('match-1', buildUser({ id: USER_A })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(livekit.createToken).not.toHaveBeenCalled();
  });

  describe('getScoreExplanation', () => {
    const MATCH_ID = '423e4567-e89b-12d3-a456-426614174003';

    function buildMatchResult() {
      return {
        matchId: MATCH_ID,
        player1Id: USER_A,
        player1Score: VALID_AURA_SCORE,
        player1RatingDelta: 12,
        player2Id: USER_B,
        player2Score: VALID_AURA_SCORE,
        player2RatingDelta: -12,
        winnerId: USER_A,
      };
    }

    it('retorna o breakdown com peso/contribuição para um participante', async () => {
      prisma.matchResult.findUnique.mockResolvedValue(buildMatchResult());

      const result = await controller.getScoreExplanation(MATCH_ID, buildUser({ id: USER_A }));

      expect(result.matchId).toBe(MATCH_ID);
      expect(result.scoreVersion).toBe('aura-score-v1');
      expect(result.player1.metrics).toHaveLength(5);
      expect(result.player1.metrics[0]).toMatchObject({ key: 'posture', raw: 0.8, weight: 0.3 });
      expect(result.player2.ratingDelta).toBe(-12);
    });

    it('permite acesso de um moderador que não é participante da partida', async () => {
      prisma.matchResult.findUnique.mockResolvedValue(buildMatchResult());

      await expect(
        controller.getScoreExplanation(MATCH_ID, buildUser({ id: USER_C, role: 'moderator' })),
      ).resolves.toMatchObject({ matchId: MATCH_ID });
    });

    it('lança 403 para um terceiro sem role de moderador', async () => {
      prisma.matchResult.findUnique.mockResolvedValue(buildMatchResult());

      await expect(
        controller.getScoreExplanation(MATCH_ID, buildUser({ id: USER_C })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança 404 quando o resultado da partida ainda não existe', async () => {
      prisma.matchResult.findUnique.mockResolvedValue(null);

      await expect(
        controller.getScoreExplanation(MATCH_ID, buildUser({ id: USER_A })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
