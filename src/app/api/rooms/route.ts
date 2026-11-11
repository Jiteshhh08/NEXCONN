import { AppError } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { createRoomSchema } from "@/lib/validation";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { requireHost } from "@/server/auth/session";
import {
  createRoomForHost,
  getHostOverview,
  listRoomsForHost,
} from "@/server/rooms/service";
import { buildRoomShare } from "@/server/rooms/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const host = await requireHost();
    const [rooms, overview] = await Promise.all([
      listRoomsForHost(host.id),
      getHostOverview(host.id),
    ]);

    return apiSuccess({ rooms, overview });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const host = await requireHost();

    const limit = checkRateLimit(`rooms:${host.id}`, 30, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "You have created a lot of rooms in a short time. Please try again later.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, createRoomSchema);
    const room = await createRoomForHost(host.id, input);
    const share = await buildRoomShare(room.joinCode);

    return apiSuccess({ room, share }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
