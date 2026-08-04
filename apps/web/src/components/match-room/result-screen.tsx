import Link from "next/link";
import { AURA_METRIC_KEYS, type AuraScore, type MatchResultPayload } from "@aurafarming/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AURA_METRIC_LABELS } from "@/lib/aura-metric-labels";
import { cn } from "@/lib/utils";

function PlayerBreakdown({ label, score, ratingDelta }: { label: string; score: AuraScore; ratingDelta: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("font-mono text-xs", ratingDelta >= 0 ? "text-success" : "text-destructive")}>
          {ratingDelta >= 0 ? "+" : ""}
          {ratingDelta}
        </span>
      </div>
      <span className="text-center font-mono text-2xl tabular-nums">{Math.round(score.overall * 100)}</span>
      <div className="flex flex-col gap-1.5">
        {AURA_METRIC_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{AURA_METRIC_LABELS[key]}</span>
            <Progress value={score.breakdown[key]} />
          </div>
        ))}
      </div>
    </div>
  );
}

type ResultScreenProps = {
  result: MatchResultPayload;
  selfUserId: string;
};

export function ResultScreen({ result, selfUserId }: ResultScreenProps) {
  const self = result.player1.userId === selfUserId ? result.player1 : result.player2;
  const opponent = result.player1.userId === selfUserId ? result.player2 : result.player1;

  const outcome =
    result.winnerId === null ? "Empate" : result.winnerId === selfUserId ? "Vitória!" : "Derrota";
  const badgeVariant = result.winnerId === null ? "secondary" : result.winnerId === selfUserId ? "success" : "destructive";

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <Badge variant={badgeVariant}>{outcome}</Badge>
        <CardTitle className="text-2xl">Resultado da partida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <PlayerBreakdown label="Você" score={self.score} ratingDelta={self.ratingDelta} />
          <PlayerBreakdown label="Adversário" score={opponent.score} ratingDelta={opponent.ratingDelta} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Posição no ranking não faz parte deste resultado.
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href="/fila">Jogar novamente</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
