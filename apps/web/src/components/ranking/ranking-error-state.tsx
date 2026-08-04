import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type RankingErrorStateProps = {
  onRetry: () => void;
};

export function RankingErrorState({ onRetry }: RankingErrorStateProps) {
  return (
    <Alert variant="destructive" className="flex flex-col gap-3">
      <div>
        <AlertTitle>Não foi possível carregar o ranking</AlertTitle>
        <AlertDescription>Tente novamente em alguns instantes.</AlertDescription>
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={onRetry}>
        Tentar de novo
      </Button>
    </Alert>
  );
}
