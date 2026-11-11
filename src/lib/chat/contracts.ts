import type { UserRole } from "@/lib/domain";

export type ChatProviderName = "local" | "nexconn";

export interface ChannelDescriptor {
  channelId: string;
  channelName: string;
}

export interface CreateChannelInput {
  roomId: string;
  title: string;
}

export interface IssueUserTokenInput {
  userId: string;
  roomId: string;
  role: UserRole;
  displayName?: string | null;
}

export interface ChatUserToken {
  userId: string;
  token: string;
  expiresAt: string;
  appKey: string;
  channelId: string;
  channelName: string;
  provider: ChatProviderName;
}

export type LiveEventType =
  | "question.created"
  | "question.moderated"
  | "answer.created"
  | "vote.updated"
  | "translation.updated"
  | "room.closed"
  | "presence.updated";

export interface LiveEvent<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  type: LiveEventType;
  roomId: string;
  payload: T;
  createdAt: string;
}

export interface PublishEventInput {
  channelId: string;
  roomId: string;
  type: LiveEventType;
  payload: Record<string, unknown>;
}

/**
 * Server-side chat operations. Implementations must never be imported by
 * browser code: the Nexconn implementation holds privileged credentials.
 */
export interface ServerChatProvider {
  readonly name: ChatProviderName;
  createChannel(input: CreateChannelInput): Promise<ChannelDescriptor>;
  issueUserToken(input: IssueUserTokenInput): Promise<ChatUserToken>;
  publishEvent(input: PublishEventInput): Promise<{ messageId: string }>;
  closeChannel(channelId: string): Promise<void>;
}

export interface ChatConnectionConfig {
  appKey: string;
  token: string;
  userId: string;
  channelId: string;
  roomId: string;
  provider: ChatProviderName;
}

export interface SendQuestionInput {
  roomId: string;
  text: string;
  sourceLanguage: string;
  isAnonymous: boolean;
  clientNonce: string;
}

/**
 * Browser-side transport contract. Phase 3 provides the local SSE
 * implementation and the Nexconn Chat SDK implementation.
 */
export interface ChatClientTransport {
  readonly name: ChatProviderName;
  connect(config: ChatConnectionConfig): Promise<void>;
  joinChannel(): Promise<void>;
  sendQuestion(input: SendQuestionInput): Promise<{ messageId: string }>;
  onEvent(listener: (event: LiveEvent) => void): () => void;
  disconnect(): void;
}
