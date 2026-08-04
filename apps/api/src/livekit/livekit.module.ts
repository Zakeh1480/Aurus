import { Module } from "@nestjs/common";

import { MatchmakingModule } from "../matchmaking/matchmaking.module";
import { LivekitWebhookController } from "./livekit-webhook.controller";
import { LivekitService } from "./livekit.service";
import { MatchesController } from "./matches.controller";

@Module({
  imports: [MatchmakingModule],
  controllers: [MatchesController, LivekitWebhookController],
  providers: [LivekitService],
})
export class LivekitModule {}
