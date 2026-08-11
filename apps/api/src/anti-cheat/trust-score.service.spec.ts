import type { VerifyResponse } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TrustScoreService } from './trust-score.service';

const MATCH_ID = '123e4567-e89b-12d3-a456-426614174000';
const USER_A = '223e4567-e89b-12d3-a456-426614174001';
const USER_B = '323e4567-e89b-12d3-a456-426614174002';

function verifyResponse(
  overrides: Partial<VerifyResponse['liveness']> = {},
  discrepancy = 0.05,
): VerifyResponse {
  return {
    matchId: MATCH_ID,
    userId: USER_A,
    challengeId: 'challenge-1',
    discrepancy,
    discrepancyConfidence: 1.0,
    liveness: {
      noFaceDetected: false,
      staticImageSuspected: false,
      lowDetailSuspected: false,
      multipleFacesDetected: false,
      ...overrides,
    },
    version: 'anti-cheat-v1',
    computedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TrustScoreService', () => {
  let redis: {
    hincrby: ReturnType<typeof vi.fn>;
    hincrbyfloat: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    hgetall: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    match: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
    antiCheatIncident: { upsert: ReturnType<typeof vi.fn> };
    report: { upsert: ReturnType<typeof vi.fn> };
  };
  let service: TrustScoreService;
  let store: Record<string, Record<string, string>>;

  beforeEach(async () => {
    store = {};
    redis = {
      hincrby: vi.fn(async (key: string, field: string, amount: number) => {
        store[key] ??= {};
        store[key][field] = String(Number(store[key][field] ?? 0) + amount);
      }),
      hincrbyfloat: vi.fn(async (key: string, field: string, amount: number) => {
        store[key] ??= {};
        store[key][field] = String(Number(store[key][field] ?? 0) + amount);
      }),
      expire: vi.fn(),
      hgetall: vi.fn(async (key: string) => store[key] ?? {}),
    };
    prisma = {
      match: { findUniqueOrThrow: vi.fn() },

      antiCheatIncident: { upsert: vi.fn().mockResolvedValue({ id: 'incident-1' }) },
      report: { upsert: vi.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        { provide: RedisService, useValue: redis },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TrustScoreService);
  });

  describe('assessParticipant', () => {
    it('nenhum sinal registrado ainda: trust alto (neutro), decisão válida', async () => {
      const assessment = await service.assessParticipant(MATCH_ID, USER_A);
      expect(assessment.trustLevel).toBe('high');
      expect(assessment.decision).toBe('valid');
      expect(assessment.discrepancyAvg).toBeNull();
    });

    it('discrepância alta + flags de liveness ruins: trust baixo, decisão descartada', async () => {
      await service.recordChallengeIssued(MATCH_ID, USER_A);
      await service.recordVerifyResult(
        MATCH_ID,
        USER_A,
        verifyResponse({ staticImageSuspected: true, noFaceDetected: true }, 0.95),
      );

      const assessment = await service.assessParticipant(MATCH_ID, USER_A);
      expect(assessment.trustLevel).toBe('low');
      expect(assessment.decision).toBe('discarded');
    });

    it('pacotes de features majoritariamente rejeitados (assinatura errada): penaliza o trust, mas isoladamente não é suficiente para descartar', async () => {
      const baseline = await service.assessParticipant(MATCH_ID, USER_A);
      for (let i = 0; i < 10; i += 1) {
        await service.recordRejectedPacket(MATCH_ID, USER_A);
      }
      const assessment = await service.assessParticipant(MATCH_ID, USER_A);
      expect(assessment.rejectedPacketRatio).toBe(1);
      expect(assessment.trustScore).toBeLessThan(baseline.trustScore);
    });

    it('violações temporais repetidas penalizam o trust, mas isoladamente não é suficiente para descartar', async () => {
      const baseline = await service.assessParticipant(MATCH_ID, USER_A);
      for (let i = 0; i < 10; i += 1) {
        await service.recordAcceptedPacket(MATCH_ID, USER_A, true);
      }
      const assessment = await service.assessParticipant(MATCH_ID, USER_A);
      expect(assessment.temporalViolationCount).toBe(10);
      expect(assessment.trustScore).toBeLessThan(baseline.trustScore);
    });

    it('tudo limpo (desafios respondidos sem flags, sem pacotes rejeitados): decisão válida', async () => {
      await service.recordChallengeIssued(MATCH_ID, USER_A);
      await service.recordChallengeIssued(MATCH_ID, USER_A);
      await service.recordVerifyResult(MATCH_ID, USER_A, verifyResponse({}, 0.02));
      await service.recordVerifyResult(MATCH_ID, USER_A, verifyResponse({}, 0.03));
      await service.recordAcceptedPacket(MATCH_ID, USER_A, false);
      await service.recordAcceptedPacket(MATCH_ID, USER_A, false);

      const assessment = await service.assessParticipant(MATCH_ID, USER_A);
      expect(assessment.decision).toBe('valid');
    });
  });

  describe('getMatchDecision', () => {
    it('overallDecision é o pior caso entre os dois participantes, e só o descartado gera incidente', async () => {
      prisma.match.findUniqueOrThrow.mockResolvedValue({
        id: MATCH_ID,
        player1Id: USER_A,
        player2Id: USER_B,
      });

      await service.recordChallengeIssued(MATCH_ID, USER_B);
      await service.recordVerifyResult(
        MATCH_ID,
        USER_B,
        verifyResponse({ staticImageSuspected: true, noFaceDetected: true }, 0.95),
      );

      const result = await service.getMatchDecision(MATCH_ID);

      expect(result.player1.userId).toBe(USER_A);
      expect(result.player1.decision).toBe('valid');
      expect(result.player2.userId).toBe(USER_B);
      expect(result.player2.decision).toBe('discarded');
      expect(result.overallDecision).toBe('discarded');

      expect(prisma.antiCheatIncident.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.antiCheatIncident.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId_userId: { matchId: MATCH_ID, userId: USER_B } },
        }),
      );

      expect(prisma.report.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.report.upsert).toHaveBeenCalledWith({
        where: { antiCheatIncidentId: 'incident-1' },
        create: expect.objectContaining({
          reportedId: USER_B,
          matchId: MATCH_ID,
          antiCheatIncidentId: 'incident-1',
          source: 'anti_cheat',
          reason: 'cheating',
        }),
        update: {},
      });
    });

    it('quando ambos são válidos, nenhum incidente nem report são persistidos', async () => {
      prisma.match.findUniqueOrThrow.mockResolvedValue({
        id: MATCH_ID,
        player1Id: USER_A,
        player2Id: USER_B,
      });

      const result = await service.getMatchDecision(MATCH_ID);

      expect(result.overallDecision).toBe('valid');
      expect(prisma.antiCheatIncident.upsert).not.toHaveBeenCalled();
      expect(prisma.report.upsert).not.toHaveBeenCalled();
    });
  });
});
