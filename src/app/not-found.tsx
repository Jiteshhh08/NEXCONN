import { ArrowLeft, DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-24 text-center sm:px-8">
      <Badge tone="outline">404</Badge>
      <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <DoorOpen aria-hidden="true" className="size-5" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em]">
        This room isn&apos;t on the board.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The page may have moved, or the join link may be incomplete. Check the
        code from your host and try again.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back home
        </Link>
        <Link href="/join" className={buttonVariants()}>
          Join a room
        </Link>
      </div>
    </section>
  );
}
