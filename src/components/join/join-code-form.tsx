"use client";

import { ArrowRight, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!CODE_PATTERN.test(code)) {
      setError("Enter the 6–12 character room code from your host.");
      return;
    }

    router.push(`/join/${code}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert tone="danger" title="Check the code">
          {error}
        </Alert>
      ) : null}

      <label
        htmlFor="joinCode"
        className="block text-sm font-medium text-foreground"
      >
        Room code
      </label>
      <div className="relative">
        <Keyboard
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="joinCode"
          name="joinCode"
          value={code}
          onChange={(event) => {
            setCode(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 12),
            );
            setError(null);
          }}
          placeholder="PHYS201"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          className="pl-11 text-center font-mono text-base font-semibold uppercase tracking-[0.22em]"
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        The code is printed under the QR code. Codes use letters and numbers
        only.
      </p>

      <Button type="submit" className="w-full">
        Find my room
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </form>
  );
}
