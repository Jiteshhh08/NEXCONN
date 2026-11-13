import type { LiveEventType } from "./contracts";

/**
 * Wire format for the live events Vaani Room publishes into a Nexconn Open
 * Channel.
 *
 * Nexconn text messages carry a plain text body, and the server API has no
 * metadata field, so structured room events are serialized into the message
 * text and recognised by {@link LIVE_EVENT_MARKER}.
 *
 * https://docs.nexconn.ai/platform-chat-api/message/message-about/objectname
 */

export const LIVE_EVENT_MARKER = "vaani.live-event";

/**
 * Sender the server uses when publishing room events. The browser transport
 * only accepts live events from this sender; a student's own channel messages
 * are never treated as authoritative room events.
 */
export const SYSTEM_SENDER_USER_ID = "vaaniSystem";

const LIVE_EVENT_TYPES: readonly LiveEventType[] = [
  "question.created",
  "question.moderated",
  "answer.created",
  "vote.updated",
  "translation.updated",
  "room.closed",
  "presence.updated",
];

function isLiveEventType(value: unknown): value is LiveEventType {
  return (
    typeof value === "string" &&
    (LIVE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export interface EncodedLiveEvent {
  type: LiveEventType;
  roomId: string;
  payload: Record<string, unknown>;
}

interface WireLiveEvent extends EncodedLiveEvent {
  vaani: typeof LIVE_EVENT_MARKER;
}

export function encodeLiveEvent(event: EncodedLiveEvent): string {
  const wire: WireLiveEvent = { vaani: LIVE_EVENT_MARKER, ...event };
  return JSON.stringify(wire);
}

export function decodeLiveEvent(text: string): EncodedLiveEvent | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.vaani !== LIVE_EVENT_MARKER) return null;
  if (!isLiveEventType(candidate.type)) return null;
  if (typeof candidate.roomId !== "string") return null;

  const payload = candidate.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return {
    type: candidate.type,
    roomId: candidate.roomId,
    payload: payload as Record<string, unknown>,
  };
}
