import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisService } from '../redis/redis.service';
import { PendingMatchService } from './pending-match.service';

function fakePipeline() {
  const pipeline = {
    hset: vi.fn(() => pipeline),
    pexpire: vi.fn(() => pipeline),
    set: vi.fn(() => pipeline),
    zadd: vi.fn(() => pipeline),
    exec: vi.fn().mockResolvedValue([]),
  };
  return pipeline;
}

describe('PendingMatchService', () => {
  let redis: {
    pipeline: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    hmget: ReturnType<typeof vi.fn>;
    eval: ReturnType<typeof vi.fn>;
    zrangebyscore: ReturnType<typeof vi.fn>;
  };
  let pipeline: ReturnType<typeof fakePipeline>;
  let service: PendingMatchService;

  beforeEach(async () => {
    pipeline = fakePipeline();
    redis = {
      pipeline: vi.fn(() => pipeline),
      get: vi.fn(),
      hmget: vi.fn(),
      eval: vi.fn(),
      zrangebyscore: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [PendingMatchService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(PendingMatchService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('grava hash + ponteiros reversos + entrada no ZSET de expiração num único pipeline', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await service.create('match-1', 'user-a', 'user-b');

      expect(redis.pipeline).toHaveBeenCalledOnce();
      expect(pipeline.hset).toHaveBeenCalledWith('mm:pending:match-1', {
        player1Id: 'user-a',
        player2Id: 'user-b',
        acceptedP1: '0',
        acceptedP2: '0',
      });
      expect(pipeline.pexpire).toHaveBeenCalledWith('mm:pending:match-1', 70_000);
      expect(pipeline.set).toHaveBeenCalledWith('mm:user:user-a:pending', 'match-1', 'PX', 70_000);
      expect(pipeline.set).toHaveBeenCalledWith('mm:user:user-b:pending', 'match-1', 'PX', 70_000);
      expect(pipeline.zadd).toHaveBeenCalledWith('mm:pending:expiry', 1_010_000, 'match-1');
      expect(pipeline.exec).toHaveBeenCalledOnce();
    });
  });

  describe('getPendingMatchId', () => {
    it('retorna o matchId quando existe', async () => {
      redis.get.mockResolvedValue('match-1');
      await expect(service.getPendingMatchId('user-a')).resolves.toBe('match-1');
      expect(redis.get).toHaveBeenCalledWith('mm:user:user-a:pending');
    });

    it('retorna null quando não existe', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.getPendingMatchId('user-a')).resolves.toBeNull();
    });
  });

  describe('accept', () => {
    it('retorna not_found sem chamar o script Lua quando o hash não existe', async () => {
      redis.hmget.mockResolvedValue([null, null]);
      await expect(service.accept('match-1', 'user-a')).resolves.toEqual({ status: 'not_found' });
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('retorna not_found sem chamar o script Lua quando o matchId pertence a outro par real', async () => {
      redis.hmget.mockResolvedValue(['user-c', 'user-d']);
      await expect(service.accept('match-1', 'user-a')).resolves.toEqual({ status: 'not_found' });
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('chama o script Lua com o campo correto quando userId é player1', async () => {
      redis.hmget.mockResolvedValue(['user-a', 'user-b']);
      redis.eval.mockResolvedValue(['waiting']);

      await expect(service.accept('match-1', 'user-a')).resolves.toEqual({ status: 'waiting' });
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        4,
        'mm:pending:match-1',
        'mm:user:user-a:pending',
        'mm:user:user-b:pending',
        'mm:pending:expiry',
        'acceptedP1',
        'match-1',
      );
    });

    it('chama o script Lua com o campo correto quando userId é player2', async () => {
      redis.hmget.mockResolvedValue(['user-a', 'user-b']);
      redis.eval.mockResolvedValue(['waiting']);

      await service.accept('match-1', 'user-b');
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        4,
        'mm:pending:match-1',
        'mm:user:user-a:pending',
        'mm:user:user-b:pending',
        'mm:pending:expiry',
        'acceptedP2',
        'match-1',
      );
    });

    it('retorna both_accepted com os dois player ids quando o script Lua indica que ambos aceitaram', async () => {
      redis.hmget.mockResolvedValue(['user-a', 'user-b']);
      redis.eval.mockResolvedValue(['both_accepted', 'user-a', 'user-b']);

      await expect(service.accept('match-1', 'user-a')).resolves.toEqual({
        status: 'both_accepted',
        player1Id: 'user-a',
        player2Id: 'user-b',
      });
    });

    it('retorna not_found quando o script Lua perde a corrida contra um claimAndCancel concorrente', async () => {
      redis.hmget.mockResolvedValue(['user-a', 'user-b']);
      redis.eval.mockResolvedValue(['not_found']);

      await expect(service.accept('match-1', 'user-a')).resolves.toEqual({ status: 'not_found' });
    });
  });

  describe('claimAndCancel', () => {
    it('retorna not_found quando o script Lua não encontra o hash', async () => {
      redis.eval.mockResolvedValue([0]);
      await expect(service.claimAndCancel('match-1')).resolves.toEqual({ status: 'not_found' });
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'mm:pending:match-1',
        'mm:pending:expiry',
        'match-1',
      );
    });

    it('retorna cancelled com acceptedUserIds vazio quando ninguém tinha aceitado', async () => {
      redis.eval.mockResolvedValue([1, 'user-a', 'user-b', '0', '0']);
      await expect(service.claimAndCancel('match-1')).resolves.toEqual({
        status: 'cancelled',
        player1Id: 'user-a',
        player2Id: 'user-b',
        acceptedUserIds: [],
      });
    });

    it('retorna cancelled listando só quem tinha aceitado', async () => {
      redis.eval.mockResolvedValue([1, 'user-a', 'user-b', '1', '0']);
      await expect(service.claimAndCancel('match-1')).resolves.toEqual({
        status: 'cancelled',
        player1Id: 'user-a',
        player2Id: 'user-b',
        acceptedUserIds: ['user-a'],
      });
    });
  });

  describe('pollExpired', () => {
    it('busca no ZSET de expiração com o teto padrão de 50', async () => {
      redis.zrangebyscore.mockResolvedValue(['match-1', 'match-2']);
      await expect(service.pollExpired(1_000_000)).resolves.toEqual(['match-1', 'match-2']);
      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        'mm:pending:expiry',
        '-inf',
        1_000_000,
        'LIMIT',
        0,
        50,
      );
    });

    it('respeita um limit customizado', async () => {
      redis.zrangebyscore.mockResolvedValue([]);
      await service.pollExpired(1_000_000, 5);
      expect(redis.zrangebyscore).toHaveBeenCalledWith(
        'mm:pending:expiry',
        '-inf',
        1_000_000,
        'LIMIT',
        0,
        5,
      );
    });
  });
});
