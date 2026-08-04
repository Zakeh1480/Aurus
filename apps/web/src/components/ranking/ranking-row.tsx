import type { RankingEntry } from "@aurafarming/shared";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RankingRowProps = {
  entry: RankingEntry;
  isSelf: boolean;
};

export function RankingRow({ entry, isSelf }: RankingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border p-3",
        isSelf && "border-primary bg-primary/5",
      )}
    >
      <span className="w-8 shrink-0 text-center font-mono text-sm text-muted-foreground">{entry.rank}</span>
      <Avatar className="size-9">
        <AvatarFallback>{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{entry.displayName}</span>
          {isSelf ? <Badge variant="secondary">Você</Badge> : null}
        </div>
        <span className="text-xs text-muted-foreground">{entry.matchesPlayed} partidas</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-sm tabular-nums">{entry.rating}</span>
        <span className="text-xs text-muted-foreground">{Math.round(entry.auraScoreAvg * 100)} aura</span>
      </div>
    </div>
  );
}
