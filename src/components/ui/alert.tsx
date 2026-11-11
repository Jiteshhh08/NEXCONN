import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<
  AlertTone,
  { wrapper: string; icon: LucideIcon }
> = {
  info: {
    wrapper: "border-primary/15 bg-primary/5 text-foreground",
    icon: Info,
  },
  success: {
    wrapper: "border-success/20 bg-success/5 text-foreground",
    icon: CircleCheck,
  },
  warning: {
    wrapper: "border-warning/25 bg-warning/5 text-foreground",
    icon: AlertTriangle,
  },
  danger: {
    wrapper: "border-danger/20 bg-danger/5 text-foreground",
    icon: CircleX,
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: AlertProps) {
  const config = tones[tone];
  const Icon = config.icon;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-2xl border p-4 text-sm leading-6",
        config.wrapper,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "info" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cn(title && "mt-1", "text-muted-foreground")}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
