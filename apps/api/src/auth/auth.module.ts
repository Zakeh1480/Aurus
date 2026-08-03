import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";

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
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
