import { Module } from "@nestjs/common";

import { RankingController } from "./ranking.controller";
import { RankingService } from "./ranking.service";

@Module({
  controllers: [RankingController],
  providers: [RankingService],
  // Exportado para o ScoringModule chamar recordMatchResult ao encerrar uma partida.
  exports: [RankingService],
})
export class RankingModule {}
