import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisService } from '../redis/redis.service';
import { WsTicketService } from './ws-ticket.service';

describe('WsTicketService', () => {
  let redis: { set: ReturnType<typeof vi.fn>; getdel: ReturnType<typeof vi.fn> };
  let service: WsTicketService;

  beforeEach(async () => {
    redis = { set: vi.fn(), getdel: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [WsTicketService, { provide: RedisService, useValue: redis }],
    }).compile();
    service = moduleRef.get(WsTicketService);
  });

  describe('issue', () => {
    it('gera um ticket opaco e grava userId no Redis com TTL', async () => {
      redis.set.mockResolvedValue('OK');

      const { ticket, expiresAt } = await service.issue('user-a');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^mm:ws-ticket:.+/),
        'user-a',
        'EX',
        30,
      );
      expect(ticket.length).toBeGreaterThan(16);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('gera um ticket diferente a cada chamada', async () => {
      redis.set.mockResolvedValue('OK');

      const first = await service.issue('user-a');
      const second = await service.issue('user-a');

      expect(first.ticket).not.toBe(second.ticket);
    });
  });

  describe('consume', () => {
    it('consome o ticket atomicamente via GETDEL e retorna o userId', async () => {
      redis.getdel.mockResolvedValue('user-a');

      await expect(service.consume('some-ticket')).resolves.toBe('user-a');
      expect(redis.getdel).toHaveBeenCalledWith('mm:ws-ticket:some-ticket');
    });

    it('retorna null quando o ticket não existe ou já foi consumido', async () => {
      redis.getdel.mockResolvedValue(null);

      await expect(service.consume('ticket-inexistente')).resolves.toBeNull();
    });
  });
});
