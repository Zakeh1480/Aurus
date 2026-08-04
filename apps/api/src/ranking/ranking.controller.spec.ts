import type { User } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RankingController } from "./ranking.controller";
import { RankingService } from "./ranking.service";

const USER_A = "123e4567-e89b-12d3-a456-426614174000";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_A,
    email: "player@example.com",
    displayName: "Player One",
    avatarUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("RankingController", () => {
  let rankingService: { getRanking: ReturnType<typeof vi.fn>; getMyRanking: ReturnType<typeof vi.fn> };
  let controller: RankingController;

  beforeEach(async () => {
    rankingService = {
      getRanking: vi.fn().mockResolvedValue({ entries: [], limit: 20, offset: 0, total: 0 }),
      getMyRanking: vi.fn().mockResolvedValue({ entry: null }),
    };

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

  describe("getMyRanking", () => {
    it("delega para RankingService.getMyRanking com o id do usuário autenticado", async () => {
      rankingService.getMyRanking.mockResolvedValue({
        entry: { rank: 4, userId: USER_A, displayName: "Player One", rating: 1050, auraScoreAvg: 0.6, matchesPlayed: 5 },
      });

      const result = await controller.getMyRanking(buildUser({ id: USER_A }));

      expect(rankingService.getMyRanking).toHaveBeenCalledWith(USER_A);
      expect(result.entry?.rank).toBe(4);
    });

    it("repassa entry null quando o usuário ainda não tem partida registrada", async () => {
      rankingService.getMyRanking.mockResolvedValue({ entry: null });

      const result = await controller.getMyRanking(buildUser());

      expect(result).toEqual({ entry: null });
    });
  });
});
