import {
  AURA_SCORE_VERSION,
  type AuraFeatures,
  type AuraScore,
  type MatchTrustDecision,
} from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AntiCheatService } from '../anti-cheat/anti-cheat.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { AiScoreClientService } from './ai-score-client.service';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';
import { ScoringService } from './scoring.service';

const MATCH_ID = '923e4567-e89b-12d3-a456-426614174099';
const PLAYER_1 = '123e4567-e89b-12d3-a456-426614174000';
const PLAYER_2 = '223e4567-e89b-12d3-a456-426614174001';
const RESULT_ID = '523e4567-e89b-12d3-a456-426614174005';

const SAMPLE: AuraFeatures = {
  posture: 0.5,
  eyeContact: 0.5,
  expression: 0.5,
  presence: 0.5,
  movement: 0.5,
  sequence: 0,
  capturedAt: '2026-01-01T00:00:00.000Z',
};

function buildScore(overall: number): AuraScore {
  return {
    overall,
    breakdown: {
      posture: overall,
      eyeContact: overall,
      expression: overall,
      presence: overall,
      movement: overall,
    },
    version: 'aura-score-v1',
    computedAt: '2026-01-01T00:05:00.000Z',
  };
}

function buildTrustAssessment(userId: string, decision: 'valid' | 'flagged' | 'discarded') {
  return {
    matchId: MATCH_ID,
    userId,
    trustScore: decision === 'valid' ? 0.9 : decision === 'flagged' ? 0.5 : 0.1,
    trustLevel:
      decision === 'valid'
        ? ('high' as const)
        : decision === 'flagged'
          ? ('medium' as const)
          : ('low' as const),
    decision,
    discrepancyAvg: 0.05,
    livenessFlagCounts: {
      noFaceDetectedCount: 0,
      staticImageSuspectedCount: 0,
      lowDetailSuspectedCount: 0,
      multipleFacesDetectedCount: 0,
      duplicateKeyframeCount: 0,
    },
    rejectedPacketRatio: 0,
    temporalViolationCount: 0,
    challengesIssued: 2,
    challengesAnswered: 2,
    version: 'anti-cheat-v1' as const,
    evaluatedAt: '2026-01-01T00:05:00.000Z',
  };
}

function buildDecision(overallDecision: 'valid' | 'flagged' | 'discarded'): MatchTrustDecision {
  return {
    matchId: MATCH_ID,
    player1: buildTrustAssessment(PLAYER_1, overallDecision),
    player2: buildTrustAssessment(PLAYER_2, overallDecision),
    overallDecision,
    evaluatedAt: '2026-01-01T00:05:00.000Z',
  };
}

