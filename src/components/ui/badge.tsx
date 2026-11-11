import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/15 bg-primary/10 text-primary-strong",
  accent: "border-accent/25 bg-accent-soft text-accent-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/20 bg-danger/10 text-danger",
  outline: "border-border bg-transparent text-muted-foreground",
};

export interface BadgeProps extends ComponentProps<"span"> {
  tone?: BadgeTone;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold leading-none tracking-wide",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
