import { describe, expect, it } from "vitest";
import type { RankingListResponse } from "@aurafarming/shared";

import { flattenRankingPages } from "../../src/lib/ranking-list.js";

const UUID_A = "123e4567-e89b-12d3-a456-426614174000";
const UUID_B = "223e4567-e89b-12d3-a456-426614174001";
const UUID_C = "323e4567-e89b-12d3-a456-426614174002";

function buildEntry(rank: number, userId: string) {
  return { rank, userId, displayName: `Player ${rank}`, rating: 1200 - rank, auraScoreAvg: 0.5, matchesPlayed: 3 };
}

describe("flattenRankingPages", () => {
  it("retorna lista vazia quando pages é undefined", () => {
    expect(flattenRankingPages(undefined)).toEqual([]);
  });

  it("achata múltiplas páginas mantendo a ordem", () => {
    const pages: RankingListResponse[] = [
      { entries: [buildEntry(1, UUID_A), buildEntry(2, UUID_B)], limit: 2, offset: 0, total: 3 },
      { entries: [buildEntry(3, UUID_C)], limit: 2, offset: 2, total: 3 },
    ];

    expect(flattenRankingPages(pages).map((entry) => entry.userId)).toEqual([UUID_A, UUID_B, UUID_C]);
  });

  it("deduplica por userId quando páginas se sobrepõem", () => {
    const pages: RankingListResponse[] = [
      { entries: [buildEntry(1, UUID_A), buildEntry(2, UUID_B)], limit: 2, offset: 0, total: 3 },
      { entries: [buildEntry(2, UUID_B), buildEntry(3, UUID_C)], limit: 2, offset: 1, total: 3 },
    ];

    const result = flattenRankingPages(pages);
    expect(result.map((entry) => entry.userId)).toEqual([UUID_A, UUID_B, UUID_C]);
  });

  it("retorna lista vazia quando não há páginas", () => {
    expect(flattenRankingPages([])).toEqual([]);
  });
});
