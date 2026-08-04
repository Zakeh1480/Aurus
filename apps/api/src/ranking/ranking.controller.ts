import { type RankingListQuery, RankingListQuerySchema, type RankingListResponse } from "@aurafarming/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { RankingService } from "./ranking.service";

@Controller("ranking")
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  async getRanking(
    @Query(new ZodValidationPipe(RankingListQuerySchema)) query: RankingListQuery,
  ): Promise<RankingListResponse> {
    return this.rankingService.getRanking(query.limit, query.offset);
  }
}
