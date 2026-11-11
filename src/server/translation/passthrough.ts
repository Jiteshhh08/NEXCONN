import "server-only";

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@/lib/translation/contracts";

/**
 * Safe default translation provider. It never fabricates a translation:
 * same-language requests resolve immediately, everything else is reported as
 * unavailable so the UI can keep showing the original text.
 */
export class PassthroughTranslationProvider implements TranslationProvider {
  readonly name = "passthrough" as const;

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (request.sourceLanguage === request.targetLanguage) {
      return {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedText: request.text,
        status: "ready",
        provider: this.name,
      };
    }

    return {
      messageId: request.messageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      translatedText: null,
      status: "unavailable",
      provider: this.name,
      errorMessage:
        "Translation is not configured. The original text is shown instead.",
    };
  }
}

export default PassthroughTranslationProvider;
