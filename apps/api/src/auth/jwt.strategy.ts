import type { User } from '@aurafarming/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { activeBanWhere } from '../moderation/ban.util';
import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret, JWT_ALGORITHM } from './auth.constants';
import type { JwtPayload } from './jwt-payload.type';
import { toPublicUser } from './mappers/to-public-user.mapper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { bansReceived: { where: activeBanWhere(), take: 1 } },
    });
    if (!user || user.anonymizedAt || user.bansReceived.length > 0) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }
}
