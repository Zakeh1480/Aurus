import { type User, WsTicketResponseSchema, type WsTicketResponse } from '@aurafarming/shared';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WsTicketService } from './ws-ticket.service';

@Controller('ws')
@UseGuards(JwtAuthGuard)
export class WsTicketController {
  constructor(private readonly wsTicketService: WsTicketService) {}

  @Post('ticket')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async issueTicket(@CurrentUser() user: User): Promise<WsTicketResponse> {
    const { ticket, expiresAt } = await this.wsTicketService.issue(user.id);
    return WsTicketResponseSchema.parse({ ticket, expiresAt: expiresAt.toISOString() });
  }
}
