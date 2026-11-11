"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-24 text-center sm:px-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger">
        <RefreshCw aria-hidden="true" className="size-5" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em]">
        Something slipped out of the room.
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The page hit an unexpected error. You can retry without losing your
        place.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RefreshCw aria-hidden="true" className="size-4" />
        Try again
      </Button>
    </section>
  );
}
