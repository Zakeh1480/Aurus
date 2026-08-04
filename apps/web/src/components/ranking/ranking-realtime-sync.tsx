"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RankingMeResponse } from "@aurafarming/shared";

import { useAuth } from "@/components/providers/auth-provider";
import { useSocket } from "@/components/providers/socket-provider";
import { RANKING_PAGE_SIZE } from "@/hooks/use-ranking";
import { patchRankingListCache, patchRankingMeCache, type RankingListPages } from "@/lib/ranking-cache";
import { rankingListBaseQueryKey, rankingListQueryKey, rankingMeQueryKey } from "@/lib/query-keys";

/**
 * Sem UI própria. Montado no layout do grupo (protected) para sobreviver à
 * navegação /match/[id] -> tela de resultado -> /ranking. Ouve match:result
 * globalmente, aplica um patch otimista (rating/matchesPlayed) no cache do
 * TanStack Query e invalida em seguida para reconciliar rank/auraScoreAvg
 * com o servidor.
 */
export function RankingRealtimeSync(): null {
  const socket = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const processedMatchResultIds = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!socket || !user) return;

    return socket.on("match:result", (payload) => {
      if (processedMatchResultIds.current.has(payload.id)) return;

      const self =
        payload.player1.userId === user.id
          ? payload.player1
          : payload.player2.userId === user.id
            ? payload.player2
            : null;
      if (!self) return;

      processedMatchResultIds.current.add(payload.id);

      const listKey = rankingListQueryKey(RANKING_PAGE_SIZE);
      queryClient.setQueryData<RankingListPages>(listKey, (data) =>
        patchRankingListCache(data, user.id, self.ratingDelta),
      );
      queryClient.setQueryData<RankingMeResponse>(rankingMeQueryKey, (data) =>
        patchRankingMeCache(data, user.id, self.ratingDelta),
      );

      void queryClient.invalidateQueries({ queryKey: rankingListBaseQueryKey });
      void queryClient.invalidateQueries({ queryKey: rankingMeQueryKey });
    });
  }, [socket, user, queryClient]);

  return null;
}
