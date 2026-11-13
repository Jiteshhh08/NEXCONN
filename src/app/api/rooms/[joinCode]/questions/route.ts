import { AppError, unauthorized } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import {
  historyQuerySchema,
  submitQuestionSchema,
  type HistoryQuery,
} from "@/lib/validation";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import {
  createQuestion,
  listQuestions,
} from "@/server/questions/service";
import {
  assertRoomParticipant,
  joinCodeFromParams,
  loadRoomByCode,
  requireOpenRoom,
  requireRoomParticipant,
} from "@/server/rooms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseListQuery(request: Request): HistoryQuery {
  const params = new URL(request.url).searchParams;
  const candidate: Record<string, unknown> = {};

  const cursor = params.get("cursor");
  if (cursor) candidate.cursor = cursor;
  const limit = params.get("limit");
  if (limit) candidate.limit = limit;

  const parsed = historyQuerySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The query parameters are not valid.",
      422,
    );
  }

  return parsed.data;
}

/**
 * Lists the questions visible to the caller. The host of the room sees the
 * whole queue; a participant sees approved questions plus their own.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    const joinCode = joinCodeFromParams((await context.params).joinCode);
    const room = await loadRoomByCode(joinCode);
    const query = parseListQuery(request);

    const user = await getSessionUser();

    if (user && user.id === room.hostUserId) {
      const page = await listQuestions(room, { kind: "host" }, query);
      return apiSuccess(page);
    }

    if (!user) {
      throw unauthorized("Join this room before viewing its questions.");
    }

    await assertRoomParticipant(room.id, user.id);
    const page = await listQuestions(
      room,
      { kind: "student", userId: user.id },
      query,
    );

    return apiSuccess(page);
  } catch (error) {
    return apiError(error);
  }
}

/** Submits a question. Requires an open room and a joined participant. */
export async function POST(
  request: Request,
  context: { params: Promise<{ joinCode: string }> },
) {
  try {
    assertSameOrigin(request);

    const joinCode = joinCodeFromParams((await context.params).joinCode);
    const room = await requireOpenRoom(joinCode);
    const participant = await requireRoomParticipant(room);

    const limit = checkRateLimit(
      `question:${participant.id}`,
      20,
      60 * 1000,
    );
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "You are asking very quickly. Please wait a moment before sending again.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, submitQuestionSchema);
    const question = await createQuestion(room, participant.id, input);

    return apiSuccess({ question }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
