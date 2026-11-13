"use client";

import {
  AreaCode,
  LogLevel,
  MessageHandler,
  MessageType,
  NCEngine,
  OpenChannel,
  TranslateHandler,
  TranslateMessageParam,
  TranslateSourceType,
  type Message,
  type TextMessageContent,
  type TranslationCompletedEvent,
} from "@nexconn/chat";

import type {
  ChatClientTransport,
  ChatConnectionConfig,
  LiveEvent,
} from "@/lib/chat/contracts";
import {
  SYSTEM_SENDER_USER_ID,
  decodeLiveEvent,
} from "@/lib/chat/events";

/**
 * Browser transport backed by the Nexconn Web Chat SDK (`@nexconn/chat`).
 *
 * The SDK stays behind {@link ChatClientTransport} so the `local` development
 * transport remains the default and the domain code never imports the SDK.
 *
 * Sources:
 *   https://docs.nexconn.ai/chatsdk-web/init
 *   https://docs.nexconn.ai/chatsdk-web/builtin-translation/overview
 *   https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks
 *   https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-events-and-results
 */

const MESSAGE_HANDLER_ID = "vaani-room-message-handler";
const TRANSLATE_HANDLER_ID = "vaani-room-translate-handler";

/** Recent messages requested when entering the open channel. */
const HISTORY_MESSAGE_COUNT = 50;

export interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class NexconnChatTransport implements ChatClientTransport {
  readonly name = "nexconn" as const;

  private config: ChatConnectionConfig | null = null;
  private channel: OpenChannel | null = null;
  private readonly listeners = new Set<(event: LiveEvent) => void>();
  private initialized = false;
  private handlersRegistered = false;

  async connect(config: ChatConnectionConfig): Promise<void> {
    this.config = config;
    this.ensureInitialized(config.appKey);
    this.registerHandlers();

    const result = await NCEngine.connect({ token: config.token });
    if (!result.isOk) {
      throw new Error(
        `Nexconn connection failed (${result.code}): ${result.msg}`,
      );
    }
  }

  async joinChannel(): Promise<void> {
    const config = this.requireConfig();
    const channel = new OpenChannel(config.channelId);

    const result = await channel.enterChannel({
      messageCount: HISTORY_MESSAGE_COUNT,
    });

    if (!result.isOk) {
      throw new Error(
        `Joining the room channel failed (${result.code}): ${result.msg}`,
      );
    }

    this.channel = channel;
  }

  onEvent(listener: (event: LiveEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Requests an async translation for one message. The result arrives through
   * the registered translate handler as a `translation.updated` event.
   *
   * On Web each translation item must carry the original `text`.
   */
  async translateMessage(request: TranslationRequest): Promise<void> {
    const result = await NCEngine.translateModule.translateMessages({
      list: [
        new TranslateMessageParam(
          request.messageId,
          request.sourceLanguage,
          request.targetLanguage,
          request.text,
        ),
      ],
    });

    if (!result.isOk) {
      throw new Error(
        `Requesting a translation failed (${result.code}): ${result.msg}`,
      );
    }
  }

  disconnect(): void {
    const channel = this.channel;
    this.channel = null;

    if (channel) {
      void channel.exitChannel().catch(() => undefined);
    }

    NCEngine.removeMessageHandler(MESSAGE_HANDLER_ID);
    NCEngine.removeTranslateHandler(TRANSLATE_HANDLER_ID);
    void NCEngine.disconnect().catch(() => undefined);
  }

  private ensureInitialized(appKey: string): void {
    if (this.initialized) return;

    NCEngine.initialize({
      appKey,
      areaCode: AreaCode.SG,
      logLevel: LogLevel.WARN,
    });

    this.initialized = true;
  }

  private registerHandlers(): void {
    // `connect()` may be retried after a failure, so registration must be
    // idempotent: a second handler with the same id could deliver every
    // message twice.
    if (this.handlersRegistered) return;

    NCEngine.addMessageHandler(
      MESSAGE_HANDLER_ID,
      new MessageHandler({
        onMessageReceived: ({ messages }) => this.handleMessages(messages),
      }),
    );

    NCEngine.addTranslateHandler(
      TRANSLATE_HANDLER_ID,
      new TranslateHandler({
        onTranslationCompleted: (event) => this.handleTranslations(event),
      }),
    );

    this.handlersRegistered = true;
  }

  private handleMessages(messages: Message[]): void {
    const config = this.config;
    if (!config) return;

    for (const message of messages) {
      if (message.messageType !== MessageType.TEXT) continue;

      // Only the Vaani server may publish authoritative room events. Without
      // this check any channel member could forge "room.closed" or moderation
      // events by posting the same JSON.
      if (message.senderUserId !== SYSTEM_SENDER_USER_ID) continue;

      const content = message.content as TextMessageContent | undefined;
      const text = content?.text;
      if (typeof text !== "string") continue;

      const decoded = decodeLiveEvent(text);
      if (!decoded) continue;

      // The event must belong to this room; a sender cannot redirect the
      // client to another room by claiming a different id.
      if (decoded.roomId !== config.roomId) continue;

      this.emit({
        id: message.messageId,
        type: decoded.type,
        roomId: config.roomId,
        payload: decoded.payload,
        createdAt: new Date(message.sentTime).toISOString(),
      });
    }
  }

  private handleTranslations(event: TranslationCompletedEvent): void {
    const config = this.config;
    if (!config) return;

    for (const translation of event.results) {
      if (translation.sourceType !== TranslateSourceType.MESSAGE) continue;
      if (translation.code !== 0 || !translation.translateInfo) continue;

      this.emit({
        id: `${translation.identifier}:${translation.translateInfo.targetLanguage}`,
        type: "translation.updated",
        roomId: config.roomId,
        payload: {
          messageId: translation.identifier,
          targetLanguage: translation.translateInfo.targetLanguage,
          translatedText: translation.translateInfo.translatedText,
          status: translation.translateInfo.status,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  private emit(event: LiveEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private requireConfig(): ChatConnectionConfig {
    if (!this.config) {
      throw new Error("Connect to Nexconn before using the transport.");
    }
    return this.config;
  }
}
