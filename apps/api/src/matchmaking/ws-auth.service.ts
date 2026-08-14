import { Injectable, UnauthorizedException } from '@nestjs/common';

import { activeBanWhere } from '../moderation/ban.util';
import { PrismaService } from '../prisma/prisma.service';
import { WsTicketService } from './ws-ticket.service';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly wsTicketService: WsTicketService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(ticket: string | undefined): Promise<string> {
    if (!ticket) {
      throw new UnauthorizedException();
    }

    const userId = await this.wsTicketService.consume(ticket);
    if (!userId) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { bansReceived: { where: activeBanWhere(), take: 1 } },
    });
    if (!user || user.anonymizedAt || user.bansReceived.length > 0) {
      throw new UnauthorizedException();
    }

    return user.id;
  }
}
