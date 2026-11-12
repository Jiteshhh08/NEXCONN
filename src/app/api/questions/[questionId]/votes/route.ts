import { AppError, roomClosed } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { castVote, removeVote } from "@/server/questions/service";
import {
  loadQuestionContext,
  requireRoomParticipant,
} from "@/server/rooms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertVoteRateLimit(userId: string): void {
  const limit = checkRateLimit(`vote:${userId}`, 60, 60 * 1000);
  if (!limit.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "You are voting very quickly. Please wait a moment and try again.",
      429,
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }
}

/** Records the participant's upvote. Duplicate votes are rejected (409). */
export async function POST(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    assertSameOrigin(request);

    const questionId = (await context.params).questionId;
    const { room } = await loadQuestionContext(questionId);
    if (room.status === "closed") throw roomClosed();

    const participant = await requireRoomParticipant(room);
    assertVoteRateLimit(participant.id);
    const result = await castVote(room, questionId, participant.id);

    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/** Removes the participant's upvote. Idempotent. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    assertSameOrigin(request);

    const questionId = (await context.params).questionId;
    const { room } = await loadQuestionContext(questionId);
    if (room.status === "closed") throw roomClosed();

    const participant = await requireRoomParticipant(room);
    assertVoteRateLimit(participant.id);
    const result = await removeVote(room, questionId, participant.id);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
