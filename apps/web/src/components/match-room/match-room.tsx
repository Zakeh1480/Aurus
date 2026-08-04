"use client";

import * as React from "react";
import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLivekitRoom } from "@/hooks/use-livekit-room";
import { useMatchRoom } from "@/hooks/use-match-room";
import type { MatchRoomErrorKind } from "@/lib/match-room-reducer";

import { MatchEndedNotice } from "./match-ended-notice";
import { ResultScreen } from "./result-screen";
import { ScoreHud } from "./score-hud";
import { VerifyChallengeIndicator } from "./verify-challenge-indicator";
import { VideoStage } from "./video-stage";

const ERROR_MESSAGES: Record<MatchRoomErrorKind, string> = {
  "not-found": "Partida não encontrada.",
  forbidden: "Você não participa desta partida.",
  "not-active": "Esta partida não está mais ativa.",
  "permission-denied": "Não foi possível acessar sua câmera/microfone — verifique as permissões do navegador.",
  "connection-failed": "Não foi possível conectar à partida. Tente novamente.",
  timeout: "O resultado da partida demorou demais para chegar.",
};

function ErrorCard({ kind }: { kind: MatchRoomErrorKind }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Não foi possível entrar na partida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{ERROR_MESSAGES[kind]}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/fila">Voltar para a fila</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type MatchRoomProps = { matchId: string };

export function MatchRoom({ matchId }: MatchRoomProps) {
  const { user } = useAuth();
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const livekit = useLivekitRoom(matchId);
  const { state, ownMetrics } = useMatchRoom(matchId, livekit.status, localVideoRef);

  const [liveSince, setLiveSince] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (state.status === "live" && liveSince === null) setLiveSince(Date.now());
  }, [state.status, liveSince]);

  if (!user) return null;

  if (state.status === "error") return <ErrorCard kind={state.kind} />;
  if (state.status === "ended-no-result") return <MatchEndedNotice reason={state.reason} />;
  if (state.status === "result") return <ResultScreen result={state.result} selfUserId={user.id} />;

  return (
    <div className="flex flex-col gap-4">
      <VideoStage
        localVideoTrack={livekit.localVideoTrack}
        remoteVideoTrack={livekit.remoteVideoTrack}
        localVideoRef={localVideoRef}
      />

      {state.status === "connecting" && (
        <p className="text-center text-sm text-muted-foreground">Conectando à partida…</p>
      )}

      {state.status === "live" && liveSince !== null && (
        <>
          <ScoreHud scores={state.scores} ownMetrics={ownMetrics} liveSince={liveSince} />
          {state.pendingChallenge && <VerifyChallengeIndicator />}
        </>
      )}

      {state.status === "ended-awaiting-result" && (
        <p className="text-center text-sm text-muted-foreground">Partida encerrada — calculando o resultado…</p>
      )}
    </div>
  );
}
