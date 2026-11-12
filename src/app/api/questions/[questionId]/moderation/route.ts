import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { moderateQuestionSchema } from "@/lib/validation";
import { moderateQuestion } from "@/server/questions/service";
import {
  loadQuestionContext,
  requireRoomOwner,
} from "@/server/rooms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approves, hides or rejects a question. Host-only, and only for a question in
 * a room the host owns.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    assertSameOrigin(request);

    const questionId = (await context.params).questionId;
    const { room } = await loadQuestionContext(questionId);
    await requireRoomOwner(room);

    const input = await parseJson(request, moderateQuestionSchema);
    const question = await moderateQuestion(room, questionId, input.status);

    return apiSuccess({ question });
  } catch (error) {
    return apiError(error);
  }
}
