import type { RankingEntry, RankingListResponse } from '@aurafarming/shared';

export function flattenRankingPages(pages: RankingListResponse[] | undefined): RankingEntry[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const result: RankingEntry[] = [];
  for (const page of pages) {
    for (const entry of page.entries) {
      if (seen.has(entry.userId)) continue;
      seen.add(entry.userId);
      result.push(entry);
    }
  }
  return result;
}
