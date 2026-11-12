import { notFound, unauthorized } from "@/lib/api/errors";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getSessionUser } from "@/server/auth/session";
import {
  assertRoomParticipant,
  joinCodeFromParams,
} from "@/server/rooms/access";
import { buildJoinedRoom } from "@/server/rooms/joined";
import { getPublicRoomByCode } from "@/server/rooms/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restores an existing student session for a room.
 *
 * A browser refresh must not drop the student out of the room. The session
 * cookie is HttpOnly and survives the reload, so this route re-resolves the
 * participant from that cookie and re-issues a live-channel token.
 *
 * It is deliberately read-only with respect to membership: it never creates a
 * user or a participant, so refreshing can neither duplicate membership nor
 * change the participant count. A caller who is not a participant of the room
 * gets `403`, and an anonymous caller gets `401` — authorisation stays on the
 * server.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    const joinCode = joinCodeFromParams((await context.params).joinCode);

    const user = await getSessionUser();
    if (!user) throw unauthorized("Join this room before taking part.");

    const room = await getPublicRoomByCode(joinCode);
    if (!room) throw notFound("We could not find that room.");

    const participant = await assertRoomParticipant(room.id, user.id);

    const joined = await buildJoinedRoom({
      room,
      userId: user.id,
      role: user.role,
      displayName: user.displayName,
      preferredLanguage: participant.preferredLanguage,
      isAnonymous: participant.isAnonymous,
    });

    return apiSuccess(joined);
  } catch (error) {
    return apiError(error);
  }
}
