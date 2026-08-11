import type { MatchTrustDecision } from '@aurafarming/shared';
import { Injectable } from '@nestjs/common';

import { TrustScoreService } from './trust-score.service';

@Injectable()
export class AntiCheatService {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  getMatchDecision(matchId: string): Promise<MatchTrustDecision> {
    return this.trustScoreService.getMatchDecision(matchId);
  }
}
