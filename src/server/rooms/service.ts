import "server-only";

import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import type { RoomStatus } from "@/lib/domain";
import type { CreateRoomInput } from "@/lib/validation";
import { getChatProvider } from "@/server/chat";
import { publishRoomEvent } from "@/server/chat/live";

import type { RoomAccessSnapshot } from "./access";
import { generateJoinCode } from "./join-code";

const roomSelection = {
  id: true,
  title: true,
  joinCode: true,
  status: true,
  hostLanguage: true,
  nexconnChannelId: true,
  createdAt: true,
  closedAt: true,
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof roomSelection }>;

export interface HostRoom {
  id: string;
  title: string;
  joinCode: string;
  status: RoomStatus;
  hostLanguage: string;
  nexconnChannelId: string | null;
  createdAt: Date;
  closedAt: Date | null;
  questionCount: number;
  participantCount: number;
}

export interface PublicRoom {
  id: string;
  hostUserId: string;
  title: string;
  joinCode: string;
  status: RoomStatus;
  hostLanguage: string;
  hostName: string;
  participantCount: number;
  createdAt: Date;
  closedAt: Date | null;
}

function toStatus(value: string): RoomStatus {
  return value === "closed" ? "closed" : "active";
}

function isJoinCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createRoomForHost(
  hostUserId: string,
  input: CreateRoomInput,
): Promise<HostRoom> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = generateJoinCode();

    try {
      const created = await prisma.room.create({
        data: {
          hostUserId,
          title: input.title,
          hostLanguage: input.hostLanguage,
          joinCode,
        },
        select: roomSelection,
      });

      try {
        const channel = await getChatProvider().createChannel({
          roomId: created.id,
          title: created.title,
        });

        const room = await prisma.room.update({
          where: { id: created.id },
          data: { nexconnChannelId: channel.channelId },
          select: roomSelection,
        });

        return mapHostRoom(room);
      } catch (error) {
        // Do not leave a room without its live channel behind.
        await prisma.room
          .delete({ where: { id: created.id } })
          .catch(() => undefined);
        throw error;
      }
    } catch (error) {
      // On the final attempt the collision must fall through to the explicit
      // exhaustion error below instead of leaking the raw Prisma error.
      if (isJoinCodeCollision(error)) {
        if (attempt < 7) continue;
        break;
      }
      throw error;
    }
  }

  throw new AppError(
    "CONFLICT",
    "A room code could not be allocated. Please try again.",
    503,
  );
}

function mapHostRoom(room: RoomRow & { _count?: { questions: number; participants: number } }): HostRoom {
  return {
    id: room.id,
    title: room.title,
    joinCode: room.joinCode,
    status: toStatus(room.status),
    hostLanguage: room.hostLanguage,
    nexconnChannelId: room.nexconnChannelId,
    createdAt: room.createdAt,
    closedAt: room.closedAt,
    questionCount: room._count?.questions ?? 0,
    participantCount: room._count?.participants ?? 0,
  };
}

export async function listRoomsForHost(hostUserId: string): Promise<HostRoom[]> {
  const rooms = await prisma.room.findMany({
    where: { hostUserId },
    orderBy: { createdAt: "desc" },
    select: {
      ...roomSelection,
      _count: {
        select: {
          questions: true,
          participants: { where: { isActive: true } },
        },
      },
    },
  });

  return rooms.map(mapHostRoom);
}

export async function getRoomForHost(
  joinCode: string,
  hostUserId: string,
): Promise<HostRoom | null> {
  const room = await prisma.room.findFirst({
    where: { joinCode, hostUserId },
    select: {
      ...roomSelection,
      _count: {
        select: {
          questions: true,
          participants: { where: { isActive: true } },
        },
      },
    },
  });

  return room ? mapHostRoom(room) : null;
}

export async function getPublicRoomByCode(
  joinCode: string,
): Promise<PublicRoom | null> {
  const room = await prisma.room.findUnique({
    where: { joinCode },
    select: {
      id: true,
      hostUserId: true,
      title: true,
      joinCode: true,
      status: true,
      hostLanguage: true,
      createdAt: true,
      closedAt: true,
      host: { select: { displayName: true } },
      _count: {
        select: { participants: { where: { isActive: true } } },
      },
    },
  });

  if (!room) return null;

  return {
    id: room.id,
    hostUserId: room.hostUserId,
    title: room.title,
    joinCode: room.joinCode,
    status: toStatus(room.status),
    hostLanguage: room.hostLanguage,
    hostName: room.host.displayName ?? "Your host",
    participantCount: room._count.participants,
    createdAt: room.createdAt,
    closedAt: room.closedAt,
  };
}

export async function getHostOverview(hostUserId: string): Promise<{
  activeRooms: number;
  totalQuestions: number;
  totalParticipants: number;
}> {
  const [activeRooms, totalQuestions, totalParticipants] = await Promise.all([
    prisma.room.count({ where: { hostUserId, status: "active" } }),
    prisma.question.count({ where: { room: { hostUserId } } }),
    prisma.participant.count({
      where: { room: { hostUserId }, isActive: true },
    }),
  ]);

  return { activeRooms, totalQuestions, totalParticipants };
}

/**
 * Closes a room. The database is updated first so join, question, vote and
 * answer routes immediately reject the room; the live channel is then told and
 * destroyed best-effort. Closing an already-closed room is a no-op success.
 */
export async function closeRoomForHost(
  room: RoomAccessSnapshot,
): Promise<void> {
  if (room.status === "closed") return;

  const closed = await prisma.room.updateMany({
    where: { id: room.id, status: "active" },
    data: { status: "closed", closedAt: new Date() },
  });
  if (closed.count !== 1) return;

  // A closed room has no active participants. Keeping the historical rows but
  // clearing the flag makes participant counts and access checks meaningful.
  await prisma.participant.updateMany({
    where: { roomId: room.id, isActive: true },
    data: { isActive: false },
  });

  await publishRoomEvent(room.nexconnChannelId, room.id, "room.closed", {
    roomId: room.id,
  });

  if (room.nexconnChannelId) {
    try {
      await getChatProvider().closeChannel(room.nexconnChannelId);
    } catch (error) {
      console.error(
        "[chat] Failed to destroy the room channel:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
