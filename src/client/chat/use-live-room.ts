"use client";

import { useEffect, useRef, useState } from "react";

import { NexconnChatTransport } from "@/client/chat/nexconn";
import type { ChatConnectionConfig, LiveEvent } from "@/lib/chat/contracts";

export type LiveStatus = "idle" | "connecting" | "live" | "error";

/**
 * Backoff between connection attempts. The initial attempt is followed by
 * three retries, after which the hook settles on `error` and the caller keeps
 * working through polling. Retrying a bounded number of times avoids both a
 * permanently "Offline" room after one transient failure and an endless
 * reconnect loop that would churn the SDK.
 */
const CONNECT_RETRY_DELAYS_MS = [1_000, 3_000, 7_000] as const;

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

    // One transport and one listener registration for the whole effect, so
    // retries can never double up on events.
    const transport = new NexconnChatTransport();
    const unsubscribe = transport.onEvent((event) => onEventRef.current(event));
    let cancelled = false;
    let cancelSleep: (() => void) | null = null;

    const sleep = (delayMs: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          cancelSleep = null;
          resolve();
        }, delayMs);

        cancelSleep = () => {
          window.clearTimeout(timer);
          cancelSleep = null;
          resolve();
        };
      });

    void (async () => {
      let lastMessage = "The live connection could not be established.";

      for (
        let attempt = 0;
        attempt <= CONNECT_RETRY_DELAYS_MS.length;
        attempt += 1
      ) {
        if (cancelled) return;

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
          return;
        } catch (connectError) {
          lastMessage =
            connectError instanceof Error
              ? connectError.message
              : lastMessage;
        }

        const delay = CONNECT_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await sleep(delay);
      }

      if (cancelled) return;
      setStatus("error");
      setError(lastMessage);
    })();

    return () => {
      cancelled = true;
      cancelSleep?.();
      unsubscribe();
      transport.disconnect();
    };
  }, [appKey, token, userId, channelId, roomId, provider]);

  return {
    status: active ? (status === "idle" ? "connecting" : status) : "idle",
    error: active ? error : null,
  };
}
