import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { getAccessTtlSeconds, getJwtSecret } from "./auth.constants";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    // registerAsync + factory (em vez de register) porque `.env` só é
    // carregado em main.ts no momento do bootstrap — este módulo é
    // importado (e a classe decorada) antes disso. A factory só roda na
    // instanciação via DI, já com process.env populado.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getAccessTtlSeconds() },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule também é exportado para que MatchmakingModule injete o mesmo
  // JwtService (mesma factory de segredo) sem duplicar registerAsync.
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
