import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getChatProvider } from "@/server/chat";
import {
  joinCodeFromParams,
  loadRoomByCode,
  requireRoomOwner,
} from "@/server/rooms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues the host's own live-channel token so the host console receives the
 * same channel events students do.
 *
 * Owner-only. The Nexconn token is minted on the server from the App Key and
 * App Secret; the browser only ever receives the App Key, the user token and
 * the channel identifier.
 *
 * Source: https://docs.nexconn.ai/platform-chat-api/user/register
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    assertSameOrigin(request);

    const joinCode = joinCodeFromParams((await context.params).joinCode);
    const room = await loadRoomByCode(joinCode);
    const host = await requireRoomOwner(room);

    const chat = await getChatProvider().issueUserToken({
      userId: host.id,
      roomId: room.id,
      role: "host",
      displayName: host.displayName,
    });

    return apiSuccess({ chat });
  } catch (error) {
    return apiError(error);
  }
}
