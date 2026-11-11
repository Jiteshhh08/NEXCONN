import { ArrowLeft, Languages, MessageSquareText, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { JoinCodeForm } from "@/components/join/join-code-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LANGUAGES } from "@/lib/domain";

export const metadata: Metadata = {
  title: "Join a room",
  description:
    "Join a Vaani Room from any browser, choose your language, and ask your question.",
};

export default function JoinPage() {
  return (
    <section className="page-aurora">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <Badge tone="accent">
            <QrCode aria-hidden="true" className="size-3.5" />
            Student view
          </Badge>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            A question in your language belongs in the room.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Scan the room QR code, or type the code your host shared. No app and
            no account needed.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {LANGUAGES.slice(1, 9).map((language) => (
              <span
                key={language.code}
                lang={language.code}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                {language.nativeLabel}
              </span>
            ))}
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <QrCode aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Enter your room code</p>
              <p className="text-xs text-muted-foreground">
                It is on the screen or the handout.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <JoinCodeForm />
          </div>

          <div className="mt-7 rounded-2xl border border-dashed border-border bg-background/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Once you are in
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-foreground/90">
              <li className="flex items-center gap-2">
                <Languages aria-hidden="true" className="size-4 text-primary" />
                Pick the language you think in
              </li>
              <li className="flex items-center gap-2">
                <MessageSquareText
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                Ask and upvote questions
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "mt-6",
            })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to overview
          </Link>
        </Card>
      </div>
    </section>
  );
}
