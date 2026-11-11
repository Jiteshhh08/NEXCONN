import "server-only";

import type { ServerChatProvider } from "@/lib/chat/contracts";
import { serverEnv } from "@/lib/env";

import { LocalChatProvider } from "./local";
import { NexconnChatProvider } from "./nexconn";

let provider: ServerChatProvider | null = null;

export function getChatProvider(): ServerChatProvider {
  if (provider) return provider;

  provider =
    serverEnv.NEXCONN_CHAT_PROVIDER === "nexconn"
      ? new NexconnChatProvider()
      : new LocalChatProvider();

  return provider;
}
