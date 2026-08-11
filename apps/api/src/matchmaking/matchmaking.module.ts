import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { UsersModule } from '../users/users.module';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';
import { PendingMatchService } from './pending-match.service';
import { QueueService } from './queue.service';
import { WsAuthService } from './ws-auth.service';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [
    QueueService,
    PendingMatchService,
    WsAuthService,
    MatchmakingService,
    MatchmakingGateway,
    WsRateLimiterService,
  ],

  exports: [MatchmakingService],
})
export class MatchmakingModule {}
