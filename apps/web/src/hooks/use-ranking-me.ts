"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { rankingApi } from "@/lib/api-client";
import { rankingMeQueryKey } from "@/lib/query-keys";

export function useRankingMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: rankingMeQueryKey,
    queryFn: rankingApi.me,
    enabled: status === "authenticated",
    staleTime: 30_000,
  });
}