describe('ScoringService.finalizeMatch', () => {
  let prisma: {
    match: { findUnique: ReturnType<typeof vi.fn> };
    matchParticipant: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let tx: {
    profile: { findUniqueOrThrow: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    matchResult: { create: ReturnType<typeof vi.fn> };
    matchParticipant: { update: ReturnType<typeof vi.fn> };
    match: { update: ReturnType<typeof vi.fn> };
  };
  let antiCheatService: { getMatchDecision: ReturnType<typeof vi.fn> };
  let sampleBuffer: { readSamples: ReturnType<typeof vi.fn> };
  let aiScoreClient: { aggregate: ReturnType<typeof vi.fn> };
  let scoreTickScheduler: { cancel: ReturnType<typeof vi.fn> };
  let matchmakingService: {
    emitToUser: ReturnType<typeof vi.fn>;
    endActiveMatch: ReturnType<typeof vi.fn>;
  };
  let rankingService: { recordMatchResult: ReturnType<typeof vi.fn> };
  let service: ScoringService;

  beforeEach(async () => {
    tx = {
      profile: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            userId: PLAYER_1,
            nickname: 'Player One',
            auraScoreAvg: null,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
          })
          .mockResolvedValueOnce({
            userId: PLAYER_2,
            nickname: 'Player Two',
            auraScoreAvg: null,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
          }),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            userId: PLAYER_1,
            nickname: 'Player One',
            rating: 1016,
            auraScoreAvg: 0.8,
            matchesPlayed: 1,
            wins: 1,
            losses: 0,
          })
          .mockResolvedValueOnce({
            userId: PLAYER_2,
            nickname: 'Player Two',
            rating: 984,
            auraScoreAvg: 0.4,
            matchesPlayed: 1,
            wins: 0,
            losses: 1,
          }),
      },
      matchResult: {
        create: vi
          .fn()
          .mockResolvedValue({ id: RESULT_ID, createdAt: new Date('2026-01-01T00:05:01.000Z') }),
      },
      matchParticipant: { update: vi.fn().mockResolvedValue(undefined) },
      match: { update: vi.fn().mockResolvedValue(undefined) },
    };

    prisma = {
      match: {
        findUnique: vi.fn().mockResolvedValue({
          id: MATCH_ID,
          status: 'active',
          player1Id: PLAYER_1,
          player2Id: PLAYER_2,
        }),
      },
      matchParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { matchId: MATCH_ID, userId: PLAYER_1, ratingBefore: 1000 },
          { matchId: MATCH_ID, userId: PLAYER_2, ratingBefore: 1000 },
        ]),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
    };

    antiCheatService = { getMatchDecision: vi.fn().mockResolvedValue(buildDecision('valid')) };
    sampleBuffer = { readSamples: vi.fn().mockResolvedValue([SAMPLE, SAMPLE]) };
    aiScoreClient = {
      aggregate: vi
        .fn()
        .mockResolvedValueOnce(buildScore(0.8))
        .mockResolvedValueOnce(buildScore(0.4)),
    };
    scoreTickScheduler = { cancel: vi.fn() };
    matchmakingService = {
      emitToUser: vi.fn(),
      endActiveMatch: vi.fn().mockResolvedValue(undefined),
    };
    rankingService = { recordMatchResult: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: prisma },
        { provide: AntiCheatService, useValue: antiCheatService },
        { provide: ScoreSampleBufferService, useValue: sampleBuffer },
        { provide: AiScoreClientService, useValue: aiScoreClient },
        { provide: ScoreTickSchedulerService, useValue: scoreTickScheduler },
        { provide: MatchmakingService, useValue: matchmakingService },
        { provide: RankingService, useValue: rankingService },
      ],
    }).compile();
    service = moduleRef.get(ScoringService);
  });

  it('partida simulada ponta-a-ponta: agrega score, persiste resultado, atualiza rating e ranking, emite end+result', async () => {
    await service.finalizeMatch(MATCH_ID);

    expect(scoreTickScheduler.cancel).toHaveBeenCalledWith(MATCH_ID);
    expect(aiScoreClient.aggregate).toHaveBeenNthCalledWith(1, [SAMPLE, SAMPLE]);
    expect(aiScoreClient.aggregate).toHaveBeenNthCalledWith(2, [SAMPLE, SAMPLE]);

    expect(tx.matchResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: MATCH_ID,
        player1Id: PLAYER_1,
        player2Id: PLAYER_2,
        player1RatingDelta: 16,
        player2RatingDelta: -16,
        winnerId: PLAYER_1,
      }) as unknown,
    });
    expect(tx.matchParticipant.update).toHaveBeenCalledWith({
      where: { matchId_userId: { matchId: MATCH_ID, userId: PLAYER_1 } },
      data: { ratingAfter: 1016 },
    });
    expect(tx.matchParticipant.update).toHaveBeenCalledWith({
      where: { matchId_userId: { matchId: MATCH_ID, userId: PLAYER_2 } },
      data: { ratingAfter: 984 },
    });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: MATCH_ID },

      data: expect.objectContaining({
        status: 'completed',
        winnerId: PLAYER_1,
        scoreVersion: AURA_SCORE_VERSION,
      }) as unknown,
    });

    expect(rankingService.recordMatchResult).toHaveBeenCalledWith([
      {
        userId: PLAYER_1,
        displayName: 'Player One',
        rating: 1016,
        auraScoreAvg: 0.8,
        matchesPlayed: 1,
      },
      {
        userId: PLAYER_2,
        displayName: 'Player Two',
        rating: 984,
        auraScoreAvg: 0.4,
        matchesPlayed: 1,
      },
    ]);

    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      1,
      PLAYER_1,
      'match:end',
      expect.objectContaining({ matchId: MATCH_ID, reason: 'completed' }),
    );
    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      2,
      PLAYER_2,
      'match:end',
      expect.objectContaining({ matchId: MATCH_ID, reason: 'completed' }),
    );
    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      3,
      PLAYER_1,
      'match:result',
      expect.objectContaining({ matchId: MATCH_ID, winnerId: PLAYER_1 }),
    );
    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      4,
      PLAYER_2,
      'match:result',
      expect.objectContaining({ matchId: MATCH_ID, winnerId: PLAYER_1 }),
    );
    expect(matchmakingService.endActiveMatch).not.toHaveBeenCalled();
  });

  it('decisão discarded (trust score baixo): descarta sem tocar rating/ranking', async () => {
    antiCheatService.getMatchDecision.mockResolvedValue(buildDecision('discarded'));

    await service.finalizeMatch(MATCH_ID);

    expect(matchmakingService.endActiveMatch).toHaveBeenCalledWith(MATCH_ID, 'disconnected');
    expect(aiScoreClient.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(rankingService.recordMatchResult).not.toHaveBeenCalled();
    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });

  it('decisão flagged: segue o caminho normal (só discarded bloqueia)', async () => {
    antiCheatService.getMatchDecision.mockResolvedValue(buildDecision('flagged'));

    await service.finalizeMatch(MATCH_ID);

    expect(matchmakingService.endActiveMatch).not.toHaveBeenCalled();
    expect(rankingService.recordMatchResult).toHaveBeenCalled();
  });

  it('amostra zero de um jogador: mesmo caminho de descarte, sem chamar a IA', async () => {
    sampleBuffer.readSamples.mockResolvedValueOnce([SAMPLE]).mockResolvedValueOnce([]);

    await service.finalizeMatch(MATCH_ID);

    expect(matchmakingService.endActiveMatch).toHaveBeenCalledWith(MATCH_ID, 'disconnected');
    expect(aiScoreClient.aggregate).not.toHaveBeenCalled();
    expect(rankingService.recordMatchResult).not.toHaveBeenCalled();
  });

  it('idempotente: não faz nada se a partida já não está active', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: MATCH_ID,
      status: 'completed',
      player1Id: PLAYER_1,
      player2Id: PLAYER_2,
    });

    await service.finalizeMatch(MATCH_ID);

    expect(antiCheatService.getMatchDecision).not.toHaveBeenCalled();
    expect(scoreTickScheduler.cancel).not.toHaveBeenCalled();
  });

  it('idempotente: corrida perdida (P2002 no matchResult.create) vira no-op silencioso', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(service.finalizeMatch(MATCH_ID)).resolves.toBeUndefined();
    expect(rankingService.recordMatchResult).not.toHaveBeenCalled();
    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });
});

