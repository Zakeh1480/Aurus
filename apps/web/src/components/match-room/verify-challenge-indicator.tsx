import { Badge } from "@/components/ui/badge";

/** Transiente e informativo — a resposta ao challenge é automática, sem ação do jogador. */
export function VerifyChallengeIndicator() {
  return (
    <Badge variant="outline" className="mx-auto animate-pulse">
      Verificando presença…
    </Badge>
  );
}
