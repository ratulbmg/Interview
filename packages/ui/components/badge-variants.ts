import { cva } from "class-variance-authority";

/** Same tinted-pill pattern used throughout the reference design (a
 * status/tag pill hand-rolled per page there too — there's no dedicated
 * Badge component to copy verbatim, just this recurring class shape). */
export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
