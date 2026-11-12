import "server-only";

import type { LiveEventType } from "@/lib/chat/contracts";
import { getChatProvider } from "@/server/chat";

/**
 * Publishes a structured room event to the room's live channel.
 *
 * Live delivery is best-effort: the application database is the source of
 * truth (README, "How it works"), so a failed publish must never fail the
 * underlying write. Payloads carry identifiers and state only — never
 * unmoderated question text, which would leak past moderation to every
 * participant in the channel.
 */
export async function publishRoomEvent(
  channelId: string | null,
  roomId: string,
  type: LiveEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!channelId) return;

  try {
    await getChatProvider().publishEvent({ channelId, roomId, type, payload });
  } catch (error) {
    console.error(
      `[chat] Failed to publish ${type} for room ${roomId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
