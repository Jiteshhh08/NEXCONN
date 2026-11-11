import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HostAuthForm } from "@/components/auth/host-auth-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Host sign in",
  description: "Sign in to create rooms and moderate the live question queue.",
};

export const dynamic = "force-dynamic";

const points = [
  "Open a room and share one QR code.",
  "Moderate questions before the room sees them.",
  "Keep the session history after a refresh.",
];

export default async function HostLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "host") redirect("/host");

  return (
    <section className="page-aurora">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <Badge tone="primary">Host access</Badge>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Run the room from one calm place.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Sign in to create a room, display its join code, and keep the
            conversation in one moderated queue.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check aria-hidden="true" className="size-3" />
                </span>
                <span className="leading-6 text-foreground/90">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <Card className="p-6 sm:p-8">
          <HostAuthForm mode="login" />
        </Card>
      </div>
    </section>
  );
}
