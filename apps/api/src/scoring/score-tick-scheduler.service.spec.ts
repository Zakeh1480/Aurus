import type { AuraFeatures, AuraScore } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AiScoreClientService } from './ai-score-client.service';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';

const DUE_ZSET_KEY = 'score:tick:due';

const FEATURES: AuraFeatures = {
  posture: 0.5,
  eyeContact: 0.5,
  expression: 0.5,
  presence: 0.5,
  movement: 0.5,
  sequence: 0,
  capturedAt: '2026-01-01T00:00:00.000Z',
};

const SCORE: AuraScore = {
  overall: 0.6,
  breakdown: { posture: 0.6, eyeContact: 0.6, expression: 0.6, presence: 0.6, movement: 0.6 },
  version: 'aura-score-v1',
  computedAt: '2026-01-01T00:00:00.000Z',
};

describe('ScoreTickSchedulerService', () => {
  describe('chamadas Redis (shape)', () => {
    let redis: {
      zadd: ReturnType<typeof vi.fn>;
      zrem: ReturnType<typeof vi.fn>;
      zrangebyscore: ReturnType<typeof vi.fn>;
      eval: ReturnType<typeof vi.fn>;
    };
    let prisma: {
      match: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    };
    let sampleBuffer: { readLatest: ReturnType<typeof vi.fn> };
    let aiScoreClient: { score: ReturnType<typeof vi.fn> };
    let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
    let service: ScoreTickSchedulerService;

    beforeEach(async () => {
      vi.stubEnv('MATCH_SCORE_TICK_INTERVAL_MS', '5000');

      redis = {
        zadd: vi.fn().mockResolvedValue(1),
        zrem: vi.fn().mockResolvedValue(1),
        zrangebyscore: vi.fn().mockResolvedValue([]),
        eval: vi.fn().mockResolvedValue(1),
      };
      prisma = {
        match: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'match-1',
            status: 'active',
            player1Id: 'player-1',
            player2Id: 'player-2',
          }),
          update: vi.fn().mockResolvedValue(undefined),
        },
      };
      sampleBuffer = { readLatest: vi.fn().mockResolvedValue(FEATURES) };
      aiScoreClient = { score: vi.fn().mockResolvedValue(SCORE) };
      matchmakingService = { emitToUser: vi.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          ScoreTickSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: PrismaService, useValue: prisma },
          { provide: ScoreSampleBufferService, useValue: sampleBuffer },
          { provide: AiScoreClientService, useValue: aiScoreClient },
          { provide: MatchmakingService, useValue: matchmakingService },
        ],
      }).compile();
      service = moduleRef.get(ScoreTickSchedulerService);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('ensureScheduledForMatch agenda com ZADD NX usando tickIntervalMs a partir de agora', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      service.ensureScheduledForMatch('match-1');
      expect(redis.zadd).toHaveBeenCalledWith(DUE_ZSET_KEY, 'NX', 1_000_000 + 5000, 'match-1');
    });

    it('cancel remove com ZREM', () => {
      service.cancel('match-1');
      expect(redis.zrem).toHaveBeenCalledWith(DUE_ZSET_KEY, 'match-1');
    });

    it('scheduleForMatch/cancel não lançam quando o Redis rejeita (fire-and-forget)', async () => {
      redis.zadd.mockRejectedValue(new Error('redis indisponível'));
      redis.zrem.mockRejectedValue(new Error('redis indisponível'));
      expect(() => service.ensureScheduledForMatch('match-1')).not.toThrow();
      expect(() => service.cancel('match-1')).not.toThrow();
      await vi.waitFor(() => expect(redis.zadd).toHaveBeenCalled());
      await vi.waitFor(() => expect(redis.zrem).toHaveBeenCalled());
    });

    it('pollDueTicks varre com ZRANGEBYSCORE e só processa o tick quando o script de claim retorna 1', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      redis.zrangebyscore.mockResolvedValueOnce(['match-1', 'match-2']).mockResolvedValueOnce([]);
      redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await service.pollDueTicks();

      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        DUE_ZSET_KEY,
        '-inf',
        1_000_000,
        'LIMIT',
        0,
        50,
      );
      expect(redis.eval).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        1,
        DUE_ZSET_KEY,
        'match-1',
        1_000_000,
        1_000_000 + 5000,
      );
      expect(redis.eval).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        1,
        DUE_ZSET_KEY,
        'match-2',
        1_000_000,
        1_000_000 + 5000,
      );

      expect(prisma.match.findUnique).toHaveBeenCalledWith({ where: { id: 'match-1' } });

      expect(prisma.match.findUnique).not.toHaveBeenCalledWith({ where: { id: 'match-2' } });
    });

    it('pollDueTicks drena em loop até uma página vir menor que o lote', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => `match-${i}`);
      redis.zrangebyscore.mockResolvedValueOnce(fullPage).mockResolvedValueOnce(['match-last']);
      redis.eval.mockResolvedValue(1);

      await service.pollDueTicks();

      expect(redis.zrangebyscore).toHaveBeenCalledTimes(2);
    });
  });

  describe('agendar → poll → tick (comportamento)', () => {
    function fakeScoreTickRedis() {
      const zset = new Map<string, number>();
      return {
        zadd: vi.fn(async (_key: string, flag: string, score: number, member: string) => {
          if (flag === 'NX' && zset.has(member)) return 0;
          zset.set(member, score);
          return 1;
        }),
        zrem: vi.fn(async (_key: string, member: string) => (zset.delete(member) ? 1 : 0)),
        zrangebyscore: vi.fn(
          async (
            _key: string,
            _min: string,
            max: number,
            _limitKeyword: string,
            offset: number,
            limit: number,
          ) =>
            [...zset.entries()]
              .filter(([, score]) => score <= max)
              .sort((a, b) => a[1] - b[1])
              .slice(offset, offset + limit)
              .map(([matchId]) => matchId),
        ),
        eval: vi.fn(
          async (
            _script: string,
            _numKeys: number,
            _key: string,
            matchId: string,
            now: number,
            nextDueAtMs: number,
          ) => {
            const score = zset.get(matchId);
            if (score === undefined) return 0;
            if (score > now) return 0;
            zset.set(matchId, nextDueAtMs);
            return 1;
          },
        ),
      };
    }

    async function buildService(
      redis: ReturnType<typeof fakeScoreTickRedis>,
      prisma: { match: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } },
      sampleBuffer: { readLatest: ReturnType<typeof vi.fn> },
      aiScoreClient: { score: ReturnType<typeof vi.fn> },
      matchmakingService: { emitToUser: ReturnType<typeof vi.fn> },
    ): Promise<ScoreTickSchedulerService> {
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScoreTickSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: PrismaService, useValue: prisma },
          { provide: ScoreSampleBufferService, useValue: sampleBuffer },
          { provide: AiScoreClientService, useValue: aiScoreClient },
          { provide: MatchmakingService, useValue: matchmakingService },
        ],
      }).compile();
      return moduleRef.get(ScoreTickSchedulerService);
    }

    let redis: ReturnType<typeof fakeScoreTickRedis>;
    let prisma: {
      match: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    };
    let sampleBuffer: { readLatest: ReturnType<typeof vi.fn> };
    let aiScoreClient: { score: ReturnType<typeof vi.fn> };
    let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
    let service: ScoreTickSchedulerService;

    beforeEach(async () => {
      vi.stubEnv('MATCH_SCORE_TICK_INTERVAL_MS', '1000');

      redis = fakeScoreTickRedis();
      prisma = {
        match: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'match-1',
            status: 'active',
            player1Id: 'player-1',
            player2Id: 'player-2',
          }),
          update: vi.fn().mockResolvedValue(undefined),
        },
      };
      sampleBuffer = { readLatest: vi.fn().mockResolvedValue(FEATURES) };
      aiScoreClient = { score: vi.fn().mockResolvedValue(SCORE) };
      matchmakingService = { emitToUser: vi.fn() };
      service = await buildService(redis, prisma, sampleBuffer, aiScoreClient, matchmakingService);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('não emite enquanto algum jogador ainda não mandou nenhuma amostra', async () => {
      sampleBuffer.readLatest.mockResolvedValueOnce(null).mockResolvedValueOnce(FEATURES);
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();

      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
    });

    it('emite match:score-tick para os dois jogadores quando ambos têm amostra', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();

      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2);
      const [userId, event, payload] = matchmakingService.emitToUser.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(userId).toBe('player-1');
      expect(event).toBe('match:score-tick');
      expect(payload).toMatchObject({
        matchId: 'match-1',
        scores: [
          { userId: 'player-1', liveScore: 0.6 },
          { userId: 'player-2', liveScore: 0.6 },
        ],
      });
    });

    it('grava o estado ao vivo (features/score) no Match a cada tick', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');
      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: {
          featuresPlayer1: FEATURES,
          featuresPlayer2: FEATURES,
          scorePlayer1: SCORE,
          scorePlayer2: SCORE,
        },
      });
    });

    it('para de emitir e cancela o agendamento quando a partida deixa de estar active', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: 'completed',
        player1Id: 'player-1',
        player2Id: 'player-2',
      });
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();
      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();

      vi.spyOn(Date, 'now').mockReturnValue(2000);
      await service.pollDueTicks();
      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
    });

    it('ensureScheduledForMatch é idempotente — chamar duas vezes não duplica o agendamento', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');
      service.ensureScheduledForMatch('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();

      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2);
    });

    it('cancel() impede ticks futuros', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');
      service.cancel('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();

      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
    });

    it('continua tickando no ciclo seguinte (cadência recorrente)', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();
      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2);

      vi.spyOn(Date, 'now').mockReturnValue(2000);
      await service.pollDueTicks();
      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(4);
    });

    it('duas réplicas competindo pelo mesmo tick vencido: só uma processa', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1');

      const serviceReplicaB = await buildService(
        redis,
        prisma,
        sampleBuffer,
        aiScoreClient,
        matchmakingService,
      );

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueTicks();
      await serviceReplicaB.pollDueTicks();

      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2);
    });
  });
});
