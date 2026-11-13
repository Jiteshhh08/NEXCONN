import {
  ArrowLeft,
  CalendarClock,
  Languages,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLanguage } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { joinCodeSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { getPublicRoomByCode } from "@/server/rooms/service";

import { JoinRoomClient } from "./join-room-client";

export const metadata: Metadata = {
  title: "Room",
  description: "You are one step away from joining the conversation.",
};

export const dynamic = "force-dynamic";

export default async function JoinRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const rawCode = (await params).code;
  const parsed = joinCodeSchema.safeParse(rawCode);

  if (!parsed.success) {
    return <MissingRoom code={rawCode} />;
  }

  const room = await getPublicRoomByCode(parsed.data);
  if (!room) {
    return <MissingRoom code={parsed.data} />;
  }

  // Opening your own share link must not turn the host into a student entry in
  // their own room. Send the owner to the console that controls this room.
  const user = await getSessionUser();
  if (user && user.id === room.hostUserId) {
    redirect(`/host/rooms/${room.joinCode}`);
  }

  const hostLanguage = getLanguage(room.hostLanguage);

  return (
    <section className="page-aurora">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Use a different code
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge tone={room.status === "active" ? "success" : "outline"}>
            {room.status === "active" ? "Room is open" : "Room closed"}
          </Badge>
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-muted-foreground">
            {room.joinCode}
          </span>
        </div>

        <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {room.title}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>Hosted by {room.hostName}</span>
          <span className="inline-flex items-center gap-1.5">
            <Languages aria-hidden="true" className="size-4" />
            Host language: {hostLanguage.label}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4" />
            {room.participantCount} joined
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-4" />
            {formatDate(room.createdAt)}
          </span>
        </p>

        {room.status === "closed" ? (
          <Card className="mt-8 p-6 sm:p-8">
            <Alert tone="warning" title="This room has closed">
              The host has ended this session, so new questions and votes are no
              longer accepted. Ask your host for the next room code.
            </Alert>
            <Link
              href="/join"
              className={buttonVariants({
                variant: "secondary",
                className: "mt-6",
              })}
            >
              Try another room
            </Link>
          </Card>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <JoinRoomClient
              joinCode={room.joinCode}
              hostLanguage={room.hostLanguage}
            />

            <Card className="p-6 sm:p-8">
              <h2 className="text-sm font-semibold">How the room works</h2>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                    <Languages aria-hidden="true" className="size-4" />
                  </span>
                  <span className="leading-6 text-foreground/90">
                    Pick the language you are comfortable asking in.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                    <MessageSquareText aria-hidden="true" className="size-4" />
                  </span>
                  <span className="leading-6 text-foreground/90">
                    Ask a question and upvote the ones you also want answered.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  </span>
                  <span className="leading-6 text-foreground/90">
                    The host approves questions before they reach the room board.
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function MissingRoom({ code }: { code: string }) {
  return (
    <section className="page-aurora">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-20 text-center sm:px-8">
        <Badge tone="outline">Room code {code}</Badge>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em]">
          We could not find that room.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Check the code from the projector or handout. Codes contain 6 to 12
          letters and numbers, and a closed or mistyped room will not open.
        </p>
        <Link
          href="/join"
          className={buttonVariants({ variant: "secondary", className: "mt-7" })}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Try another code
        </Link>
      </div>
    </section>
  );
}
