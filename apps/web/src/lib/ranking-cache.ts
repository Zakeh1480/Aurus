import type { InfiniteData } from '@tanstack/react-query';
import type { RankingEntry, RankingListResponse, RankingMeResponse } from '@aurafarming/shared';

export type RankingListPages = InfiniteData<RankingListResponse, number>;

function applyRatingDelta(entry: RankingEntry, ratingDelta: number): RankingEntry {
  return { ...entry, rating: entry.rating + ratingDelta, matchesPlayed: entry.matchesPlayed + 1 };
}

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
