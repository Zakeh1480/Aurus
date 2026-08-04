"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { MatchFoundCard } from "@/components/matchmaking/match-found-card";
import { QueueSearchingCard } from "@/components/matchmaking/queue-searching-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMatchmaking } from "@/hooks/use-matchmaking";
import { useSession } from "@/hooks/use-session";
import { resolveQueueEntryHref } from "@/lib/queue-entry";

function LoadingPlaceholder() {
  return <p className="text-center text-sm text-muted-foreground">Carregando…</p>;
}

export function MatchmakingPanel() {
  const router = useRouter();
  const session = useSession();
  const href = resolveQueueEntryHref(session);
  const matchmaking = useMatchmaking();
  const { state } = matchmaking;

  React.useEffect(() => {
    if (href !== null && href !== "/fila") {
      router.replace(href);
    }
  }, [href, router]);

  React.useEffect(() => {
    if (state.status === "redirecting") {
      router.push(`/match/${state.matchId}`);
    }
  }, [state, router]);

  if (href !== "/fila") {
    return <LoadingPlaceholder />;
  }

  return (
    <div className="flex flex-col gap-4">
      {"notice" in state && state.notice && (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      )}

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {(state.status === "idle" || state.status === "error") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pronto para jogar?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Entre na fila para ser pareado com um adversário.</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={!matchmaking.canJoin} onClick={matchmaking.join}>
              {state.status === "error" ? "Tentar novamente" : "Entrar na fila"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {state.status === "queueing" && <QueueSearchingCard onCancel={matchmaking.leave} />}

      {state.status === "matched" && (
        <MatchFoundCard
          matchId={state.matchId}
          opponentId={state.opponentId}
          accepted={state.accepted}
          onAccept={matchmaking.accept}
          onLeave={matchmaking.leave}
        />
      )}

      {state.status === "redirecting" && (
        <p className="text-center text-sm text-muted-foreground">Partida encontrada — entrando na partida…</p>
      )}
    </div>
  );
}
