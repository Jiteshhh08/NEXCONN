"use client";

import { LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

interface ApiErrorBody {
  ok?: boolean;
  error?: { message?: string };
}

export function HostAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const payload = isRegister
      ? {
          displayName: String(formData.get("displayName") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }
      : {
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | ApiErrorBody
        | null;

      if (!response.ok || !body?.ok) {
        setError(
          body?.error?.message ??
            "We could not complete that request. Please try again.",
        );
        return;
      }

      router.replace("/host");
      router.refresh();
    } catch {
      setError("The network request failed. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
          {isRegister ? "Create your host account" : "Sign in to your workspace"}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {isRegister
            ? "One account lets you open rooms and keep their history."
            : "Use the email and password you registered with."}
        </p>
      </div>

      {error ? (
        <Alert tone="danger" title="Could not continue">
          {error}
        </Alert>
      ) : null}

      {isRegister ? (
        <Field label="Your name" htmlFor="displayName">
          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Dr. Ananya Rao"
              required
              minLength={2}
              maxLength={60}
              className="pl-11"
            />
          </div>
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email">
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@institute.edu"
            required
            maxLength={200}
            className="pl-11"
          />
        </div>
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint={isRegister ? "At least 10 characters." : undefined}
      >
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="••••••••••"
            required
            minLength={isRegister ? 10 : undefined}
            maxLength={200}
            className="pl-11"
          />
        </div>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {pending
          ? "Please wait…"
          : isRegister
            ? "Create account"
            : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? "Already have an account?" : "New to Vaani Room?"}{" "}
        <Link
          href={isRegister ? "/host/login" : "/host/register"}
          className="font-semibold text-primary hover:underline"
        >
          {isRegister ? "Sign in" : "Create a host account"}
        </Link>
      </p>
    </form>
  );
}
