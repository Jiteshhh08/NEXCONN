import "server-only";

import { AppError } from "@/lib/api/errors";
import type {
  ChannelDescriptor,
  ChatUserToken,
  CreateChannelInput,
  IssueUserTokenInput,
  PublishEventInput,
  ServerChatProvider,
} from "@/lib/chat/contracts";
import { encodeLiveEvent } from "@/lib/chat/events";
import {
  nexconnRequest,
  readNexconnCredentials,
} from "@/server/nexconn/client";

/**
 * Nexconn server adapter for Vaani Room's live chat.
 *
 * Verified contracts (see docs/nexconn-integration-contract.md):
 *   create  POST /v4/open-channel/create        https://docs.nexconn.ai/platform-chat-api/open-channel/create
 *   destroy POST /v4/open-channel/destroy       https://docs.nexconn.ai/platform-chat-api/open-channel/destroy
 *   token   POST /v4/auth/access-token/issue    https://docs.nexconn.ai/platform-chat-api/user/register
 *   send    POST /v4/open-channel/message/send  https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel
 *
 * Required environment variables:
 *   NEXCONN_APP_KEY, NEXCONN_APP_SECRET, NEXCONN_API_BASE_URL,
 *   NEXCONN_CHAT_PROVIDER=nexconn
 *
 * Security: this file is server-only. The App Secret must never be shipped to
 * the browser, logged, or embedded in returned tokens.
 */

/** Nexconn built-in plain-text message object name. */
const TEXT_MESSAGE_TYPE = "RC:TxtMsg";

/**
 * Sender used for server-published room events. The server API allows sending
 * to an open channel without the sender being a member.
 *
 * UNVERIFIED: the docs do not state whether `fromUserId` must be a registered
 * user. Confirm against a live application before relying on this value.
 */
const SYSTEM_SENDER_USER_ID = "vaaniSystem";

/** Nexconn caps a user's display `name` at 64 characters. */
const MAX_USER_NAME_LENGTH = 64;

/**
 * Vaani-side refresh hint. Nexconn access tokens are valid indefinitely by
 * default, so this value is not a Nexconn-guaranteed expiry.
 */
const TOKEN_REFRESH_HINT_MS = 24 * 60 * 60 * 1000;

interface IssueTokenResult {
  userId: string;
  accessToken: string;
}

interface SendMessageResult {
  messageIds?: Array<{ channelId: string; messageId: string }>;
}

/**
 * Open Channel id for a Vaani room.
 *
 * UNVERIFIED: the docs publish no channelId character set, length, or prefix
 * rule, so the lowercase alphanumeric Vaani room id is reused unchanged.
 */
export function channelIdForRoom(roomId: string): string {
  return roomId;
}

function truncateName(name: string | null | undefined): string {
  const value = name?.trim() || "Vaani Room participant";
  return value.length > MAX_USER_NAME_LENGTH
    ? value.slice(0, MAX_USER_NAME_LENGTH)
    : value;
}

export class NexconnChatProvider implements ServerChatProvider {
  readonly name = "nexconn" as const;

  async createChannel(input: CreateChannelInput): Promise<ChannelDescriptor> {
    const channelId = channelIdForRoom(input.roomId);

    // Optional fields are omitted so the documented defaults apply.
    await nexconnRequest("/v4/open-channel/create", { channelId });

    return { channelId, channelName: input.title };
  }

  async issueUserToken(input: IssueUserTokenInput): Promise<ChatUserToken> {
    const { appKey } = readNexconnCredentials();

    const result = await nexconnRequest<IssueTokenResult>(
      "/v4/auth/access-token/issue",
      {
        userId: input.userId,
        name: truncateName(input.displayName),
      },
    );

    return {
      userId: result.userId,
      token: result.accessToken,
      expiresAt: new Date(Date.now() + TOKEN_REFRESH_HINT_MS).toISOString(),
      appKey,
      channelId: channelIdForRoom(input.roomId),
      channelName: input.displayName?.trim() || "Vaani Room",
      provider: this.name,
    };
  }

  async publishEvent(
    input: PublishEventInput,
  ): Promise<{ messageId: string }> {
    const text = encodeLiveEvent({
      type: input.type,
      roomId: input.roomId,
      payload: input.payload,
    });

    // The server API transports the built-in content object as a JSON string.
    const content = JSON.stringify({ content: text });

    const result = await nexconnRequest<SendMessageResult>(
      "/v4/open-channel/message/send",
      {
        fromUserId: SYSTEM_SENDER_USER_ID,
        toChannelIds: [input.channelId],
        messageType: TEXT_MESSAGE_TYPE,
        content,
      },
    );

    const delivered =
      result.messageIds?.find((entry) => entry.channelId === input.channelId) ??
      result.messageIds?.[0];

    if (!delivered) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Nexconn did not return a message id for the published event.",
        502,
      );
    }

    return { messageId: delivered.messageId };
  }

  async closeChannel(channelId: string): Promise<void> {
    await nexconnRequest("/v4/open-channel/destroy", {
      channelIds: [channelId],
    });
  }
}

export default NexconnChatProvider;
