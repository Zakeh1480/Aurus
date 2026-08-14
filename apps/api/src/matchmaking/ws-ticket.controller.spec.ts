import type { User } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WsTicketController } from './ws-ticket.controller';
import { WsTicketService } from './ws-ticket.service';

const USER_A = '123e4567-e89b-12d3-a456-426614174000';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_A,
    email: 'player@example.com',
    displayName: 'Player One',
    avatarUrl: null,
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('WsTicketController', () => {
  let controller: WsTicketController;
  let wsTicketService: { issue: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    wsTicketService = {
      issue: vi
        .fn()
        .mockResolvedValue({
          ticket: 't'.repeat(32),
          expiresAt: new Date('2026-01-01T00:00:30.000Z'),
        }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WsTicketController],
      providers: [{ provide: WsTicketService, useValue: wsTicketService }],
    }).compile();

    controller = moduleRef.get(WsTicketController);
  });

  it('emite um ticket para o usuário autenticado', async () => {
    const result = await controller.issueTicket(buildUser());

    expect(wsTicketService.issue).toHaveBeenCalledWith(USER_A);
    expect(result).toEqual({
      ticket: 't'.repeat(32),
      expiresAt: '2026-01-01T00:00:30.000Z',
    });
  });
});
