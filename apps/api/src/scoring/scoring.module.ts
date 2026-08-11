import { Module } from '@nestjs/common';

import { AntiCheatModule } from '../anti-cheat/anti-cheat.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { RankingModule } from '../ranking/ranking.module';
import { AiScoreClientService } from './ai-score-client.service';
import { MatchScoringGateway } from './match-scoring.gateway';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [AntiCheatModule, MatchmakingModule, RankingModule],
  providers: [
    AiScoreClientService,
    ScoreSampleBufferService,
    ScoreTickSchedulerService,
    MatchScoringGateway,
    ScoringService,
  ],

  exports: [ScoringService],
})
export class ScoringModule {}
