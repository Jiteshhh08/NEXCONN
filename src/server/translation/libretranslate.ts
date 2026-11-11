import "server-only";

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@/lib/translation/contracts";

/**
 * LibreTranslate-compatible adapter used as an optional local/demo provider.
 * The endpoint is configured with LIBRETRANSLATE_URL. Configuration is
 * validated here rather than at import time so the rest of the app keeps
 * working without a translation server.
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "libretranslate" as const;

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const baseUrl = process.env.LIBRETRANSLATE_URL;
    if (!baseUrl) {
      return this.unavailable(
        request,
        "LIBRETRANSLATE_URL is not configured. The original text is shown instead.",
      );
    }

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

    try {
      const response = await fetch(new URL("/translate", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: request.text,
          source: request.sourceLanguage,
          target: request.targetLanguage,
          format: "text",
          ...(process.env.LIBRETRANSLATE_API_KEY
            ? { api_key: process.env.LIBRETRANSLATE_API_KEY }
            : {}),
        }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });

      if (!response.ok) {
        return this.unavailable(
          request,
          `The translation service returned HTTP ${response.status}.`,
        );
      }

      const payload = (await response.json()) as {
        translatedText?: unknown;
      };

      if (typeof payload.translatedText !== "string") {
        return this.unavailable(
          request,
          "The translation service returned an unexpected response.",
        );
      }

      return {
        messageId: request.messageId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedText: payload.translatedText,
        status: "ready",
        provider: this.name,
      };
    } catch {
      return this.unavailable(
        request,
        "The translation service could not be reached.",
      );
    }
  }

  private unavailable(
    request: TranslationRequest,
    errorMessage: string,
  ): TranslationResult {
    return {
      messageId: request.messageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      translatedText: null,
      status: "unavailable",
      provider: this.name,
      errorMessage,
    };
  }
}

export default LibreTranslateProvider;
