import "server-only";

import type {
  ChannelDescriptor,
  ChatUserToken,
  CreateChannelInput,
  IssueUserTokenInput,
  PublishEventInput,
  ServerChatProvider,
} from "@/lib/chat/contracts";
import { IntegrationNotConfiguredError } from "@/lib/api/errors";

/**
 * Nexconn server adapter.
 *
 * The concrete endpoint names and payload shapes must be filled in from the
 * team's Nexconn Console/SDK documentation. See TEAM_LEAD.md ("Nexconn
 * integration checklist") for the exact values the team lead must supply.
 *
 * Required environment variables:
 *   NEXCONN_APP_KEY, NEXCONN_APP_SECRET, NEXCONN_API_BASE_URL,
 *   NEXCONN_CHAT_PROVIDER=nexconn
 *
 * Security: this file is server-only. The App Secret must never be shipped to
 * the browser, logged, or embedded in returned tokens.
 */
export class NexconnChatProvider implements ServerChatProvider {
  readonly name = "nexconn" as const;

  private notConfigured(): never {
    throw new IntegrationNotConfiguredError("Nexconn Chat");
  }

  async createChannel(_input: CreateChannelInput): Promise<ChannelDescriptor> {
    this.notConfigured();
  }

  async issueUserToken(_input: IssueUserTokenInput): Promise<ChatUserToken> {
    this.notConfigured();
  }

  async publishEvent(
    _input: PublishEventInput,
  ): Promise<{ messageId: string }> {
    this.notConfigured();
  }

  async closeChannel(_channelId: string): Promise<void> {
    this.notConfigured();
  }
}

export default NexconnChatProvider;
