"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { rankingApi } from "@/lib/api-client";
import { rankingListQueryKey } from "@/lib/query-keys";

/** Mesmo valor do default de RankingListQuerySchema.limit em shared. */
export const RANKING_PAGE_SIZE = 20;

export function useRanking() {
  return useInfiniteQuery({
    queryKey: rankingListQueryKey(RANKING_PAGE_SIZE),
    queryFn: ({ pageParam }) => rankingApi.list({ limit: RANKING_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.entries.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    staleTime: 30_000,
  });
}
