import { Module } from '@nestjs/common';

import { ScoringModule } from '../scoring/scoring.module';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';
import { MatchesController } from './matches.controller';

@Module({
  // ScoringModule (não MatchmakingModule diretamente): o webhook delega a
  // decisão de encerramento inteira para ScoringService.finalizeMatch.
  imports: [ScoringModule],
  controllers: [MatchesController, LivekitWebhookController],
  providers: [LivekitService, MatchDurationSchedulerService],
})
export class LivekitModule {}
