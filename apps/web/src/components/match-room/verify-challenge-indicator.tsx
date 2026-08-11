import { Badge } from '@/components/ui/badge';

export function VerifyChallengeIndicator() {
  return (
    <Badge variant="outline" className="mx-auto animate-pulse">
      Verificando presença…
    </Badge>
  );
}
