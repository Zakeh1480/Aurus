import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REASON_MESSAGES = {
  disconnected: "A partida foi encerrada sem gerar um resultado — pode ter havido uma desconexão ou dados insuficientes para pontuar.",
  cancelled: "A partida foi cancelada.",
} as const;

type MatchEndedNoticeProps = { reason: "disconnected" | "cancelled" };

/** reason "completed" nunca chega aqui — vira ResultScreen. Este componente é só o caminho sem breakdown. */
export function MatchEndedNotice({ reason }: MatchEndedNoticeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Partida encerrada</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>{REASON_MESSAGES[reason]}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/fila">Voltar para a fila</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
