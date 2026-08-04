"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRankingMe } from "@/hooks/use-ranking-me";

import { RankingRow } from "./ranking-row";
import { RankingRowSkeleton } from "./ranking-row-skeleton";

export function RankingMeCard() {
  const { data, isPending } = useRankingMe();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sua posição</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? <RankingRowSkeleton /> : null}
        {!isPending && data?.entry ? <RankingRow entry={data.entry} isSelf /> : null}
        {!isPending && data && !data.entry ? (
          <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
            <p>Jogue sua primeira partida para entrar no ranking.</p>
            <Button asChild size="sm">
              <Link href="/fila">Entrar na fila</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
