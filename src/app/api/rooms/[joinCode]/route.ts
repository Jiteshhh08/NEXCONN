import { notFound } from "@/lib/api/errors";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  joinCodeFromParams,
  loadRoomByCode,
} from "@/server/rooms/access";
import { getPublicRoomByCode } from "@/server/rooms/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public room details for a join page. Returns only what a QR visitor needs;
 * the host's internal ids are not exposed.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    const joinCode = joinCodeFromParams((await context.params).joinCode);
    await loadRoomByCode(joinCode);

    const room = await getPublicRoomByCode(joinCode);
    if (!room) throw notFound("We could not find that room.");

    return apiSuccess({ room });
  } catch (error) {
    return apiError(error);
  }
}
