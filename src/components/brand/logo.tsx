import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  showTagline?: boolean;
  inverse?: boolean;
}

export function Logo({
  className,
  showTagline = true,
  inverse = false,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 place-items-center rounded-[0.8rem] shadow-sm",
          inverse
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground",
        )}
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6.25A2.75 2.75 0 0 1 6.75 3.5h10.5A2.75 2.75 0 0 1 20 6.25v6.5a2.75 2.75 0 0 1-2.75 2.75H10.5l-4.72 3.7a.9.9 0 0 1-1.45-.72V15.2A2.75 2.75 0 0 1 4 12.75v-6.5Z"
            fill="currentColor"
          />
          <path
            d="M8.4 7.6v4.1M12 6.4v5.3M15.6 7.6v4.1"
            stroke="var(--color-primary)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "block font-display text-[1.07rem] font-semibold tracking-[-0.025em]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          Vaani Room
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 block text-[0.6rem] font-semibold uppercase tracking-[0.2em]",
              inverse ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            Multilingual live Q&amp;A
          </span>
        ) : null}
      </span>
    </span>
  );
}
