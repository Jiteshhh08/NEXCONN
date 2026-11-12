import { roomClosed } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { createAnswerSchema } from "@/lib/validation";
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
    const input = await parseJson(request, createAnswerSchema);
    const answer = await createAnswer(room, questionId, host.id, input);

    return apiSuccess({ answer }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
