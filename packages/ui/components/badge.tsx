import { HTMLAttributes } from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import { badgeVariants } from "./badge-variants";

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
