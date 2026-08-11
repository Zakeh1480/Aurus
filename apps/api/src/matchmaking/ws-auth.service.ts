import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JWT_ALGORITHM } from '../auth/auth.constants';
import type { JwtPayload } from '../auth/jwt-payload.type';
import { activeBanWhere } from '../moderation/ban.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(token: string | undefined): Promise<string> {
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { algorithms: [JWT_ALGORITHM] });
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { bansReceived: { where: activeBanWhere(), take: 1 } },
    });
    if (!user || user.anonymizedAt || user.bansReceived.length > 0) {
      throw new UnauthorizedException();
    }

    return user.id;
  }
}
