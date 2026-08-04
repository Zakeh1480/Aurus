import { Zap } from "lucide-react";

import { QueueEntryButton } from "@/components/home/queue-entry-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <Zap className="text-primary" />
        Temporada de fundação
      </Badge>

      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Sua presença, <span className="text-primary">medida</span>.
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          Partidas 1x1 com câmera. A IA analisa postura, contato visual e presença para gerar seu Aura Score e subir
          no ranking.
        </p>
      </div>

      <div className="flex gap-3">
        <QueueEntryButton />
        <Button size="lg" variant="outline">
          Ver ranking
        </Button>
      </div>

      <Card className="mt-8 w-full max-w-sm text-left">
        <CardHeader>
          <CardTitle className="font-mono text-3xl text-primary">87</CardTitle>
          <CardDescription>Aura Score médio da última partida</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Postura, contato visual, expressão, presença e movimento — combinados numa única métrica auditável.
        </CardContent>
      </Card>
    </main>
  );
}
