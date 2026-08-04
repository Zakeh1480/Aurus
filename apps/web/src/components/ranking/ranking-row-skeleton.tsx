import { Skeleton } from "@/components/ui/skeleton";

export function RankingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="h-4 w-8 shrink-0" />
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
