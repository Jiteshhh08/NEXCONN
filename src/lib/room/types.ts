import type { ChatProviderName } from "@/lib/chat/contracts";
import type { ModerationStatus, RoomStatus } from "@/lib/domain";

/**
 * Browser-safe DTOs shared by the server services and the client components.
 * Kept free of `server-only` so client bundles can import the shapes without
 * pulling in any server code.
 */

export interface AnswerSummary {
  id: string;
  answerText: string;
  answerLanguage: string;
  isPinned: boolean;
  createdAt: string;
}

export interface QuestionSummary {
  id: string;
  roomId: string;
  /** Null for an anonymous question the viewer did not ask. */
  askedByUserId: string | null;
  originalText: string;
  sourceLanguage: string;
  hostTranslation: string | null;
  isAnonymous: boolean;
  moderationStatus: ModerationStatus;
  upvoteCount: number;
  createdAt: string;
  hasVoted: boolean;
  answer: AnswerSummary | null;
}

export interface RoomChatSession {
  userId: string;
  token: string;
  expiresAt: string;
  appKey: string;
  channelId: string;
  channelName: string;
  provider: ChatProviderName;
}

export interface JoinedRoom {
  room: {
    id: string;
    title: string;
    joinCode: string;
    status: RoomStatus;
    hostLanguage: string;
    hostName: string;
  };
  participant: {
    userId: string;
    displayName: string | null;
    preferredLanguage: string;
    isAnonymous: boolean;
  };
  chat: RoomChatSession;
}
