import { Languages, QrCode, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Illustrative product preview. It is intentionally static and marked as
 * decorative so screen readers receive the real page content instead.
 */
export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/5 blur-2xl" />

      <Card className="relative overflow-hidden rounded-[1.9rem] p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-muted text-[0.65rem] font-bold text-primary">
              P2
            </span>
            <div>
              <p className="text-xs font-semibold leading-4">PHYS-201</p>
              <p className="text-[0.65rem] text-muted-foreground">
                Waves &amp; Optics · Lecture 08
              </p>
            </div>
          </div>
          <Badge tone="success" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            Live
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border/80 bg-background/70 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-[0.65rem] font-bold text-accent-foreground">
                  A
                </span>
                <span className="text-[0.7rem] font-medium text-muted-foreground">
                  Anonymous · Student
                </span>
              </div>
              <Badge tone="outline">मराठी</Badge>
            </div>
            <p
              lang="mr"
              className="mt-3 text-[0.95rem] font-medium leading-7 text-foreground"
            >
              तरंगलांबी आणि वारंवारता यांचा संबंध कसा सांगाल?
            </p>
          </div>

          <div className="flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-border" />
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
              <Languages className="size-3.5" />
              For the lecturer
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.7rem] font-medium text-muted-foreground">
                Host view
              </span>
              <Badge tone="primary">English</Badge>
            </div>
            <p className="mt-2.5 text-[0.95rem] font-medium leading-6 text-foreground">
              How would you explain the relationship between wavelength and
              frequency?
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground">
              <ThumbsUp className="size-3.5 text-primary" />
              12
            </span>
            <span className="text-[0.68rem] font-medium text-muted-foreground">
              Approved · visible to the room
            </span>
          </div>
        </div>
      </Card>

      <div className="absolute -bottom-7 -right-3 hidden w-36 rotate-2 rounded-2xl border border-border bg-card p-3 shadow-lift sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <QrCode className="size-5" />
          </span>
          <div>
            <p className="text-[0.65rem] font-semibold leading-4">Scan to join</p>
            <p className="text-[0.58rem] text-muted-foreground">
              vaani.room/PHYS201
            </p>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-6 gap-0.5">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className={
                index % 3 === 0 || index % 7 === 0
                  ? "h-1.5 rounded-[1px] bg-foreground/80"
                  : "h-1.5 rounded-[1px] bg-border"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
