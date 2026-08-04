import { Module } from "@nestjs/common";

import { AntiCheatModule } from "./anti-cheat/anti-cheat.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConsentModule } from "./consent/consent.module";
import { LivekitModule } from "./livekit/livekit.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RankingModule } from "./ranking/ranking.module";
import { RedisModule } from "./redis/redis.module";
import { ScoringModule } from "./scoring/scoring.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
