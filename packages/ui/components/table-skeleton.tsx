import { cn } from "../utils/cn";
import { Skeleton } from "./skeleton";

export interface TableSkeletonColumn {
  /** Column header text — pass "" for an actions-only column with no label. */
  header: string;
  /** Tailwind classes controlling this column's placeholder size/shape —
   * e.g. "h-4 w-40" for plain text, "h-5 w-20 rounded-full" for a
   * badge/pill, "h-8 w-16 rounded-md" for a button. */
  className: string;
  align?: "left" | "right";
}

export interface TableSkeletonProps {
  /** Describes the real table's own columns — this is what makes the same
   * component produce a different-looking skeleton per page, without a
   * new bespoke skeleton component every time a page adds a table. */
  columns: TableSkeletonColumn[];
  rows?: number;
}

/** One reusable table skeleton, shaped per page entirely through the
 * `columns` prop — used by every page with a data table (Users,
 * Candidates, Sessions, Questions, Dashboard's Recent Interviews) instead
 * of each hand-rolling its own near-identical skeleton markup. */
export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className={cn(
                    "px-4 py-3",
                    col.align === "right" && "text-right",
                  )}
                >
                  <Skeleton
                    className={cn(
                      col.className,
                      col.align === "right" && "ml-auto",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
