import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  joinCodeFromParams,
  loadRoomByCode,
  requireRoomOwner,
} from "@/server/rooms/access";
import { closeRoomForHost } from "@/server/rooms/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Closes a room. After this, join, question, vote and answer routes reject the
 * room. Only the host that owns the room can close it.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    assertSameOrigin(request);

    const joinCode = joinCodeFromParams((await context.params).joinCode);
    const room = await loadRoomByCode(joinCode);
    await requireRoomOwner(room);

    await closeRoomForHost(room);

    return apiSuccess({
      room: { id: room.id, joinCode: room.joinCode, status: "closed" },
    });
  } catch (error) {
    return apiError(error);
  }
}
