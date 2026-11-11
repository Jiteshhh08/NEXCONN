import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type {
  ChannelDescriptor,
  ChatUserToken,
  CreateChannelInput,
  IssueUserTokenInput,
  PublishEventInput,
  ServerChatProvider,
} from "@/lib/chat/contracts";
import { serverEnv } from "@/lib/env";

const TOKEN_TTL_MS = 60 * 60 * 1000;

interface LocalTokenPayload {
  sub: string;
  roomId: string;
  role: string;
  channelId: string;
  exp: number;
}

function sign(value: string): string {
  return createHmac("sha256", serverEnv.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

function createLocalToken(payload: LocalTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyLocalToken(
  token: string,
): LocalTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  if (expected.length !== signature.length) return null;

  // Constant-time comparison.
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LocalTokenPayload;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Development transport. This is not a Nexconn replacement in production; it
 * exists so the product flow can be built and tested before credentials are
 * connected. Live delivery is added in Phase 3.
 */
export class LocalChatProvider implements ServerChatProvider {
  readonly name = "local" as const;

  async createChannel(input: CreateChannelInput): Promise<ChannelDescriptor> {
    return {
      channelId: `local_${input.roomId}`,
      channelName: input.title,
    };
  }

  async issueUserToken(input: IssueUserTokenInput): Promise<ChatUserToken> {
    const channelId = `local_${input.roomId}`;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    return {
      userId: input.userId,
      token: createLocalToken({
        sub: input.userId,
        roomId: input.roomId,
        role: input.role,
        channelId,
        exp: expiresAt.getTime(),
      }),
      expiresAt: expiresAt.toISOString(),
      appKey: "local-dev",
      channelId,
      channelName: input.displayName ?? "Vaani Room",
      provider: this.name,
    };
  }

  async publishEvent(
    _input: PublishEventInput,
  ): Promise<{ messageId: string }> {
    // Phase 3 wires this to the local event bus.
    return { messageId: randomUUID() };
  }

  async closeChannel(_channelId: string): Promise<void> {
    // No remote channel exists in local mode.
  }
}

export default LocalChatProvider;
