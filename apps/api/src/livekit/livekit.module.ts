import { Module } from '@nestjs/common';

import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { ScoringModule } from '../scoring/scoring.module';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';
import { MatchesController } from './matches.controller';
import { MatchForfeitGateway } from './match-forfeit.gateway';

@Module({
  imports: [ScoringModule],
  controllers: [MatchesController, LivekitWebhookController],
  providers: [
    LivekitService,
    MatchDurationSchedulerService,
    MatchForfeitGateway,
    WsRateLimiterService,
  ],
})
export class LivekitModule {}
