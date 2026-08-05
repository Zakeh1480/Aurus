import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MatchmakingModule } from "../matchmaking/matchmaking.module";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { ReportsController } from "./reports.controller";
import { RoleBootstrapService } from "./role-bootstrap.service";

@Module({
  imports: [AuthModule, MatchmakingModule],
  controllers: [ReportsController, ModerationController],
  providers: [ModerationService, RoleBootstrapService],
})
export class ModerationModule {}
