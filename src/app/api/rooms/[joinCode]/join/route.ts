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
import { assertOpenRoomForWrite } from "@/server/rooms/access";
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

    // Resolve the identity and join the room in one transaction. A guest user
    // must not be created (and then orphaned) if the room closes between the
    // read above and the participant write below.
    const identity = await prisma.$transaction(async (tx) => {
      await assertOpenRoomForWrite(tx, room.id);

      const user = session
        ? {
            id: session.id,
            displayName: session.displayName ?? input.displayName ?? null,
            created: false,
          }
        : await tx.user
            .create({
              data: {
                displayName: input.displayName ?? null,
                preferredLanguage: input.preferredLanguage,
                role: "student",
                isGuest: true,
              },
              select: { id: true, displayName: true },
            })
            .then((guest) => ({ ...guest, created: true }));

      await tx.participant.upsert({
        where: { roomId_userId: { roomId: room.id, userId: user.id } },
        create: {
          roomId: room.id,
          userId: user.id,
          preferredLanguage: input.preferredLanguage,
          isAnonymous: input.isAnonymous,
        },
        update: {
          isActive: true,
          preferredLanguage: input.preferredLanguage,
          isAnonymous: input.isAnonymous,
        },
      });

      return user;
    });

    // Establish the browser session *before* calling Nexconn. If token
    // issuance fails, the retry can reuse this identity instead of creating a
    // second guest user and inflating the participant count.
    if (identity.created) {
      const sessionRecord = await createSession(identity.id);
      await setSessionCookie(sessionRecord.token, sessionRecord.expiresAt);
    }

    const joined = await buildJoinedRoom({
      room,
      userId: identity.id,
      role: "student",
      displayName: identity.displayName,
      preferredLanguage: input.preferredLanguage,
      isAnonymous: input.isAnonymous,
    });

    return apiSuccess(joined, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
