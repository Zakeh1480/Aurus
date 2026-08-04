import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { JwtPayload } from "../auth/jwt-payload.type";
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
    // não confia só no payload, para invalidar contas anonimizadas (LGPD)
    // na hora, mesmo com access token ainda válido.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException();
    }

    return user.id;
  }
}
