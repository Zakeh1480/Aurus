import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RankingController } from "./ranking.controller";
import { RankingService } from "./ranking.service";

describe("RankingController", () => {
  let rankingService: { getRanking: ReturnType<typeof vi.fn> };
  let controller: RankingController;

  beforeEach(async () => {
    rankingService = { getRanking: vi.fn().mockResolvedValue({ entries: [], limit: 20, offset: 0, total: 0 }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [RankingController],
      providers: [{ provide: RankingService, useValue: rankingService }],
    }).compile();
    controller = moduleRef.get(RankingController);
  });

  it("delega para RankingService.getRanking com limit/offset já com defaults aplicados", async () => {
    const result = await controller.getRanking({ limit: 20, offset: 0 });

    expect(rankingService.getRanking).toHaveBeenCalledWith(20, 0);
    expect(result).toEqual({ entries: [], limit: 20, offset: 0, total: 0 });
  });

  it("repassa limit/offset customizados", async () => {
    await controller.getRanking({ limit: 5, offset: 10 });
    expect(rankingService.getRanking).toHaveBeenCalledWith(5, 10);
  });
});
