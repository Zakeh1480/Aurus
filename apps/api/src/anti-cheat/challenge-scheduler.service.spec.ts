import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChallengeSchedulerService } from './challenge-scheduler.service';
import { NonceService } from './nonce.service';
import { TrustScoreService } from './trust-score.service';

const DUE_ZSET_KEY = 'ac:challenge-schedule:due';

function scheduleKey(matchId: string, userId: string): string {
  return `ac:match:${matchId}:user:${userId}:challenge-schedule`;
}

describe('ChallengeSchedulerService', () => {
  describe('chamadas Redis (shape)', () => {
    let redis: {
      eval: ReturnType<typeof vi.fn>;
      zrangebyscore: ReturnType<typeof vi.fn>;
      zadd: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
    };
    let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
    let nonceService: { issueChallengeNonce: ReturnType<typeof vi.fn> };
    let trustScoreService: { recordChallengeIssued: ReturnType<typeof vi.fn> };
    let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
    let service: ChallengeSchedulerService;

    beforeEach(async () => {
      vi.stubEnv('ANTI_CHEAT_CHALLENGES_MIN', '2');
      vi.stubEnv('ANTI_CHEAT_CHALLENGES_MAX', '2');
      vi.stubEnv('ANTI_CHEAT_CHALLENGE_INTERVAL_MIN_MS', '1000');
      vi.stubEnv('ANTI_CHEAT_CHALLENGE_INTERVAL_MAX_MS', '1000');

      redis = {
        eval: vi.fn().mockResolvedValue(1),
        zrangebyscore: vi.fn().mockResolvedValue([]),
        zadd: vi.fn().mockResolvedValue(1),
        del: vi.fn().mockResolvedValue(1),
      };
      prisma = {
        match: { findUnique: vi.fn().mockResolvedValue({ id: 'match-1', status: 'active' }) },
      };
      nonceService = { issueChallengeNonce: vi.fn().mockResolvedValue(undefined) };
      trustScoreService = { recordChallengeIssued: vi.fn().mockResolvedValue(undefined) };
      matchmakingService = { emitToUser: vi.fn() };

      const moduleRef = await Test.createTestingModule({
        providers: [
          ChallengeSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: PrismaService, useValue: prisma },
          { provide: NonceService, useValue: nonceService },
          { provide: TrustScoreService, useValue: trustScoreService },
          { provide: MatchmakingService, useValue: matchmakingService },
        ],
      }).compile();
      service = moduleRef.get(ChallengeSchedulerService);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('ensureScheduledForMatch cria o agendamento dos dois jogadores via eval (script de criação)', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      vi.spyOn(Math, 'random').mockReturnValue(0); // targetCount = min, delay = intervalMin

      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalledTimes(2));

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        scheduleKey('match-1', 'player-1'),
        DUE_ZSET_KEY,
        2, // challengesMin
        1_000_000, // sessionStartedAt
        'match-1:player-1',
        1_000_000 + 1000, // sessionStartedAt + challengeIntervalMinMs
      );
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        scheduleKey('match-1', 'player-2'),
        DUE_ZSET_KEY,
        2,
        1_000_000,
        'match-1:player-2',
        1_000_000 + 1000,
      );
    });

    it('ensureScheduledForMatch não agenda quando o delay sorteado já estoura maxSessionMs', async () => {
      vi.stubEnv('ANTI_CHEAT_MAX_SESSION_MS', '500'); // menor que o challengeIntervalMinMs (1000)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await Promise.resolve();
      await Promise.resolve();

      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('ensureScheduledForMatch não lança quando o Redis rejeita (fire-and-forget)', async () => {
      redis.eval.mockRejectedValue(new Error('redis indisponível'));
      expect(() =>
        service.ensureScheduledForMatch('match-1', 'player-1', 'player-2'),
      ).not.toThrow();
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());
    });

    it('pollDueChallenges varre com ZRANGEBYSCORE e reivindica cada membro vencido via eval', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      redis.zrangebyscore.mockResolvedValueOnce(['match-1:player-1']).mockResolvedValueOnce([]);
      redis.eval.mockResolvedValueOnce([1, '500000', 0]);

      await service.pollDueChallenges();

      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        DUE_ZSET_KEY,
        '-inf',
        1_000_000,
        'LIMIT',
        0,
        50,
      );
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        scheduleKey('match-1', 'player-1'),
        DUE_ZSET_KEY,
        'match-1:player-1',
        1_000_000,
      );
    });

    it('não reagenda o próximo ciclo quando o script de claim retorna isLast=1', async () => {
      redis.zrangebyscore.mockResolvedValueOnce(['match-1:player-1']).mockResolvedValueOnce([]);
      redis.eval.mockResolvedValueOnce([1, '500000', 1]); // isLast

      await service.pollDueChallenges();

      expect(redis.zadd).not.toHaveBeenCalled();
    });

    it('reagenda o próximo ciclo via ZADD quando o script de claim retorna isLast=0', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      redis.zrangebyscore.mockResolvedValueOnce(['match-1:player-1']).mockResolvedValueOnce([]);
      redis.eval.mockResolvedValueOnce([1, '500000', 0]);

      await service.pollDueChallenges();

      expect(redis.zadd).toHaveBeenCalledWith(DUE_ZSET_KEY, 1_000_000 + 1000, 'match-1:player-1');
    });

    it('não processa quando o script de claim retorna 0 (já reivindicado por outra réplica)', async () => {
      redis.zrangebyscore.mockResolvedValueOnce(['match-1:player-1']).mockResolvedValueOnce([]);
      redis.eval.mockResolvedValueOnce([0]);

      await service.pollDueChallenges();

      expect(nonceService.issueChallengeNonce).not.toHaveBeenCalled();
      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
    });

    it('pollDueChallenges drena em loop até uma página vir menor que o lote', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => `match-1:player-${i}`);
      redis.zrangebyscore
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce(['match-1:player-last']);
      redis.eval.mockResolvedValue([1, '0', 1]);

      await service.pollDueChallenges();

      expect(redis.zrangebyscore).toHaveBeenCalledTimes(2);
    });
  });

  describe('agendar → poll → disparar (comportamento)', () => {
    interface FakeSchedule {
      targetCount: number;
      issuedSoFar: number;
      sessionStartedAt: number;
    }

    /**
     * Distingue CREATE_SCHEDULE_SCRIPT de CLAIM_AND_ADVANCE_SCRIPT pela
     * ARIDADE dos args (estável, não depende do texto do script real): o
     * serviço sempre chama eval com (script, numKeys, hashKey, zsetKey, ...).
     * createSchedule manda mais 4 args (targetCount/sessionStartedAt/member/
     * dueAt) — 6 no total após numKeys; claimAndFire manda mais 2
     * (member/now) — 4 no total.
     */
    function fakeChallengeRedis() {
      const schedules = new Map<string, FakeSchedule>();
      const due = new Map<string, number>();

      const eval_ = vi.fn(
        async (
          _script: string,
          _numKeys: number,
          hashKey: string,
          _zsetKey: string,
          ...rest: unknown[]
        ) => {
          if (rest.length === 4) {
            const [targetCount, sessionStartedAt, member, dueAtMs] = rest as [
              number,
              number,
              string,
              number,
            ];
            if (schedules.has(hashKey)) return 0;
            schedules.set(hashKey, { targetCount, issuedSoFar: 0, sessionStartedAt });
            due.set(member, dueAtMs);
            return 1;
          }

          const [member, now] = rest as [string, number];
          const dueAt = due.get(member);
          if (dueAt === undefined || dueAt > now) return [0];
          due.delete(member);
          const schedule = schedules.get(hashKey);
          if (!schedule) return [0];
          schedule.issuedSoFar += 1;
          if (schedule.issuedSoFar >= schedule.targetCount) {
            schedules.delete(hashKey);
            return [1, String(schedule.sessionStartedAt), 1];
          }
          return [1, String(schedule.sessionStartedAt), 0];
        },
      );

      return {
        eval: eval_,
        zrangebyscore: vi.fn(
          async (
            _key: string,
            _min: string,
            max: number,
            _limitKeyword: string,
            offset: number,
            limit: number,
          ) =>
            [...due.entries()]
              .filter(([, dueAtMs]) => dueAtMs <= max)
              .sort((a, b) => a[1] - b[1])
              .slice(offset, offset + limit)
              .map(([member]) => member),
        ),
        zadd: vi.fn(async (_key: string, score: number, member: string) => {
          due.set(member, score);
          return 1;
        }),
        del: vi.fn(async (key: string) => (schedules.delete(key) ? 1 : 0)),
      };
    }

    async function buildService(
      redis: ReturnType<typeof fakeChallengeRedis>,
      prisma: { match: { findUnique: ReturnType<typeof vi.fn> } },
      nonceService: { issueChallengeNonce: ReturnType<typeof vi.fn> },
      trustScoreService: { recordChallengeIssued: ReturnType<typeof vi.fn> },
      matchmakingService: { emitToUser: ReturnType<typeof vi.fn> },
    ): Promise<ChallengeSchedulerService> {
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChallengeSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: PrismaService, useValue: prisma },
          { provide: NonceService, useValue: nonceService },
          { provide: TrustScoreService, useValue: trustScoreService },
          { provide: MatchmakingService, useValue: matchmakingService },
        ],
      }).compile();
      return moduleRef.get(ChallengeSchedulerService);
    }

    let redis: ReturnType<typeof fakeChallengeRedis>;
    let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
    let nonceService: { issueChallengeNonce: ReturnType<typeof vi.fn> };
    let trustScoreService: { recordChallengeIssued: ReturnType<typeof vi.fn> };
    let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
    let service: ChallengeSchedulerService;

    beforeEach(async () => {
      vi.stubEnv('ANTI_CHEAT_CHALLENGES_MIN', '2');
      vi.stubEnv('ANTI_CHEAT_CHALLENGES_MAX', '2');
      vi.stubEnv('ANTI_CHEAT_CHALLENGE_INTERVAL_MIN_MS', '1000');
      vi.stubEnv('ANTI_CHEAT_CHALLENGE_INTERVAL_MAX_MS', '1000');

      redis = fakeChallengeRedis();
      prisma = {
        match: { findUnique: vi.fn().mockResolvedValue({ id: 'match-1', status: 'active' }) },
      };
      nonceService = { issueChallengeNonce: vi.fn().mockResolvedValue(undefined) };
      trustScoreService = { recordChallengeIssued: vi.fn().mockResolvedValue(undefined) };
      matchmakingService = { emitToUser: vi.fn() };
      service = await buildService(
        redis,
        prisma,
        nonceService,
        trustScoreService,
        matchmakingService,
      );
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('dispara exatamente challengesMin==challengesMax desafios por jogador (2 cada, com MIN=MAX=2)', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();
      vi.spyOn(Date, 'now').mockReturnValue(2000);
      await service.pollDueChallenges();

      const emittedForPlayer1 = matchmakingService.emitToUser.mock.calls.filter(
        (call) => call[0] === 'player-1',
      );
      const emittedForPlayer2 = matchmakingService.emitToUser.mock.calls.filter(
        (call) => call[0] === 'player-2',
      );
      expect(emittedForPlayer1).toHaveLength(2);
      expect(emittedForPlayer2).toHaveLength(2);
    });

    it('é idempotente — chamar ensureScheduledForMatch duas vezes para o mesmo match+user não dobra os desafios', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalledTimes(4)); // 2 chamadas x 2 jogadores

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();
      vi.spyOn(Date, 'now').mockReturnValue(2000);
      await service.pollDueChallenges();

      expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(4); // 2 desafios x 2 jogadores, não 8
    });

    it('nunca emite quando a partida não está mais active', async () => {
      prisma.match.findUnique.mockResolvedValue({ id: 'match-1', status: 'completed' });
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();

      expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
      expect(trustScoreService.recordChallengeIssued).not.toHaveBeenCalled();
    });

    it('cada desafio emitido registra o nonce e incrementa o contador de challengesIssued', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();

      expect(nonceService.issueChallengeNonce).toHaveBeenCalledWith(
        'match-1',
        'player-1',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
      );
      expect(trustScoreService.recordChallengeIssued).toHaveBeenCalledWith('match-1', 'player-1');
    });

    it('payload emitido bate com o formato de MatchVerifyChallengePayload', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();

      const [, event, payload] = matchmakingService.emitToUser.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(event).toBe('match:verify-challenge');
      expect(payload).toMatchObject({
        matchId: 'match-1',
        userId: 'player-1',
        challengeType: 'snapshot',
      });
      expect(typeof payload['nonce']).toBe('string');
      expect(typeof payload['challengeId']).toBe('string');
    });

    it('duas réplicas competindo pelo mesmo ciclo vencido: só uma processa', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      service.ensureScheduledForMatch('match-1', 'player-1', 'player-2');
      await vi.waitFor(() => expect(redis.eval).toHaveBeenCalled());

      const serviceReplicaB = await buildService(
        redis,
        prisma,
        nonceService,
        trustScoreService,
        matchmakingService,
      );

      vi.spyOn(Date, 'now').mockReturnValue(1000);
      await service.pollDueChallenges();
      await serviceReplicaB.pollDueChallenges();

      const emittedForPlayer1 = matchmakingService.emitToUser.mock.calls.filter(
        (call) => call[0] === 'player-1',
      );
      expect(emittedForPlayer1).toHaveLength(1); // não 2
    });
  });
});
