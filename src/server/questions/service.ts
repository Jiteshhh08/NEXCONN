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
  isAnonymous: true,
  moderationStatus: true,
  upvoteCount: true,
  createdAt: true,
  askedBy: { select: { displayName: true } },
  answers: {
    orderBy: { createdAt: "desc" },
    select: answerSelect,
  },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

export interface QuestionPage {
  questions: QuestionSummary[];
  nextCursor: string | null;
}

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
  // Anonymous questions hide the author's name from everyone except the
  // author. Non-anonymous names are part of the room conversation and are
  // shown to every viewer.
  const canSeeAuthorName =
    !row.isAnonymous || viewerUserId === row.askedByUserId;

  return {
    id: row.id,
    roomId: row.roomId,
    askedByUserId: canSeeAuthor ? row.askedByUserId : null,
    askedByName: canSeeAuthorName ? row.askedBy.displayName : null,
    originalText: row.originalText,
    sourceLanguage: row.sourceLanguage,
    isAnonymous: row.isAnonymous,
    moderationStatus: toModerationStatus(row.moderationStatus),
    upvoteCount: row.upvoteCount,
    createdAt: row.createdAt.toISOString(),
    hasVoted,
    answers: row.answers.map(toAnswerSummary),
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

  // A participant who joined anonymously stays anonymous for every question,
  // regardless of what a client sends. The client flag may only add
  // anonymity, never remove it.
  const participant = await prisma.participant.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: authorUserId } },
    select: { isAnonymous: true },
  });
  if (!participant) {
    throw forbidden("Join this room before asking a question.");
  }
  const isAnonymous = participant.isAnonymous || input.isAnonymous;

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
          isAnonymous,
        },
        select: questionSelect,
      });
    });

    const messageId = await publishRoomEvent(
      room.nexconnChannelId,
      room.id,
      "question.created",
      {
        questionId: created.id,
        sourceLanguage: created.sourceLanguage,
        isAnonymous: created.isAnonymous,
      },
    );

    if (messageId) {
      await prisma.question
        .update({
          where: { id: created.id },
          data: { nexconnMessageId: messageId },
        })
        .catch((error: unknown) => {
          console.error(
            `[questions] Could not record the live message id for ${created.id}:`,
            error instanceof Error ? error.message : error,
          );
        });
    }

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
): Promise<QuestionPage> {
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
      select: { id: true, roomId: true, createdAt: true },
    });

    // A cursor from another room must not influence this room's ordering.
    if (anchor && anchor.roomId === room.id) {
      // `createdAt` alone is not unique: two questions submitted in the same
      // millisecond would otherwise both be skipped or returned twice. The id
      // is the deterministic tie-breaker, matching the compound ordering below.
      where.AND = [
        {
          OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } },
          ],
        },
      ];
    }
  }

  const rows = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // One extra row tells us whether another page exists without a second
    // query and without returning an empty page to the client.
    take: options.limit + 1,
    select: questionSelect,
  });

  const hasMore = rows.length > options.limit;
  const pageRows = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor =
    hasMore && pageRows.length > 0
      ? (pageRows[pageRows.length - 1]?.id ?? null)
      : null;

  if (viewer.kind !== "student" || pageRows.length === 0) {
    return {
      questions: pageRows.map((row) => toSummary(row, viewer, false)),
      nextCursor,
    };
  }

  const votes = await prisma.vote.findMany({
    where: {
      userId: viewer.userId,
      questionId: { in: pageRows.map((row) => row.id) },
    },
    select: { questionId: true },
  });
  const voted = new Set(votes.map((vote) => vote.questionId));

  return {
    questions: pageRows.map((row) =>
      toSummary(row, viewer, voted.has(row.id)),
    ),
    nextCursor,
  };
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

  const messageId = await publishRoomEvent(
    room.nexconnChannelId,
    room.id,
    "answer.created",
    {
      questionId: question.id,
      answerId: answer.id,
    },
  );

  if (messageId) {
    await prisma.answer
      .update({
        where: { id: answer.id },
        data: { nexconnMessageId: messageId },
      })
      .catch((error: unknown) => {
        console.error(
          `[questions] Could not record the live message id for answer ${answer.id}:`,
          error instanceof Error ? error.message : error,
        );
      });
  }

  return toAnswerSummary(answer);
}
