import "server-only";

import { Prisma } from "@prisma/client";

import { AppError, forbidden, notFound } from "@/lib/api/errors";
import { MODERATION_STATUSES } from "@/lib/domain";
import type { HostModerationAction, ModerationStatus } from "@/lib/domain";
import { prisma } from "@/lib/db";
import type { AnswerSummary, QuestionSummary } from "@/lib/room/types";
import type { CreateAnswerInput, SubmitQuestionInput } from "@/lib/validation";
import { publishRoomEvent } from "@/server/chat/live";
import {
  assertOpenRoomForWrite,
  type RoomAccessSnapshot,
} from "@/server/rooms/access";

/**
 * Questions, votes, moderation and answers.
 *
 * The database is the source of truth: every write persists first and only
 * then publishes a best-effort live event. Duplicate protection is enforced by
 * the schema's unique constraints, not by a read-then-write check:
 *   - Question: unique (roomId, clientNonce)  -> idempotent submission
 *   - Vote:     unique (questionId, userId)   -> one vote per participant
 */

export type QuestionViewer =
  | { kind: "host" }
  | { kind: "student"; userId: string };

const answerSelect = {
  id: true,
  answerText: true,
  answerLanguage: true,
  isPinned: true,
  createdAt: true,
} satisfies Prisma.AnswerSelect;

type AnswerRow = Prisma.AnswerGetPayload<{ select: typeof answerSelect }>;

const questionSelect = {
  id: true,
  roomId: true,
  askedByUserId: true,
  originalText: true,
  sourceLanguage: true,
  hostTranslation: true,
  isAnonymous: true,
  moderationStatus: true,
  upvoteCount: true,
  createdAt: true,
  answers: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: answerSelect,
  },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function toModerationStatus(value: string): ModerationStatus {
  return (MODERATION_STATUSES as readonly string[]).includes(value)
    ? (value as ModerationStatus)
    : "pending";
}

function toAnswerSummary(row: AnswerRow): AnswerSummary {
  return {
    id: row.id,
    answerText: row.answerText,
    answerLanguage: row.answerLanguage,
    isPinned: row.isPinned,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSummary(
  row: QuestionRow,
  viewer: QuestionViewer,
  hasVoted: boolean,
): QuestionSummary {
  const viewerUserId = viewer.kind === "student" ? viewer.userId : null;
  const canSeeAuthor =
    (viewer.kind === "host" || viewerUserId === row.askedByUserId) &&
    (!row.isAnonymous || viewerUserId === row.askedByUserId);
  const latestAnswer = row.answers[0];

  return {
    id: row.id,
    roomId: row.roomId,
    askedByUserId: canSeeAuthor ? row.askedByUserId : null,
    originalText: row.originalText,
    sourceLanguage: row.sourceLanguage,
    hostTranslation: row.hostTranslation,
    isAnonymous: row.isAnonymous,
    moderationStatus: toModerationStatus(row.moderationStatus),
    upvoteCount: row.upvoteCount,
    createdAt: row.createdAt.toISOString(),
    hasVoted,
    answer: latestAnswer ? toAnswerSummary(latestAnswer) : null,
  };
}

/**
 * Creates a question, or returns the existing one when the same client nonce
 * is retried. Submitting twice with one nonce must never create two rows.
 */
export async function createQuestion(
  room: RoomAccessSnapshot,
  authorUserId: string,
  input: SubmitQuestionInput,
): Promise<QuestionSummary> {
  const viewer: QuestionViewer = { kind: "student", userId: authorUserId };
  const nonceWhere = {
    roomId_clientNonce: {
      roomId: room.id,
      clientNonce: input.clientNonce,
    },
  };

  const existing = await prisma.question.findUnique({
    where: nonceWhere,
    select: questionSelect,
  });
  if (existing) {
    if (existing.askedByUserId !== authorUserId) {
      throw new AppError(
        "CONFLICT",
        "That client nonce has already been used.",
        409,
      );
    }
    return toSummary(existing, viewer, false);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertOpenRoomForWrite(tx, room.id);
      return tx.question.create({
        data: {
          roomId: room.id,
          askedByUserId: authorUserId,
          clientNonce: input.clientNonce,
          originalText: input.text,
          sourceLanguage: input.sourceLanguage,
          isAnonymous: input.isAnonymous,
        },
        select: questionSelect,
      });
    });

    await publishRoomEvent(room.nexconnChannelId, room.id, "question.created", {
      questionId: created.id,
      sourceLanguage: created.sourceLanguage,
      isAnonymous: created.isAnonymous,
    });

    return toSummary(created, viewer, false);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await prisma.question.findUnique({
        where: nonceWhere,
        select: questionSelect,
      });
      if (raced) {
        if (raced.askedByUserId !== authorUserId) {
          throw new AppError(
            "CONFLICT",
            "That client nonce has already been used.",
            409,
          );
        }
        return toSummary(raced, viewer, false);
      }
    }
    throw error;
  }
}

