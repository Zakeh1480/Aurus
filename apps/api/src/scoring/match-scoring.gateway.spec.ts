import type { MatchFeaturesPayload } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { MatchScoringGateway } from './match-scoring.gateway';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';

const MATCH_ID = 'match-1';
const USER_ID = 'user-a';

function fakeSocket(userId: string): Socket {
  return { data: { userId } } as unknown as Socket;
}

function featuresPayload(overrides: Partial<MatchFeaturesPayload> = {}): MatchFeaturesPayload {
  return {
    matchId: MATCH_ID,
    userId: USER_ID,
    features: {
      posture: 0.5,
      eyeContact: 0.5,
      expression: 0.5,
      presence: 0.5,
      movement: 0.5,
      sequence: 0,
      capturedAt: new Date().toISOString(),
    },
    nonce: 'n'.repeat(16),
    signature: 's'.repeat(32),
    ...overrides,
  };
}

describe('MatchScoringGateway', () => {
  let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
  let sampleBuffer: { pushSample: ReturnType<typeof vi.fn> };
  let scoreTickScheduler: { ensureScheduledForMatch: ReturnType<typeof vi.fn> };
  let gateway: MatchScoringGateway;

  beforeEach(async () => {
    prisma = {
      match: {
        findUnique: vi.fn().mockResolvedValue({
          id: MATCH_ID,
          status: 'active',
          player1Id: 'player-1',
          player2Id: 'player-2',
        }),
      },
    };
    sampleBuffer = { pushSample: vi.fn().mockResolvedValue(undefined) };
    scoreTickScheduler = { ensureScheduledForMatch: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchScoringGateway,
        { provide: PrismaService, useValue: prisma },
        { provide: ScoreSampleBufferService, useValue: sampleBuffer },
        { provide: ScoreTickSchedulerService, useValue: scoreTickScheduler },
      ],
    }).compile();
    gateway = moduleRef.get(MatchScoringGateway);
  });

  it('empurra a amostra no buffer, ignorando payload.userId em favor de socket.data.userId', async () => {
    const payload = featuresPayload({ userId: 'outro-usuario' });
    await gateway.onFeatures(fakeSocket(USER_ID), payload);

    expect(sampleBuffer.pushSample).toHaveBeenCalledWith(MATCH_ID, USER_ID, payload.features);
  });

  it('na primeira mensagem de uma partida active, agenda o tick', async () => {
    await gateway.onFeatures(fakeSocket(USER_ID), featuresPayload());

    expect(scoreTickScheduler.ensureScheduledForMatch).toHaveBeenCalledWith(MATCH_ID);
  });

  it('não consulta o Prisma nem reagenda a partir da segunda mensagem da mesma partida', async () => {
    await gateway.onFeatures(fakeSocket(USER_ID), featuresPayload());
    await gateway.onFeatures(
      fakeSocket(USER_ID),
      featuresPayload({ features: { ...featuresPayload().features, sequence: 1 } }),
    );

    expect(prisma.match.findUnique).toHaveBeenCalledTimes(1);
    expect(scoreTickScheduler.ensureScheduledForMatch).toHaveBeenCalledTimes(1);
  });

  it('não agenda o tick quando a partida não existe mais / não está active', async () => {
    prisma.match.findUnique.mockResolvedValue({ id: MATCH_ID, status: 'completed' });
    await gateway.onFeatures(fakeSocket(USER_ID), featuresPayload());

    expect(scoreTickScheduler.ensureScheduledForMatch).not.toHaveBeenCalled();
  });
});
