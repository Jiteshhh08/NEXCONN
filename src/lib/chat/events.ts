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

/** Metadata keys attached to messages sent by the browser SDK. */
export const MESSAGE_METADATA_KEYS = {
  kind: "vaaniKind",
  roomId: "vaaniRoomId",
  clientNonce: "vaaniClientNonce",
  sourceLanguage: "vaaniSourceLanguage",
  isAnonymous: "vaaniIsAnonymous",
} as const;

/** Metadata value used by a student's own question message. */
export const QUESTION_MESSAGE_KIND = "question.created";

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
  if (typeof candidate.type !== "string") return null;
  if (typeof candidate.roomId !== "string") return null;

  const payload = candidate.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return {
    type: candidate.type as LiveEventType,
    roomId: candidate.roomId,
    payload: payload as Record<string, unknown>,
  };
}
