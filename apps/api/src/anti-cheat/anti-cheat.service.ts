import type { MatchTrustDecision } from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";

import { TrustScoreService } from "./trust-score.service";

/**
 * Fachada pública do AntiCheatModule — o Prompt 7 injeta só isto, nunca os
 * serviços internos (TrustScoreService, NonceService, etc.).
 */
@Injectable()
export class AntiCheatService {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  /**
   * Chamar UMA VEZ por partida, no momento de persistir MatchResult/atualizar
   * rating — nunca no caminho quente do score-tick. Idempotente (upsert).
   */
  getMatchDecision(matchId: string): Promise<MatchTrustDecision> {
    return this.trustScoreService.getMatchDecision(matchId);
  }
}
