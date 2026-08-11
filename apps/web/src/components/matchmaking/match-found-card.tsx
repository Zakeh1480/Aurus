'use client';

import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const ACCEPT_COUNTDOWN_SECONDS = 10;

type MatchFoundCardProps = {
  matchId: string;
  opponentId: string;
  accepted: boolean;
  onAccept: () => void;
  onLeave: () => void;
};

export function MatchFoundCard({
  matchId,
  opponentId,
  accepted,
  onAccept,
  onLeave,
}: MatchFoundCardProps) {
  const [secondsLeft, setSecondsLeft] = React.useState(ACCEPT_COUNTDOWN_SECONDS);

  React.useEffect(() => {
    setSecondsLeft(ACCEPT_COUNTDOWN_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [matchId]);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <Avatar className="size-16">
          <AvatarFallback className="text-lg">
            {opponentId.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-xl">Adversário encontrado!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        {accepted ? (
          <Alert>
            <AlertDescription>Você aceitou — aguardando o adversário…</AlertDescription>
          </Alert>
        ) : (
          <p className="font-mono text-sm text-muted-foreground">Responda em até {secondsLeft}s</p>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {!accepted && (
          <Button className="flex-1" onClick={onAccept}>
            Aceitar
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={onLeave}>
          Cancelar
        </Button>
      </CardFooter>
    </Card>
  );
}
