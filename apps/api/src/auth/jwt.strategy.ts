import type { User } from "@aurafarming/shared";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { PrismaService } from "../prisma/prisma.service";
import { getJwtSecret } from "./auth.constants";
import type { JwtPayload } from "./jwt-payload.type";
import { toPublicUser } from "./mappers/to-public-user.mapper";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Consulta o Postgres a cada request (não confia só no payload do JWT)
    // para invalidar imediatamente contas anonimizadas (LGPD) mesmo com
    // access token ainda válido.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }
}
