import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AntiCheatModule } from "./anti-cheat/anti-cheat.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConsentModule } from "./consent/consent.module";
import { LivekitModule } from "./livekit/livekit.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { ModerationModule } from "./moderation/moderation.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RankingModule } from "./ranking/ranking.module";
import { RedisModule } from "./redis/redis.module";
import { ScoringModule } from "./scoring/scoring.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // Registrado aqui (não em AuthModule) para valer em qualquer endpoint via
    // APP_GUARD abaixo — rotas continuam podendo apertar o limite com
    // @Throttle({...}) por rota (ex.: auth.controller.ts).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 20 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ConsentModule,
    MatchmakingModule,
    LivekitModule,
    AntiCheatModule,
    ScoringModule,
    RankingModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
