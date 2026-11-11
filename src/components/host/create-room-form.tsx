"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { LANGUAGES } from "@/lib/domain";

interface CreateRoomResponse {
  ok?: boolean;
  data?: { room?: { joinCode?: string } };
  error?: { message?: string };
}

export function CreateRoomForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: String(formData.get("title") ?? ""),
      hostLanguage: String(formData.get("hostLanguage") ?? "en"),
    };

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | CreateRoomResponse
        | null;

      const joinCode = body?.data?.room?.joinCode;
      if (!response.ok || !body?.ok || !joinCode) {
        setError(
          body?.error?.message ??
            "The room could not be created. Please try again.",
        );
        return;
      }

      router.push(`/host/rooms/${joinCode}`);
      router.refresh();
    } catch {
      setError("The network request failed. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert tone="danger" title="Room not created">
          {error}
        </Alert>
      ) : null}

      <Field
        label="Room title"
        htmlFor="title"
        hint="Use the course, lecture, or session name."
      >
        <Input
          id="title"
          name="title"
          placeholder="PHYS-201 · Waves & Optics"
          required
          minLength={3}
          maxLength={120}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Host language"
        htmlFor="hostLanguage"
        hint="Questions will be shown to you in this language."
      >
        <Select id="hostLanguage" name="hostLanguage" defaultValue="en">
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label} — {language.nativeLabel}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Plus aria-hidden="true" className="size-4" />
        )}
        {pending ? "Opening room…" : "Create room & show QR"}
      </Button>
    </form>
  );
}
