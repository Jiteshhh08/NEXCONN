import "server-only";

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@/lib/translation/contracts";

/**
 * Nexconn built-in translation adapter.
 *
 * Translation tasks are asynchronous in Nexconn. The concrete request and
 * event shapes must be supplied by the team lead (see TEAM_LEAD.md). Until
 * then this provider reports an honest "unavailable" result instead of
 * pretending a translation succeeded.
 */
export class NexconnTranslationProvider implements TranslationProvider {
  readonly name = "nexconn" as const;

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      messageId: request.messageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      translatedText: null,
      status: "unavailable",
      provider: this.name,
      errorMessage:
        "Nexconn translation is not connected yet. The original text is shown instead.",
    };
  }
}

export default NexconnTranslationProvider;
