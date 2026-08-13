import { Test } from '@nestjs/testing';
import type { SecurityEventListResponse } from '@aurafarming/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { SecurityEventService } from '../security-event/security-event.service';

describe('ModerationController', () => {
  let controller: ModerationController;
  let securityEventService: { list: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    securityEventService = { list: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ModerationController],
      providers: [
        { provide: ModerationService, useValue: {} },
        { provide: SecurityEventService, useValue: securityEventService },
      ],
    }).compile();

    controller = moduleRef.get(ModerationController);
  });

  describe('listSecurityEvents', () => {
    it('repassa a query já validada e retorna o resultado do serviço', async () => {
      const response: SecurityEventListResponse = {
        entries: [],
        limit: 20,
        offset: 0,
        total: 0,
      };
      securityEventService.list.mockResolvedValue(response);

      const query = { type: 'login_failed' as const, limit: 20, offset: 0 };
      const result = await controller.listSecurityEvents(query);

      expect(securityEventService.list).toHaveBeenCalledExactlyOnceWith(query);
      expect(result).toBe(response);
    });
  });
});
