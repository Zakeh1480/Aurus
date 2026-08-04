import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConsentModule } from "./consent/consent.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, UsersModule, ConsentModule, MatchmakingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
