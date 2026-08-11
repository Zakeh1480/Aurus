import { Module } from '@nestjs/common';

import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { AiVerifyClientService } from './ai-verify-client.service';
import { AntiCheatSessionController } from './anti-cheat-session.controller';
import { AntiCheatGateway } from './anti-cheat.gateway';
import { AntiCheatService } from './anti-cheat.service';
import { ChallengeSchedulerService } from './challenge-scheduler.service';
import { FeatureBufferService } from './feature-buffer.service';
import { KeyframeHistoryService } from './keyframe-history.service';
import { NonceService } from './nonce.service';
import { SessionSecretService } from './session-secret.service';
import { TrustScoreService } from './trust-score.service';

@Module({
  imports: [MatchmakingModule],
  controllers: [AntiCheatSessionController],
  providers: [
    SessionSecretService,
    NonceService,
    FeatureBufferService,
    KeyframeHistoryService,
    ChallengeSchedulerService,
    AiVerifyClientService,
    TrustScoreService,
    AntiCheatService,
    AntiCheatGateway,
  ],

  exports: [AntiCheatService],
})
export class AntiCheatModule {}
