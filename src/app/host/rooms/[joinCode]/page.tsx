import {
  ArrowLeft,
  ArrowUpRight,
  MessageSquareText,
  QrCode,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CopyLinkButton } from "@/components/host/copy-link-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLanguage } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { joinCodeSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { getRoomForHost } from "@/server/rooms/service";
import { buildRoomShare } from "@/server/rooms/share";

export const metadata: Metadata = {
  title: "Room",
  description: "Share the room QR code and monitor its activity.",
};

export const dynamic = "force-dynamic";

export default async function HostRoomPage({
  params,
}: {
  params: Promise<{ joinCode: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/host/login");
  if (user.role !== "host") redirect("/join");

  const rawCode = (await params).joinCode;
  const parsed = joinCodeSchema.safeParse(rawCode);
  if (!parsed.success) notFound();

  const room = await getRoomForHost(parsed.data, user.id);
  if (!room) notFound();

  const share = await buildRoomShare(room.joinCode);
  const language = getLanguage(room.hostLanguage);

  return (
    <section className="page-aurora">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/host"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to your rooms
        </Link>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone={room.status === "active" ? "success" : "outline"}>
              {room.status === "active" ? "Active room" : "Closed room"}
            </Badge>
            <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              {room.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Opened {formatDateTime(room.createdAt)} · Host language:{" "}
              {language.label}
              {language.code !== "en" ? ` (${language.nativeLabel})` : ""}
            </p>
          </div>
        </div>

        {room.status === "closed" ? (
          <Alert tone="warning" className="mt-6" title="This room is closed">
            Joins, questions, and votes are no longer accepted. The room and its
            history remain available to you.
          </Alert>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                <QrCode aria-hidden="true" className="size-3.5" />
                Scan to join
              </span>

              <div className="mt-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
                <Image
                  src={share.qrDataUrl}
                  alt={`QR code to join ${room.title}`}
                  width={260}
                  height={260}
                  unoptimized
                  className="h-auto w-[min(68vw,260px)]"
                />
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Room code
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.18em] text-foreground">
                {room.joinCode}
              </p>

              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Students scan the code or open the link, then choose the language
                they want to ask in.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <CopyLinkButton url={share.joinUrl} />
                <Link
                  href={`/join/${room.joinCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Open join page
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Share the link</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Paste it in the chat, or keep the QR code on the projector.
              </p>
              <p className="mt-3 break-all rounded-xl border border-border bg-background/70 p-3 font-mono text-[0.7rem] leading-5 text-foreground/80">
                {share.joinUrl}
              </p>
              <div className="mt-3">
                <CopyLinkButton url={share.joinUrl} />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">Room activity</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-2 text-muted-foreground">
                    <MessageSquareText
                      aria-hidden="true"
                      className="size-4 text-primary"
                    />
                    Questions
                  </dt>
                  <dd className="font-semibold">{room.questionCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-2 text-muted-foreground">
                    <Users aria-hidden="true" className="size-4 text-primary" />
                    Joined
                  </dt>
                  <dd className="font-semibold">{room.participantCount}</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">What happens next</h2>
              <ol className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
                <li className="flex gap-2.5">
                  <ScanLine
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  A student scans the code and picks a language.
                </li>
                <li className="flex gap-2.5">
                  <MessageSquareText
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  Their question arrives in your live queue.
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  You approve it before the room sees it.
                </li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
