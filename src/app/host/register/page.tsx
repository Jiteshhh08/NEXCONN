import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HostAuthForm } from "@/components/auth/host-auth-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Create a host account",
  description: "Create a host account to open a Vaani Room and share its QR code.",
};

export const dynamic = "force-dynamic";

const points = [
  "No student accounts to manage.",
  "Students join from any browser with a code.",
  "Your rooms and history stay available to you.",
];

export default async function HostRegisterPage() {
  const user = await getSessionUser();
  if (user?.role === "host") redirect("/host");

  return (
    <section className="page-aurora">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <Badge tone="accent">Get started</Badge>
          <h1 className="mt-5 max-w-xl font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Open a room in less than a minute.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            A host account is only for the lecturer or presenter. Students never
            need one — they join with the room code.
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
          <HostAuthForm mode="register" />
        </Card>
      </div>
    </section>
  );
}
