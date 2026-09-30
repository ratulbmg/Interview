import { cn } from "../utils/cn";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

export interface StatCardSkeletonProps {
  /** Width of the value placeholder — vary it per stat so a row of these
   * doesn't look like identical, mechanically repeated blocks. */
  valueClassName?: string;
}

/** One stat-card-shaped skeleton — reused wherever a page shows a row of
 * label/value stat cards (Dashboard's summary row, the AI Usage page's
 * metrics grid) instead of each page rebuilding the same two bars. */
export function StatCardSkeleton({
  valueClassName = "h-7 w-16",
}: StatCardSkeletonProps) {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className={cn("mt-2", valueClassName)} />
    </Card>
  );
}
