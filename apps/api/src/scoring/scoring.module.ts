import { Module } from "@nestjs/common";

import { AntiCheatModule } from "../anti-cheat/anti-cheat.module";
import { MatchmakingModule } from "../matchmaking/matchmaking.module";
import { RankingModule } from "../ranking/ranking.module";
import { AiScoreClientService } from "./ai-score-client.service";
import { MatchScoringGateway } from "./match-scoring.gateway";
import { ScoreSampleBufferService } from "./score-sample-buffer.service";
import { ScoreTickSchedulerService } from "./score-tick-scheduler.service";
import { ScoringService } from "./scoring.service";

@Module({
  // AntiCheatModule: getMatchDecision antes de persistir resultado/ranking.
  // MatchmakingModule: emitToUser (match:score-tick/end/result) + endActiveMatch (caminho descartado).
  // RankingModule: recordMatchResult ao encerrar.
  imports: [AntiCheatModule, MatchmakingModule, RankingModule],
  providers: [AiScoreClientService, ScoreSampleBufferService, ScoreTickSchedulerService, MatchScoringGateway, ScoringService],
  // Exportado para o LivekitModule chamar finalizeMatch no webhook de fim de partida.
  exports: [ScoringService],
})
export class ScoringModule {}
