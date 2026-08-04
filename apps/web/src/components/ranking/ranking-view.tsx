"use client";

import * as React from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRanking } from "@/hooks/use-ranking";
import { flattenRankingPages } from "@/lib/ranking-list";

import { RankingEmptyState } from "./ranking-empty-state";
import { RankingErrorState } from "./ranking-error-state";
import { RankingMeCard } from "./ranking-me-card";
import { RankingRow } from "./ranking-row";
import { RankingRowSkeleton } from "./ranking-row-skeleton";

export function RankingView() {
  const { user } = useAuth();
  const rankingQuery = useRanking();
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !rankingQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      ([intersection]) => {
        if (intersection?.isIntersecting && !rankingQuery.isFetchingNextPage) {
          void rankingQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rankingQuery.hasNextPage, rankingQuery.isFetchingNextPage, rankingQuery.fetchNextPage]);

  const entries = flattenRankingPages(rankingQuery.data?.pages);

  return (
    <div className="flex flex-col gap-6">
      <RankingMeCard />

      <Card>
        <CardHeader>
          <CardTitle>Ranking global</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {rankingQuery.isPending
            ? Array.from({ length: 8 }).map((_, index) => <RankingRowSkeleton key={index} />)
            : null}

          {rankingQuery.isError ? <RankingErrorState onRetry={() => void rankingQuery.refetch()} /> : null}

          {!rankingQuery.isPending && !rankingQuery.isError && entries.length === 0 ? <RankingEmptyState /> : null}

          {entries.map((entry) => (
            <RankingRow key={entry.userId} entry={entry} isSelf={entry.userId === user?.id} />
          ))}

          <div ref={sentinelRef} />

          {rankingQuery.hasNextPage ? (
            <Button
              variant="outline"
              onClick={() => void rankingQuery.fetchNextPage()}
              disabled={rankingQuery.isFetchingNextPage}
            >
              {rankingQuery.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
