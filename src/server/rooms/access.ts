import "server-only";

import { Prisma } from "@prisma/client";

import {
  AppError,
  forbidden,
  notFound,
  roomClosed,
  unauthorized,
} from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import type { RoomStatus } from "@/lib/domain";
import { joinCodeSchema } from "@/lib/validation";
import {
  getSessionUser,
  requireHost,
  type SessionUser,
} from "@/server/auth/session";

/**
 * Room loading and authorization shared by the question, vote, answer and
 * close routes.
 *
 * Every check runs on the server against the database. A client-supplied role
 * or a hidden button is never a security boundary (README, "Security").
 */

const roomAccessSelect = {
  id: true,
  hostUserId: true,
  title: true,
  joinCode: true,
  hostLanguage: true,
  status: true,
  nexconnChannelId: true,
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof roomAccessSelect }>;

export interface RoomAccessSnapshot {
  id: string;
  hostUserId: string;
  title: string;
  joinCode: string;
  hostLanguage: string;
  status: RoomStatus;
  nexconnChannelId: string | null;
}

export async function assertOpenRoomForWrite(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<void> {
  const claimed = await tx.room.updateMany({
    where: { id: roomId, status: "active" },
    data: { updatedAt: new Date() },
  });

  if (claimed.count !== 1) throw roomClosed();
}

function toSnapshot(room: RoomRow): RoomAccessSnapshot {
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    title: room.title,
    joinCode: room.joinCode,
    hostLanguage: room.hostLanguage,
    status: room.status === "closed" ? "closed" : "active",
    nexconnChannelId: room.nexconnChannelId,
  };
}

/** Reads the join code from a route parameter and normalises it. */
export function joinCodeFromParams(rawCode: string): string {
  const parsed = joinCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "That room code is not valid.", 422);
  }
  return parsed.data;
}

export async function loadRoomByCode(
  joinCode: string,
): Promise<RoomAccessSnapshot> {
  const room = await prisma.room.findUnique({
    where: { joinCode },
    select: roomAccessSelect,
  });

  if (!room) throw notFound("We could not find that room.");
  return toSnapshot(room);
}

/** Loads a room that must still be open. Closed rooms accept nothing. */
export async function requireOpenRoom(
  joinCode: string,
): Promise<RoomAccessSnapshot> {
  const room = await loadRoomByCode(joinCode);
  if (room.status === "closed") throw roomClosed();
  return room;
}

/** Loads a question together with the room it belongs to. */
export async function loadQuestionContext(
  questionId: string,
): Promise<{ id: string; room: RoomAccessSnapshot }> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, room: { select: roomAccessSelect } },
  });

  if (!question) throw notFound("We could not find that question.");
  return { id: question.id, room: toSnapshot(question.room) };
}

export async function assertRoomParticipant(
  roomId: string,
  userId: string,
): Promise<{ preferredLanguage: string; isAnonymous: boolean }> {
  const participant = await prisma.participant.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { preferredLanguage: true, isAnonymous: true, isActive: true },
  });

  if (!participant || !participant.isActive) {
    throw forbidden("Join this room before taking part.");
  }

  return participant;
}

/** Requires a signed-in participant of the room. */
export async function requireRoomParticipant(
  room: RoomAccessSnapshot,
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized("Join this room before taking part.");

  await assertRoomParticipant(room.id, user.id);
  return user;
}

/** Requires the signed-in host that owns this room. */
export async function requireRoomOwner(
  room: RoomAccessSnapshot,
): Promise<SessionUser> {
  const host = await requireHost();

  if (room.hostUserId !== host.id) {
    throw forbidden("Only the host of this room can do that.");
  }

  return host;
}
