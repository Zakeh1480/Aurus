import type { InfiniteData } from "@tanstack/react-query";
import type { RankingEntry, RankingListResponse, RankingMeResponse } from "@aurafarming/shared";

export type RankingListPages = InfiniteData<RankingListResponse, number>;

function applyRatingDelta(entry: RankingEntry, ratingDelta: number): RankingEntry {
  return { ...entry, rating: entry.rating + ratingDelta, matchesPlayed: entry.matchesPlayed + 1 };
}

/**
 * Patch otimista pós match:result — soma o ratingDelta e incrementa
 * matchesPlayed, mas deliberadamente não mexe em `rank`: recalcular a
 * posição exigiria saber onde todo mundo está, então quem resolve o rank
 * de verdade é o invalidateQueries que roda logo em seguida.
 */
export function patchRankingMeCache(
  data: RankingMeResponse | undefined,
  userId: string,
  ratingDelta: number,
): RankingMeResponse | undefined {
  if (!data?.entry || data.entry.userId !== userId) return data;
  return { entry: applyRatingDelta(data.entry, ratingDelta) };
}

export function patchRankingListCache(
  data: RankingListPages | undefined,
  userId: string,
  ratingDelta: number,
): RankingListPages | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const idx = page.entries.findIndex((entry) => entry.userId === userId);
    if (idx === -1) return page;
    changed = true;
    const entries = [...page.entries];
    entries[idx] = applyRatingDelta(entries[idx]!, ratingDelta);
    return { ...page, entries };
  });
  return changed ? { ...data, pages } : data;
}
