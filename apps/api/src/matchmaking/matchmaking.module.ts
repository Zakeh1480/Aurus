import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { MatchmakingGateway } from "./matchmaking.gateway";
import { MatchmakingService } from "./matchmaking.service";
import { QueueService } from "./queue.service";
import { WsAuthService } from "./ws-auth.service";

@Module({
  imports: [AuthModule, UsersModule],
  providers: [QueueService, WsAuthService, MatchmakingService, MatchmakingGateway],
})
export class MatchmakingModule {}