/**
 * Lists questions for a viewer. The host sees the full queue; a participant
 * sees approved questions plus their own (so they can see their pending one).
 */
export async function listQuestions(
  room: RoomAccessSnapshot,
  viewer: QuestionViewer,
  options: { limit: number; cursor?: string },
): Promise<QuestionSummary[]> {
  const where: Prisma.QuestionWhereInput = { roomId: room.id };

  if (viewer.kind === "student") {
    where.OR = [
      { moderationStatus: "approved" },
      { askedByUserId: viewer.userId },
    ];
  }

  if (options.cursor) {
    const anchor = await prisma.question.findUnique({
      where: { id: options.cursor },
      select: { createdAt: true },
    });
    if (anchor) where.createdAt = { lt: anchor.createdAt };
  }

  const rows = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit,
    select: questionSelect,
  });

  if (viewer.kind !== "student" || rows.length === 0) {
    return rows.map((row) => toSummary(row, viewer, false));
  }

  const votes = await prisma.vote.findMany({
    where: {
      userId: viewer.userId,
      questionId: { in: rows.map((row) => row.id) },
    },
    select: { questionId: true },
  });
  const voted = new Set(votes.map((vote) => vote.questionId));

  return rows.map((row) => toSummary(row, viewer, voted.has(row.id)));
}

export async function moderateQuestion(
  room: RoomAccessSnapshot,
  questionId: string,
  status: HostModerationAction,
): Promise<QuestionSummary> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roomId: room.id },
    select: { id: true, askedByUserId: true },
  });
  if (!question) throw notFound("We could not find that question in this room.");

  const updated = await prisma.question.update({
    where: { id: question.id },
    data: { moderationStatus: status },
    select: questionSelect,
  });

  await publishRoomEvent(room.nexconnChannelId, room.id, "question.moderated", {
    questionId: updated.id,
    moderationStatus: updated.moderationStatus,
  });

  return toSummary(updated, { kind: "host" }, false);
}

/** Records one upvote. The unique constraint turns a repeat into a conflict. */
export async function castVote(
  room: RoomAccessSnapshot,
  questionId: string,
  userId: string,
): Promise<{ questionId: string; upvoteCount: number }> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roomId: room.id },
    select: { id: true, moderationStatus: true },
  });
  if (!question) throw notFound("We could not find that question in this room.");

  if (question.moderationStatus !== "approved") {
    throw forbidden("Only approved questions can be upvoted.");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await assertOpenRoomForWrite(tx, room.id);
      await tx.vote.create({ data: { questionId: question.id, userId } });
      return tx.question.update({
        where: { id: question.id },
        data: { upvoteCount: { increment: 1 } },
        select: { upvoteCount: true },
      });
    });

    await publishRoomEvent(room.nexconnChannelId, room.id, "vote.updated", {
      questionId: question.id,
      upvoteCount: updated.upvoteCount,
    });

    return { questionId: question.id, upvoteCount: updated.upvoteCount };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "DUPLICATE_VOTE",
        "You have already upvoted this question.",
        409,
      );
    }
    throw error;
  }
}

/** Removes the participant's vote if it exists. Idempotent. */
export async function removeVote(
  room: RoomAccessSnapshot,
  questionId: string,
  userId: string,
): Promise<{ questionId: string; upvoteCount: number | null }> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roomId: room.id },
    select: { id: true },
  });
  if (!question) throw notFound("We could not find that question in this room.");

  const upvoteCount = await prisma.$transaction(async (tx) => {
    await assertOpenRoomForWrite(tx, room.id);
    const deleted = await tx.vote.deleteMany({
      where: { questionId: question.id, userId },
    });
    if (deleted.count === 0) return null;

    const updated = await tx.question.update({
      where: { id: question.id },
      data: { upvoteCount: { decrement: 1 } },
      select: { upvoteCount: true },
    });
    return updated.upvoteCount;
  });

  if (upvoteCount === null) {
    return { questionId: question.id, upvoteCount: null };
  }

  await publishRoomEvent(room.nexconnChannelId, room.id, "vote.updated", {
    questionId: question.id,
    upvoteCount,
  });

  return { questionId: question.id, upvoteCount };
}

export async function createAnswer(
  room: RoomAccessSnapshot,
  questionId: string,
  lecturerUserId: string,
  input: CreateAnswerInput,
): Promise<AnswerSummary> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, roomId: room.id },
    select: { id: true },
  });
  if (!question) throw notFound("We could not find that question in this room.");

  const answer = await prisma.$transaction(async (tx) => {
    await assertOpenRoomForWrite(tx, room.id);
    return tx.answer.create({
      data: {
        questionId: question.id,
        lecturerUserId,
        answerText: input.answerText,
        answerLanguage: input.answerLanguage,
        isPinned: input.isPinned,
      },
      select: answerSelect,
    });
  });

  await publishRoomEvent(room.nexconnChannelId, room.id, "answer.created", {
    questionId: question.id,
    answerId: answer.id,
  });

  return toAnswerSummary(answer);
}
