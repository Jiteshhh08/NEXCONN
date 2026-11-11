"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type CopyStatus = "idle" | "copied" | "error";

export function CopyLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleCopy}>
      {status === "copied" ? (
        <Check aria-hidden="true" className="size-4 text-success" />
      ) : status === "error" ? (
        <TriangleAlert aria-hidden="true" className="size-4 text-danger" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {status === "copied"
        ? "Copied"
        : status === "error"
          ? "Copy failed"
          : "Copy link"}
    </Button>
  );
}
