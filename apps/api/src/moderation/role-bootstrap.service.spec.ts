import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { RoleBootstrapService } from './role-bootstrap.service';

describe('RoleBootstrapService', () => {
  let service: RoleBootstrapService;
  let prisma: { user: { updateMany: ReturnType<typeof vi.fn> } };
  const originalEnv = process.env['MODERATION_BOOTSTRAP_EMAILS'];

  beforeEach(async () => {
    prisma = { user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    const moduleRef = await Test.createTestingModule({
      providers: [RoleBootstrapService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(RoleBootstrapService);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['MODERATION_BOOTSTRAP_EMAILS'];
    } else {
      process.env['MODERATION_BOOTSTRAP_EMAILS'] = originalEnv;
    }
  });

  it('não chama o Prisma quando a env var está vazia/ausente', async () => {
    delete process.env['MODERATION_BOOTSTRAP_EMAILS'];
    await service.onModuleInit();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("promove idempotentemente os e-mails listados (só quem ainda é 'user')", async () => {
    process.env['MODERATION_BOOTSTRAP_EMAILS'] = 'mod1@example.com, mod2@example.com';
    prisma.user.updateMany.mockResolvedValue({ count: 2 });

    await service.onModuleInit();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ['mod1@example.com', 'mod2@example.com'] }, role: 'user' },
      data: { role: 'moderator' },
    });
  });

  it("nunca rebaixa um moderador já existente — where filtra role: 'user'", async () => {
    process.env['MODERATION_BOOTSTRAP_EMAILS'] = 'already-moderator@example.com';
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await service.onModuleInit();

    const call = prisma.user.updateMany.mock.calls[0]![0] as { where: { role: string } };
    expect(call.where.role).toBe('user');
  });

  it('normaliza case — MODERATION_BOOTSTRAP_EMAILS em maiúsculas ainda bate com o e-mail (sempre lowercase) armazenado', async () => {
    process.env['MODERATION_BOOTSTRAP_EMAILS'] = 'Mod1@Example.com';

    await service.onModuleInit();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ['mod1@example.com'] }, role: 'user' },
      data: { role: 'moderator' },
    });
  });

  it('ignora espaços e entradas vazias na lista separada por vírgula', async () => {
    process.env['MODERATION_BOOTSTRAP_EMAILS'] = ' mod1@example.com ,, mod2@example.com ,';

    await service.onModuleInit();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ['mod1@example.com', 'mod2@example.com'] }, role: 'user' },
      data: { role: 'moderator' },
    });
  });
});
