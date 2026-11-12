import { AppError, roomClosed } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { createAnswerSchema } from "@/lib/validation";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { createAnswer } from "@/server/questions/service";
import {
  loadQuestionContext,
  requireRoomOwner,
} from "@/server/rooms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publishes the host's answer to a question. Host-only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    assertSameOrigin(request);

    const questionId = (await context.params).questionId;
    const { room } = await loadQuestionContext(questionId);
    if (room.status === "closed") throw roomClosed();

    const host = await requireRoomOwner(room);

    const limit = checkRateLimit(`answer:${host.id}`, 30, 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "You are publishing answers very quickly. Please wait a moment and try again.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, createAnswerSchema);
    const answer = await createAnswer(room, questionId, host.id, input);

    return apiSuccess({ answer }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
