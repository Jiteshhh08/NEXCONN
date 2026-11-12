import "server-only";

import type { UserRole } from "@/lib/domain";
import type { JoinedRoom } from "@/lib/room/types";
import { getChatProvider } from "@/server/chat";

import type { PublicRoom } from "./service";

/**
 * Builds the payload shared by the join and session routes: the room context,
 * the participant identity, and a freshly issued live-channel token.
 *
 * The Nexconn token is minted here, on the server, from the App Key and App
 * Secret. The browser only ever receives the App Key, the user token and the
 * channel identifier — never the App Secret.
 */
export interface BuildJoinedRoomInput {
  room: PublicRoom;
  userId: string;
  role: UserRole;
  displayName: string | null;
  preferredLanguage: string;
  isAnonymous: boolean;
}

export async function buildJoinedRoom(
  input: BuildJoinedRoomInput,
): Promise<JoinedRoom> {
  const displayName = input.isAnonymous ? null : input.displayName;

  const chat = await getChatProvider().issueUserToken({
    userId: input.userId,
    roomId: input.room.id,
    role: input.role,
    displayName,
  });

  return {
    room: {
      id: input.room.id,
      title: input.room.title,
      joinCode: input.room.joinCode,
      status: input.room.status,
      hostLanguage: input.room.hostLanguage,
      hostName: input.room.hostName,
    },
    participant: {
      userId: input.userId,
      displayName,
      preferredLanguage: input.preferredLanguage,
      isAnonymous: input.isAnonymous,
    },
    chat: {
      userId: chat.userId,
      token: chat.token,
      expiresAt: chat.expiresAt,
      appKey: chat.appKey,
      channelId: chat.channelId,
      channelName: chat.channelName,
      provider: chat.provider,
    },
  };
}
