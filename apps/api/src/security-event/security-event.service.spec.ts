import { Test } from '@nestjs/testing';
import { Prisma, type SecurityEvent as PrismaSecurityEvent } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from './security-event.service';

function buildEvent(overrides: Partial<PrismaSecurityEvent> = {}): PrismaSecurityEvent {
  return {
    id: 'event-1',
    userId: 'user-1',
    type: 'login_failed',
    metadata: { reason: 'invalid_password' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SecurityEventService', () => {
  let securityEventService: SecurityEventService;
  let prisma: {
    securityEvent: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      securityEvent: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SecurityEventService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    securityEventService = moduleRef.get(SecurityEventService);
  });

  describe('record', () => {
    it('grava o evento com o type/userId/metadata informados', async () => {
      prisma.securityEvent.create.mockResolvedValue(buildEvent());

      await securityEventService.record({
        type: 'login_failed',
        userId: 'user-1',
        metadata: { reason: 'invalid_password' },
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: { type: 'login_failed', userId: 'user-1', metadata: { reason: 'invalid_password' } },
      });
    });

    it('aceita userId nulo e normaliza metadata ausente para null', async () => {
      prisma.securityEvent.create.mockResolvedValue(buildEvent({ userId: null, metadata: null }));

      await securityEventService.record({ type: 'login_failed', userId: null });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: { type: 'login_failed', userId: null, metadata: Prisma.JsonNull },
      });
    });

    it('nunca propaga erro quando a escrita falha (não pode derrubar o fluxo de auth instrumentado)', async () => {
      prisma.securityEvent.create.mockRejectedValue(new Error('db indisponível'));

      await expect(
        securityEventService.record({ type: 'password_changed', userId: 'user-1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('aplica paginação e retorna o total', async () => {
      prisma.securityEvent.findMany.mockResolvedValue([buildEvent()]);
      prisma.securityEvent.count.mockResolvedValue(1);

      const result = await securityEventService.list({ limit: 20, offset: 0 });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toEqual({
        entries: [
          {
            id: 'event-1',
            userId: 'user-1',
            type: 'login_failed',
            metadata: { reason: 'invalid_password' },
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      });
    });

    it('filtra por type quando informado', async () => {
      prisma.securityEvent.findMany.mockResolvedValue([]);
      prisma.securityEvent.count.mockResolvedValue(0);

      await securityEventService.list({
        type: 'refresh_token_reuse_detected',
        limit: 20,
        offset: 0,
      });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: { type: 'refresh_token_reuse_detected' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('filtra por userId quando informado', async () => {
      prisma.securityEvent.findMany.mockResolvedValue([]);
      prisma.securityEvent.count.mockResolvedValue(0);

      await securityEventService.list({ userId: 'user-1', limit: 20, offset: 0 });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('combina type e userId quando os dois são informados', async () => {
      prisma.securityEvent.findMany.mockResolvedValue([]);
      prisma.securityEvent.count.mockResolvedValue(0);

      await securityEventService.list({
        type: 'login_failed',
        userId: 'user-1',
        limit: 20,
        offset: 0,
      });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: { type: 'login_failed', userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });
  });
});
