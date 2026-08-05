import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { JwtPayload } from "../auth/jwt-payload.type";
import { activeBanWhere } from "../moderation/ban.util";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Verifica o token do handshake e resolve o userId — usado só na conexão do gateway. */
  async authenticate(token: string | undefined): Promise<string> {
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Mesma releitura do Postgres que JwtStrategy.validate faz para REST —
    // não confia só no payload, para invalidar contas anonimizadas (LGPD) ou
    // banidas (Prompt 13) na hora, mesmo com access token ainda válido.
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
