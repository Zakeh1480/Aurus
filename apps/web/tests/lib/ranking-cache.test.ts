import { describe, expect, it } from "vitest";
import type { RankingListResponse, RankingMeResponse } from "@aurafarming/shared";

import { patchRankingListCache, patchRankingMeCache, type RankingListPages } from "../../src/lib/ranking-cache.js";

const UUID_A = "123e4567-e89b-12d3-a456-426614174000";
const UUID_B = "223e4567-e89b-12d3-a456-426614174001";

function buildEntry(rank: number, userId: string, rating = 1000, matchesPlayed = 3) {
  return { rank, userId, displayName: `Player ${rank}`, rating, auraScoreAvg: 0.5, matchesPlayed };
}

describe("patchRankingMeCache", () => {
  it("soma o ratingDelta e incrementa matchesPlayed quando o userId bate", () => {
    const data: RankingMeResponse = { entry: buildEntry(4, UUID_A, 1000, 3) };

    const result = patchRankingMeCache(data, UUID_A, 25);

    expect(result).toEqual({ entry: buildEntry(4, UUID_A, 1025, 4) });
  });

  it("não mexe no rank (só o servidor recalcula isso)", () => {
    const data: RankingMeResponse = { entry: buildEntry(4, UUID_A) };
    const result = patchRankingMeCache(data, UUID_A, 25);
    expect(result?.entry?.rank).toBe(4);
  });

  it("é no-op quando o userId não bate", () => {
    const data: RankingMeResponse = { entry: buildEntry(4, UUID_B) };
    expect(patchRankingMeCache(data, UUID_A, 25)).toBe(data);
  });

  it("é no-op quando entry é null", () => {
    const data: RankingMeResponse = { entry: null };
    expect(patchRankingMeCache(data, UUID_A, 25)).toBe(data);
  });

  it("é no-op quando data é undefined", () => {
    expect(patchRankingMeCache(undefined, UUID_A, 25)).toBeUndefined();
  });
});

describe("patchRankingListCache", () => {
  function buildPages(pages: RankingListResponse[]): RankingListPages {
    return { pages, pageParams: pages.map((_, i) => i) };
  }

  it("aplica o patch na página onde o userId aparece, mesmo que não seja a primeira", () => {
    const data = buildPages([
      { entries: [buildEntry(1, UUID_B, 1200, 5)], limit: 1, offset: 0, total: 2 },
      { entries: [buildEntry(2, UUID_A, 1000, 3)], limit: 1, offset: 1, total: 2 },
    ]);

    const result = patchRankingListCache(data, UUID_A, -10);

    expect(result?.pages[1]?.entries[0]).toEqual(buildEntry(2, UUID_A, 990, 4));
    expect(result?.pages[0]).toBe(data.pages[0]);
  });

  it("é no-op quando o userId não aparece em nenhuma página", () => {
    const data = buildPages([{ entries: [buildEntry(1, UUID_B)], limit: 1, offset: 0, total: 1 }]);
    expect(patchRankingListCache(data, UUID_A, 25)).toBe(data);
  });

  it("é no-op quando data é undefined", () => {
    expect(patchRankingListCache(undefined, UUID_A, 25)).toBeUndefined();
  });
});
