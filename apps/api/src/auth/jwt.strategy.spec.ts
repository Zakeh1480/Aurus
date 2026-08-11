import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Ban as PrismaBan, User as PrismaUser } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

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

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    process.env['JWT_SECRET'] = 'test-secret';
    prisma = { user: { findUnique: vi.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  it('retorna o usuário público (com role) para um payload válido de conta ativa', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans());

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result.id).toBe('user-1');
    expect(result.role).toBe('user');
    expect(result).not.toHaveProperty('passwordHash');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { bansReceived: { where: expect.any(Object), take: 1 } },
    });
  });

  it('lança quando o usuário não existe mais', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'user-fantasma' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lança quando a conta foi anonimizada (LGPD), mesmo com JWT ainda válido', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans({ anonymizedAt: new Date() }));

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lança quando a conta tem um ban ativo (Prompt 13), mesmo com JWT ainda válido', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUserWithBans({}, [buildBan()]));

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
