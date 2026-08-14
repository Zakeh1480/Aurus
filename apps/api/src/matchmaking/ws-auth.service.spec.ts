import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Ban as PrismaBan, User as PrismaUser } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { WsAuthService } from './ws-auth.service';
import { WsTicketService } from './ws-ticket.service';

function buildUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
  return {
    id: 'user-1',
    email: 'player@example.com',
    passwordHash: 'irrelevant',
    displayName: 'Player One',
    avatarUrl: null,
    anonymizedAt: null,
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildUserWithBans(
  overrides: Partial<PrismaUser> = {},
  bansReceived: PrismaBan[] = [],
): PrismaUser & { bansReceived: PrismaBan[] } {
  return { ...buildUser(overrides), bansReceived };
}

function buildBan(overrides: Partial<PrismaBan> = {}): PrismaBan {
  return {
    id: 'ban-1',
    userId: 'user-1',
    issuedById: 'moderator-1',
    reason: 'Denúncia confirmada.',
    expiresAt: null,
    liftedAt: null,
    liftedById: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('WsAuthService', () => {
  let wsAuthService: WsAuthService;
  let wsTicketService: { consume: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn() } };
    wsTicketService = { consume: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WsAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: WsTicketService, useValue: wsTicketService },
      ],
    }).compile();

    wsAuthService = moduleRef.get(WsAuthService);
  });

  it('resolve o userId para um ticket válido de usuário ativo', async () => {
    wsTicketService.consume.mockResolvedValue('user-1');
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans());

    await expect(wsAuthService.authenticate('some-ticket')).resolves.toBe('user-1');
    expect(wsTicketService.consume).toHaveBeenCalledWith('some-ticket');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { bansReceived: { where: expect.any(Object), take: 1 } },
    });
  });

  it('lança quando o ticket está ausente, sem consultar o Redis', async () => {
    await expect(wsAuthService.authenticate(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(wsTicketService.consume).not.toHaveBeenCalled();
  });

  it('lança quando o ticket é inválido/já consumido/expirado', async () => {
    wsTicketService.consume.mockResolvedValue(null);

    await expect(wsAuthService.authenticate('ticket-invalido')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('lança quando o usuário resolvido pelo ticket não é encontrado', async () => {
    wsTicketService.consume.mockResolvedValue('user-fantasma');
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(wsAuthService.authenticate('some-ticket')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lança quando a conta foi anonimizada (LGPD), mesmo com ticket válido', async () => {
    wsTicketService.consume.mockResolvedValue('user-1');
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans({ anonymizedAt: new Date() }));

    await expect(wsAuthService.authenticate('some-ticket')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lança quando a conta tem um ban ativo (Prompt 13), mesmo com ticket válido', async () => {
    wsTicketService.consume.mockResolvedValue('user-1');
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans({}, [buildBan()]));

    await expect(wsAuthService.authenticate('some-ticket')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
