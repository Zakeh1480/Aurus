import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RankingService } from './ranking.service';

const USER_A = '123e4567-e89b-12d3-a456-426614174000';
const USER_B = '223e4567-e89b-12d3-a456-426614174001';

describe('RankingService', () => {
  let redis: {
    zadd: ReturnType<typeof vi.fn>;
    zrevrank: ReturnType<typeof vi.fn>;
    zcard: ReturnType<typeof vi.fn>;
    zrevrange: ReturnType<typeof vi.fn>;
    zscore: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    rankingSnapshot: { create: ReturnType<typeof vi.fn> };
    profile: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: RankingService;

  beforeEach(async () => {
    redis = {
      zadd: vi.fn().mockResolvedValue(1),
      zrevrank: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(0),
      zrevrange: vi.fn().mockResolvedValue([]),
      zscore: vi.fn().mockResolvedValue(null),
    };
    prisma = {
      rankingSnapshot: { create: vi.fn().mockResolvedValue(undefined) },
      profile: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: RedisService, useValue: redis },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(RankingService);
  });

  describe('recordMatchResult', () => {
    it('grava cada jogador no sorted set do Redis e cria um RankingSnapshot com o rank pós-write', async () => {
      redis.zrevrank.mockResolvedValue(2);

      await service.recordMatchResult([
        {
          userId: USER_A,
          displayName: 'Player A',
          rating: 1050,
          auraScoreAvg: 0.7,
          matchesPlayed: 5,
        },
      ]);

      expect(redis.zadd).toHaveBeenCalledWith('ranking:global', 1050, USER_A);
      expect(prisma.rankingSnapshot.create).toHaveBeenCalledWith({
        data: {
          rank: 3,
          userId: USER_A,
          displayName: 'Player A',
          rating: 1050,
          auraScoreAvg: 0.7,
          matchesPlayed: 5,
        },
      });
    });

    it('processa múltiplas entradas, uma por jogador', async () => {
      await service.recordMatchResult([
        { userId: USER_A, displayName: 'A', rating: 1010, auraScoreAvg: 0.6, matchesPlayed: 1 },
        { userId: USER_B, displayName: 'B', rating: 990, auraScoreAvg: 0.4, matchesPlayed: 1 },
      ]);

      expect(redis.zadd).toHaveBeenCalledTimes(2);
      expect(prisma.rankingSnapshot.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRanking', () => {
    it('lê do Redis quando o sorted set não está vazio, hidratando via Profile', async () => {
      redis.zcard.mockResolvedValue(2);
      redis.zrevrange.mockResolvedValue([USER_A, '1200', USER_B, '1100']);
      prisma.profile.findMany.mockResolvedValue([
        {
          userId: USER_A,
          nickname: 'Player A',
          rating: 1200,
          auraScoreAvg: 0.8,
          matchesPlayed: 10,
        },
        { userId: USER_B, nickname: 'Player B', rating: 1100, auraScoreAvg: 0.6, matchesPlayed: 8 },
      ]);

      const result = await service.getRanking(20, 0);

      expect(result).toEqual({
        entries: [
          {
            rank: 1,
            userId: USER_A,
            displayName: 'Player A',
            rating: 1200,
            auraScoreAvg: 0.8,
            matchesPlayed: 10,
          },
          {
            rank: 2,
            userId: USER_B,
            displayName: 'Player B',
            rating: 1100,
            auraScoreAvg: 0.6,
            matchesPlayed: 8,
          },
        ],
        limit: 20,
        offset: 0,
        total: 2,
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('calcula rank a partir do offset, não de 1 sempre', async () => {
      redis.zcard.mockResolvedValue(5);
      redis.zrevrange.mockResolvedValue([USER_A, '1000']);
      prisma.profile.findMany.mockResolvedValue([
        { userId: USER_A, nickname: 'Player A', rating: 1000, auraScoreAvg: 0.5, matchesPlayed: 3 },
      ]);

      const result = await service.getRanking(1, 3);

      expect(result.entries[0]?.rank).toBe(4);
    });

    it('cai para o fallback do Postgres quando o sorted set está vazio', async () => {
      redis.zcard.mockResolvedValue(0);
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            userId: USER_A,
            displayName: 'Player A',
            rating: 1300,
            auraScoreAvg: 0.9,
            matchesPlayed: 20,
          },
        ])
        .mockResolvedValueOnce([{ count: 1n }]);

      const result = await service.getRanking(20, 0);

      expect(result).toEqual({
        entries: [
          {
            rank: 1,
            userId: USER_A,
            displayName: 'Player A',
            rating: 1300,
            auraScoreAvg: 0.9,
            matchesPlayed: 20,
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      });
      expect(redis.zrevrange).not.toHaveBeenCalled();
    });

    it('retorna lista vazia quando ninguém jogou ainda (Redis vazio e sem snapshots)', async () => {
      redis.zcard.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

      const result = await service.getRanking(20, 0);

      expect(result).toEqual({ entries: [], limit: 20, offset: 0, total: 0 });
    });
  });

  describe('getMyRanking', () => {
    it('lê do Redis quando o sorted set não está vazio e o usuário está nele', async () => {
      redis.zcard.mockResolvedValue(5);
      redis.zscore.mockResolvedValue('1050');
      redis.zrevrank.mockResolvedValue(3);
      prisma.profile.findUnique.mockResolvedValue({
        userId: USER_A,
        nickname: 'Player A',
        rating: 1050,
        auraScoreAvg: 0.7,
        matchesPlayed: 5,
      });

      const result = await service.getMyRanking(USER_A);

      expect(result).toEqual({
        entry: {
          rank: 4,
          userId: USER_A,
          displayName: 'Player A',
          rating: 1050,
          auraScoreAvg: 0.7,
          matchesPlayed: 5,
        },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('retorna entry null quando o Redis está quente mas o usuário nunca jogou', async () => {
      redis.zcard.mockResolvedValue(5);
      redis.zscore.mockResolvedValue(null);

      const result = await service.getMyRanking(USER_A);

      expect(result).toEqual({ entry: null });
      expect(redis.zrevrank).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('cai para o fallback do Postgres quando o sorted set está vazio, calculando o rank pelo rating', async () => {
      redis.zcard.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: USER_A,
          displayName: 'Player A',
          rating: 900,
          auraScoreAvg: 0.4,
          matchesPlayed: 2,
          rank: 3n,
        },
      ]);

      const result = await service.getMyRanking(USER_A);

      expect(result).toEqual({
        entry: {
          rank: 3,
          userId: USER_A,
          displayName: 'Player A',
          rating: 900,
          auraScoreAvg: 0.4,
          matchesPlayed: 2,
        },
      });
      expect(redis.zscore).not.toHaveBeenCalled();
    });

    it('retorna entry null quando o Postgres não tem snapshot desse usuário', async () => {
      redis.zcard.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getMyRanking(USER_A);

      expect(result).toEqual({ entry: null });
    });
  });
});
