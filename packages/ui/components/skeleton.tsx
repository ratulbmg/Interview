import { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

/** One pulsing placeholder block — pages compose these into a skeleton
 * shaped like their own real layout (see each page's own `*Skeleton`
 * component), rather than one generic spinner everywhere. */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
