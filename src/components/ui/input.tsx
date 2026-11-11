import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  "w-full rounded-2xl border border-border bg-card px-4 text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(fieldBase, "h-11 text-sm", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-28 resize-y py-3 text-sm", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(fieldBase, "h-11 pr-9 text-sm", className)}
      {...props}
    />
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
