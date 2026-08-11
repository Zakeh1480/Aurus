import { Module } from '@nestjs/common';

import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { ScoringModule } from '../scoring/scoring.module';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';
import { MatchesController } from './matches.controller';
import { MatchForfeitGateway } from './match-forfeit.gateway';

@Module({
  // ScoringModule (não MatchmakingModule diretamente): o webhook e o gateway
  // de desistência delegam a decisão de encerramento para ScoringService.
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
