import type { LanguageCode } from "@/lib/domain";

import type { TranslationProviderName, TranslationResult } from "./contracts";
import { TRANSLATION_MAX_TEXT_BYTES } from "./limits";

/**
 * MyMemory translation adapter (pure logic, no `server-only`).
 *
 * MyMemory is a public translation API that needs no API key, only an
 * optional contact e-mail address for a higher daily quota. The official
 * contract is documented at <https://mymemory.translated.net/doc/spec.php>:
 *
 *   GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>
 *
 * and the response carries `responseData.translatedText`, `responseStatus`,
 * `responseDetails` and `quotaFinished`. `q` is limited to 500 bytes.
 *
 * It is deliberately implemented as a free function that takes its `fetch`
 * and endpoint as options, so the failure paths (HTTP error, malformed body,
 * exhausted quota, network failure) are unit-testable without a network.
 */

export const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";

/** Documented limit for the `q` query parameter. */
export const MYMEMORY_MAX_QUERY_BYTES = TRANSLATION_MAX_TEXT_BYTES;

export interface MyMemoryTranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface MyMemoryOptions {
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
  /** Optional contact address; raises the provider's anonymous quota. */
  email?: string;
}

interface MyMemoryPayload {
  responseData?: { translatedText?: unknown };
  responseStatus?: unknown;
  responseDetails?: unknown;
  quotaFinished?: unknown;
}

const PROVIDER: TranslationProviderName = "mymemory";

function unavailable(
  request: MyMemoryTranslationRequest,
  errorMessage: string,
): TranslationResult {
  return {
    messageId: request.messageId,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    translatedText: null,
    status: "unavailable",
    provider: PROVIDER,
    errorMessage,
  };
}

export async function translateWithMyMemory(
  request: MyMemoryTranslationRequest,
  options: MyMemoryOptions = {},
): Promise<TranslationResult> {
  const {
    fetchImpl = fetch,
    timeoutMs = 15_000,
    endpoint = MYMEMORY_ENDPOINT,
    email,
  } = options;

  // Same language needs no provider call and is a genuine no-op, not a
  // fabricated translation.
  if (request.sourceLanguage === request.targetLanguage) {
    return {
      messageId: request.messageId,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      translatedText: request.text,
      status: "ready",
      provider: PROVIDER,
    };
  }

  const text = request.text.trim();
  if (text.length === 0) {
    return unavailable(request, "There is no text to translate.");
  }

  if (new TextEncoder().encode(text).length > MYMEMORY_MAX_QUERY_BYTES) {
    return unavailable(
      request,
      `This translation service accepts at most ${MYMEMORY_MAX_QUERY_BYTES} bytes per request. The original text is shown instead.`,
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${request.sourceLanguage}|${request.targetLanguage}`);
  if (email) url.searchParams.set("de", email);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    return unavailable(request, "The translation service could not be reached.");
  }

  if (!response.ok) {
    return unavailable(
      request,
      `The translation service returned HTTP ${response.status}.`,
    );
  }

  let payload: MyMemoryPayload;
  try {
    payload = (await response.json()) as MyMemoryPayload;
  } catch {
    return unavailable(
      request,
      "The translation service returned an unexpected response.",
    );
  }

  if (payload.quotaFinished === true) {
    return unavailable(
      request,
      "The translation quota for today is used up. The original text is shown instead.",
    );
  }

  if (
    typeof payload.responseStatus === "number" &&
    payload.responseStatus !== 200
  ) {
    return unavailable(
      request,
      typeof payload.responseDetails === "string"
        ? payload.responseDetails
        : `The translation service returned status ${payload.responseStatus}.`,
    );
  }

  const translated = payload.responseData?.translatedText;
  if (typeof translated !== "string" || translated.trim().length === 0) {
    return unavailable(
      request,
      "The translation service returned an unexpected response.",
    );
  }

  return {
    messageId: request.messageId,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    translatedText: translated,
    status: "ready",
    provider: PROVIDER,
  };
}
