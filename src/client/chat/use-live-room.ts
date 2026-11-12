"use client";

import { useEffect, useRef, useState } from "react";

import { NexconnChatTransport } from "@/client/chat/nexconn";
import type { ChatConnectionConfig, LiveEvent } from "@/lib/chat/contracts";

export type LiveStatus = "idle" | "connecting" | "live" | "error";

/**
 * Connects the browser to the room's live channel and forwards decoded events
 * to `onEvent`.
 *
 * Live delivery is an enhancement, never the source of truth: the database API
 * is polled by the caller, and a live event only asks it to refresh sooner. The
 * `local` provider has no browser transport, so the hook stays `idle` and the
 * caller keeps working through polling alone.
 */
export function useLiveRoom(
  config: ChatConnectionConfig | null,
  onEvent: (event: LiveEvent) => void,
): { status: LiveStatus; error: string | null } {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const appKey = config?.appKey ?? null;
  const token = config?.token ?? null;
  const userId = config?.userId ?? null;
  const channelId = config?.channelId ?? null;
  const roomId = config?.roomId ?? null;
  const provider = config?.provider ?? null;

  const active =
    provider === "nexconn" &&
    Boolean(appKey && token && userId && channelId && roomId);

  useEffect(() => {
    if (
      provider !== "nexconn" ||
      !appKey ||
      !token ||
      !userId ||
      !channelId ||
      !roomId
    ) {
      return;
    }

    const transport = new NexconnChatTransport();
    const unsubscribe = transport.onEvent((event) => onEventRef.current(event));
    let cancelled = false;

    void (async () => {
      try {
        await transport.connect({
          appKey,
          token,
          userId,
          channelId,
          roomId,
          provider,
        });
        await transport.joinChannel();
        if (cancelled) return;
        setError(null);
        setStatus("live");
      } catch (connectError) {
        if (cancelled) return;
        setStatus("error");
        setError(
          connectError instanceof Error
            ? connectError.message
            : "The live connection could not be established.",
        );
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      transport.disconnect();
    };
  }, [appKey, token, userId, channelId, roomId, provider]);

  return {
    status: active ? (status === "idle" ? "connecting" : status) : "idle",
    error: active ? error : null,
  };
}