describe('ScoringService.forfeitMatch', () => {
  let prisma: {
    match: { findUnique: ReturnType<typeof vi.fn> };
    matchParticipant: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let tx: {
    profile: { findUniqueOrThrow: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    matchResult: { create: ReturnType<typeof vi.fn> };
    matchParticipant: { update: ReturnType<typeof vi.fn> };
    match: { update: ReturnType<typeof vi.fn> };
  };
  let antiCheatService: { getMatchDecision: ReturnType<typeof vi.fn> };
  let sampleBuffer: { readSamples: ReturnType<typeof vi.fn> };
  let aiScoreClient: { aggregate: ReturnType<typeof vi.fn> };
  let scoreTickScheduler: { cancel: ReturnType<typeof vi.fn> };
  let matchmakingService: {
    emitToUser: ReturnType<typeof vi.fn>;
    endActiveMatch: ReturnType<typeof vi.fn>;
  };
  let rankingService: { recordMatchResult: ReturnType<typeof vi.fn> };
  let service: ScoringService;

  beforeEach(async () => {
    tx = {
      profile: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            userId: PLAYER_1,
            nickname: 'Player One',
            auraScoreAvg: 0.7,
            matchesPlayed: 3,
            wins: 2,
            losses: 1,
          })
          .mockResolvedValueOnce({
            userId: PLAYER_2,
            nickname: 'Player Two',
            auraScoreAvg: 0.5,
            matchesPlayed: 5,
            wins: 1,
            losses: 4,
          }),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            userId: PLAYER_1,
            nickname: 'Player One',
            rating: 984,
            auraScoreAvg: 0.7,
            matchesPlayed: 4,
            wins: 2,
            losses: 2,
          })
          .mockResolvedValueOnce({
            userId: PLAYER_2,
            nickname: 'Player Two',
            rating: 1016,
            auraScoreAvg: 0.5,
            matchesPlayed: 6,
            wins: 2,
            losses: 4,
          }),
      },
      matchResult: {
        create: vi
          .fn()
          .mockResolvedValue({ id: RESULT_ID, createdAt: new Date('2026-01-01T00:05:01.000Z') }),
      },
      matchParticipant: { update: vi.fn().mockResolvedValue(undefined) },
      match: { update: vi.fn().mockResolvedValue(undefined) },
    };

    prisma = {
      match: {
        findUnique: vi.fn().mockResolvedValue({
          id: MATCH_ID,
          status: 'active',
          player1Id: PLAYER_1,
          player2Id: PLAYER_2,
        }),
      },
      matchParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { matchId: MATCH_ID, userId: PLAYER_1, ratingBefore: 1000 },
          { matchId: MATCH_ID, userId: PLAYER_2, ratingBefore: 1000 },
        ]),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
    };

    antiCheatService = { getMatchDecision: vi.fn().mockResolvedValue(buildDecision('valid')) };
    sampleBuffer = { readSamples: vi.fn().mockResolvedValue([SAMPLE, SAMPLE]) };
    aiScoreClient = { aggregate: vi.fn() };
    scoreTickScheduler = { cancel: vi.fn() };
    matchmakingService = {
      emitToUser: vi.fn(),
      endActiveMatch: vi.fn().mockResolvedValue(undefined),
    };
    rankingService = { recordMatchResult: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: prisma },
        { provide: AntiCheatService, useValue: antiCheatService },
        { provide: ScoreSampleBufferService, useValue: sampleBuffer },
        { provide: AiScoreClientService, useValue: aiScoreClient },
        { provide: ScoreTickSchedulerService, useValue: scoreTickScheduler },
        { provide: MatchmakingService, useValue: matchmakingService },
        { provide: RankingService, useValue: rankingService },
      ],
    }).compile();
    service = moduleRef.get(ScoringService);
  });

  it('player1 desiste: player2 é declarado vencedor, rating/wins/losses atualizados, auraScoreAvg não poluído', async () => {
    await service.forfeitMatch(MATCH_ID, PLAYER_1);

    expect(scoreTickScheduler.cancel).toHaveBeenCalledWith(MATCH_ID);
    expect(antiCheatService.getMatchDecision).not.toHaveBeenCalled();
    expect(sampleBuffer.readSamples).not.toHaveBeenCalled();
    expect(aiScoreClient.aggregate).not.toHaveBeenCalled();

    expect(tx.matchResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: MATCH_ID,
        player1Id: PLAYER_1,
        player2Id: PLAYER_2,
        player1RatingDelta: -16,
        player2RatingDelta: 16,
        winnerId: PLAYER_2,
      }) as unknown,
    });

    expect(tx.profile.update).toHaveBeenNthCalledWith(1, {
      where: { userId: PLAYER_1 },
      data: expect.objectContaining({ auraScoreAvg: 0.7, matchesPlayed: 4, losses: 2 }) as unknown,
    });
    expect(tx.profile.update).toHaveBeenNthCalledWith(2, {
      where: { userId: PLAYER_2 },
      data: expect.objectContaining({ auraScoreAvg: 0.5, matchesPlayed: 6, wins: 2 }) as unknown,
    });

    expect(rankingService.recordMatchResult).toHaveBeenCalledWith([
      {
        userId: PLAYER_1,
        displayName: 'Player One',
        rating: 984,
        auraScoreAvg: 0.7,
        matchesPlayed: 4,
      },
      {
        userId: PLAYER_2,
        displayName: 'Player Two',
        rating: 1016,
        auraScoreAvg: 0.5,
        matchesPlayed: 6,
      },
    ]);

    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      1,
      PLAYER_1,
      'match:end',
      expect.objectContaining({ matchId: MATCH_ID, reason: 'forfeited' }),
    );
    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      2,
      PLAYER_2,
      'match:end',
      expect.objectContaining({ matchId: MATCH_ID, reason: 'forfeited' }),
    );
    expect(matchmakingService.emitToUser).toHaveBeenNthCalledWith(
      3,
      PLAYER_1,
      'match:result',
      expect.objectContaining({ matchId: MATCH_ID, winnerId: PLAYER_2 }),
    );
    expect(matchmakingService.endActiveMatch).not.toHaveBeenCalled();
  });

  it('player2 desiste: player1 é declarado vencedor', async () => {
    await service.forfeitMatch(MATCH_ID, PLAYER_2);

    expect(tx.matchResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ winnerId: PLAYER_1 }) as unknown,
    });
  });

  it('idempotente: não faz nada se a partida já não está active', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: MATCH_ID,
      status: 'completed',
      player1Id: PLAYER_1,
      player2Id: PLAYER_2,
    });

    await service.forfeitMatch(MATCH_ID, PLAYER_1);

    expect(scoreTickScheduler.cancel).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('idempotente: corrida perdida (P2002 no matchResult.create) vira no-op silencioso', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(service.forfeitMatch(MATCH_ID, PLAYER_1)).resolves.toBeUndefined();
    expect(rankingService.recordMatchResult).not.toHaveBeenCalled();
    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });
});
