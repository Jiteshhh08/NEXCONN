import { AppError, notFound, roomClosed } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { joinCodeSchema, joinRoomSchema } from "@/lib/validation";
import { checkRateLimit, getClientKey } from "@/server/auth/rate-limit";
import {
  createSession,
  getSessionUser,
  setSessionCookie,
} from "@/server/auth/session";
import { buildJoinedRoom } from "@/server/rooms/joined";
import { getPublicRoomByCode } from "@/server/rooms/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Joins a room and returns everything the browser needs to connect to the live
 * channel.
 *
 * The Nexconn access token is issued here, on the server, from the App Key and
 * App Secret. The browser only ever receives the App Key, the user token, and
 * the channel identifier — never the App Secret.
 *
 * Source: https://docs.nexconn.ai/platform-chat-api/user/register
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    assertSameOrigin(request);

    const parsedCode = joinCodeSchema.safeParse(
      (await context.params).joinCode,
    );
    if (!parsedCode.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "That room code is not valid.",
        422,
      );
    }

    const limit = checkRateLimit(getClientKey(request, "join"), 30, 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many join attempts. Please wait a moment and try again.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, joinRoomSchema);

    const room = await getPublicRoomByCode(parsedCode.data);
    if (!room) throw notFound("We could not find that room.");
    if (room.status === "closed") throw roomClosed();

    const session = await getSessionUser();

    let userId: string;
    let displayName: string | null;
    let createdGuestSession = false;

    if (session) {
      userId = session.id;
      displayName = session.displayName ?? input.displayName ?? null;
    } else {
      const guest = await prisma.user.create({
        data: {
          displayName: input.displayName ?? null,
          preferredLanguage: input.preferredLanguage,
          role: "student",
          isGuest: true,
        },
        select: { id: true, displayName: true },
      });

      userId = guest.id;
      displayName = guest.displayName;
      createdGuestSession = true;
    }

    await prisma.participant.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: { roomId: room.id, userId },
      update: { isActive: true },
    });

    const joined = await buildJoinedRoom({
      room,
      userId,
      role: "student",
      displayName,
      preferredLanguage: input.preferredLanguage,
      isAnonymous: input.isAnonymous,
    });

    if (createdGuestSession) {
      const sessionRecord = await createSession(userId);
      await setSessionCookie(sessionRecord.token, sessionRecord.expiresAt);
    }

    return apiSuccess(joined, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
