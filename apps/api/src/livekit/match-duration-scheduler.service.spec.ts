import { MATCH_DURATION_SECONDS } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisService } from '../redis/redis.service';
import { ScoringService } from '../scoring/scoring.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';

const DUE_ZSET_KEY = 'lk:match-duration:expiry';

describe('MatchDurationSchedulerService', () => {
  describe('chamadas Redis (shape)', () => {
    let redis: {
      zadd: ReturnType<typeof vi.fn>;
      zrem: ReturnType<typeof vi.fn>;
      zrangebyscore: ReturnType<typeof vi.fn>;
    };
    let scoringService: { finalizeMatch: ReturnType<typeof vi.fn> };
    let livekit: { deleteRoom: ReturnType<typeof vi.fn> };
    let service: MatchDurationSchedulerService;

    beforeEach(async () => {
      redis = {
        zadd: vi.fn().mockResolvedValue(1),
        zrem: vi.fn().mockResolvedValue(1),
        zrangebyscore: vi.fn().mockResolvedValue([]),
      };
      scoringService = { finalizeMatch: vi.fn().mockResolvedValue(undefined) };
      livekit = { deleteRoom: vi.fn().mockResolvedValue(undefined) };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MatchDurationSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: ScoringService, useValue: scoringService },
          { provide: LivekitService, useValue: livekit },
        ],
      }).compile();
      service = moduleRef.get(MatchDurationSchedulerService);
    });

    it('scheduleForMatch agenda com ZADD NX usando dueAtMs derivado só de startedAt', () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:40.000Z').getTime());
      const startedAt = new Date('2026-01-01T00:00:00.000Z');

      service.scheduleForMatch('match-1', startedAt);

      const dueAtMs = startedAt.getTime() + MATCH_DURATION_SECONDS * 1000;
      expect(redis.zadd).toHaveBeenCalledWith(DUE_ZSET_KEY, 'NX', dueAtMs, 'match-1');
    });

    it('cancel remove com ZREM', () => {
      service.cancel('match-1');
      expect(redis.zrem).toHaveBeenCalledWith(DUE_ZSET_KEY, 'match-1');
    });

    it('scheduleForMatch não lança quando o Redis rejeita (fire-and-forget)', async () => {
      redis.zadd.mockRejectedValue(new Error('redis indisponível'));
      expect(() => service.scheduleForMatch('match-1', new Date())).not.toThrow();
      await vi.waitFor(() => expect(redis.zadd).toHaveBeenCalled());
    });

    it('cancel não lança quando o Redis rejeita (fire-and-forget)', async () => {
      redis.zrem.mockRejectedValue(new Error('redis indisponível'));
      expect(() => service.cancel('match-1')).not.toThrow();
      await vi.waitFor(() => expect(redis.zrem).toHaveBeenCalled());
    });

    it('pollDueMatches varre com ZRANGEBYSCORE e só dispara fire() quando ZREM retorna 1', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      redis.zrangebyscore.mockResolvedValueOnce(['match-1', 'match-2']).mockResolvedValueOnce([]);
      redis.zrem.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await service.pollDueMatches();

      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        DUE_ZSET_KEY,
        '-inf',
        1_000_000,
        'LIMIT',
        0,
        50,
      );
      expect(redis.zrem).toHaveBeenNthCalledWith(1, DUE_ZSET_KEY, 'match-1');
      expect(redis.zrem).toHaveBeenNthCalledWith(2, DUE_ZSET_KEY, 'match-2');

      expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
      expect(livekit.deleteRoom).toHaveBeenCalledWith('match-1');

      expect(scoringService.finalizeMatch).not.toHaveBeenCalledWith('match-2');
      expect(livekit.deleteRoom).not.toHaveBeenCalledWith('match-2');
    });

    it('pollDueMatches drena em loop até uma página vir menor que o lote', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => `match-${i}`);
      redis.zrangebyscore.mockResolvedValueOnce(fullPage).mockResolvedValueOnce(['match-last']);
      redis.zrem.mockResolvedValue(1);

      await service.pollDueMatches();

      expect(redis.zrangebyscore).toHaveBeenCalledTimes(2);
    });
  });

  describe('agendar → poll → disparar (comportamento)', () => {
    function fakeMatchDurationRedis() {
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
      };
    }

    async function buildService(
      redis: ReturnType<typeof fakeMatchDurationRedis>,
      scoringService: { finalizeMatch: ReturnType<typeof vi.fn> },
      livekit: { deleteRoom: ReturnType<typeof vi.fn> },
    ): Promise<MatchDurationSchedulerService> {
      const moduleRef = await Test.createTestingModule({
        providers: [
          MatchDurationSchedulerService,
          { provide: RedisService, useValue: redis },
          { provide: ScoringService, useValue: scoringService },
          { provide: LivekitService, useValue: livekit },
        ],
      }).compile();
      return moduleRef.get(MatchDurationSchedulerService);
    }

    let redis: ReturnType<typeof fakeMatchDurationRedis>;
    let scoringService: { finalizeMatch: ReturnType<typeof vi.fn> };
    let livekit: { deleteRoom: ReturnType<typeof vi.fn> };
    let service: MatchDurationSchedulerService;

    beforeEach(async () => {
      redis = fakeMatchDurationRedis();
      scoringService = { finalizeMatch: vi.fn().mockResolvedValue(undefined) };
      livekit = { deleteRoom: vi.fn().mockResolvedValue(undefined) };
      service = await buildService(redis, scoringService, livekit);
    });

    it('finaliza a partida e apaga a room depois de MATCH_DURATION_SECONDS a partir de startedAt', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);

      vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + MATCH_DURATION_SECONDS * 1000);
      await service.pollDueMatches();

      expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
      expect(livekit.deleteRoom).toHaveBeenCalledWith('match-1');
    });

    it('não dispara antes do prazo', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);

      vi.spyOn(Date, 'now').mockReturnValue(
        startedAt.getTime() + MATCH_DURATION_SECONDS * 1000 - 1000,
      );
      await service.pollDueMatches();

      expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
    });

    it('desconta o tempo já passado quando startedAt é anterior ao agendamento', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);

      vi.spyOn(Date, 'now').mockReturnValue(
        startedAt.getTime() + (MATCH_DURATION_SECONDS - 1) * 1000,
      );
      await service.pollDueMatches();
      expect(scoringService.finalizeMatch).not.toHaveBeenCalled();

      vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + MATCH_DURATION_SECONDS * 1000);
      await service.pollDueMatches();
      expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
    });

    it('scheduleForMatch é idempotente — chamar duas vezes só agenda uma vez', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);
      service.scheduleForMatch('match-1', startedAt);

      vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + MATCH_DURATION_SECONDS * 1000);
      await service.pollDueMatches();

      expect(scoringService.finalizeMatch).toHaveBeenCalledTimes(1);
    });

    it('cancel() impede o disparo (ex.: partida já finalizada via webhook)', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);
      service.cancel('match-1');

      vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + MATCH_DURATION_SECONDS * 1000);
      await service.pollDueMatches();

      expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
      expect(livekit.deleteRoom).not.toHaveBeenCalled();
    });

    it('cancel() em matchId desconhecido é no-op silencioso', async () => {
      expect(() => service.cancel('match-inexistente')).not.toThrow();
      await expect(service.pollDueMatches()).resolves.toBeUndefined();
    });

    it('duas réplicas competindo pelo mesmo matchId vencido: só uma dispara fire()', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      service.scheduleForMatch('match-1', startedAt);

      const serviceReplicaB = await buildService(redis, scoringService, livekit);

      vi.spyOn(Date, 'now').mockReturnValue(startedAt.getTime() + MATCH_DURATION_SECONDS * 1000);
      await service.pollDueMatches();
      await serviceReplicaB.pollDueMatches();

      expect(scoringService.finalizeMatch).toHaveBeenCalledTimes(1);
      expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
    });

    it('startedAt já vencido no agendamento (fresh deploy) dispara já no próximo poll', async () => {
      const longAgo = new Date('2025-01-01T00:00:00.000Z');
      vi.spyOn(Date, 'now').mockReturnValue(longAgo.getTime() + MATCH_DURATION_SECONDS * 1000 + 1);

      service.scheduleForMatch('match-1', longAgo);
      await service.pollDueMatches();

      expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
    });
  });
});
