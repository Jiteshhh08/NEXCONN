import {
  ArrowRight,
  CalendarClock,
  ListChecks,
  MessageSquareText,
  Plus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateRoomForm } from "@/components/host/create-room-form";
import { SignOutButton } from "@/components/host/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/server/auth/session";
import { getHostOverview, listRoomsForHost } from "@/server/rooms/service";

export const metadata: Metadata = {
  title: "Host workspace",
  description: "Create rooms, share the QR code, and keep the question queue moving.",
};

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const user = await getSessionUser();
  if (!user) redirect("/host/login");
  if (user.role !== "host") redirect("/join");

  const [rooms, overview] = await Promise.all([
    listRoomsForHost(user.id),
    getHostOverview(user.id),
  ]);

  const name = user.displayName ?? user.email ?? "host";
  const stats = [
    {
      icon: CalendarClock,
      label: "Active rooms",
      value: overview.activeRooms,
    },
    {
      icon: MessageSquareText,
      label: "Questions asked",
      value: overview.totalQuestions,
    },
    {
      icon: Users,
      label: "Participants",
      value: overview.totalParticipants,
    },
  ];

  return (
    <section className="page-aurora">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone="primary">Host workspace</Badge>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Good to see you, {name}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Open a room, show the QR code, and every question lands in one
              moderated queue.
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="rounded-2xl p-5 shadow-none">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/8 text-primary">
                <stat.icon aria-hidden="true" className="size-4.5" />
              </span>
              <p className="mt-4 font-display text-2xl font-semibold">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {stat.label}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                Your rooms
              </h2>
              <span className="text-xs font-medium text-muted-foreground">
                {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
              </span>
            </div>

            {rooms.length === 0 ? (
              <Card className="mt-4 rounded-2xl border-dashed p-8 text-center shadow-none">
                <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">No rooms yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  Create your first room. You will get a join code and a QR code
                  you can put on the projector.
                </p>
              </Card>
            ) : (
              <ul className="mt-4 space-y-3">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/host/rooms/${room.joinCode}`}
                      className="group block rounded-2xl border border-border bg-card p-5 shadow-none transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {room.title}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono font-semibold tracking-wider text-foreground/80">
                              {room.joinCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatDate(room.createdAt)}</span>
                          </p>
                        </div>
                        <Badge tone={room.status === "active" ? "success" : "outline"}>
                          {room.status === "active" ? "Active" : "Closed"}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5">
                            <MessageSquareText
                              aria-hidden="true"
                              className="size-3.5"
                            />
                            {room.questionCount} questions
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users aria-hidden="true" className="size-3.5" />
                            {room.participantCount} joined
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          Open
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5 transition group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card className="p-6 lg:sticky lg:top-24">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Plus aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Open a new room</h2>
                <p className="text-xs text-muted-foreground">
                  Takes a few seconds.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <CreateRoomForm />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
