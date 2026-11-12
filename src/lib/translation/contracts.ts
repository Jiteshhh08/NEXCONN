import type { LanguageCode, TranslationStatus } from "@/lib/domain";

/**
 * Every translation provider the app knows about. Kept as a runtime array so
 * the environment schema, the server-side factory and the tests all share one
 * source of truth instead of drifting apart.
 */
export const TRANSLATION_PROVIDER_NAMES = [
  "passthrough",
  "nexconn",
  "libretranslate",
  "mymemory",
] as const;

export type TranslationProviderName =
  (typeof TRANSLATION_PROVIDER_NAMES)[number];

/**
 * Resolves a configured provider name to a known provider. Unknown or missing
 * values fall back to `passthrough`, which never fabricates a translation.
 */
export function selectTranslationProvider(
  value: string | null | undefined,
): TranslationProviderName {
  return (TRANSLATION_PROVIDER_NAMES as readonly string[]).includes(value ?? "")
    ? (value as TranslationProviderName)
    : "passthrough";
}

export interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface TranslationResult {
  messageId: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  translatedText: string | null;
  status: TranslationStatus;
  provider: TranslationProviderName;
  errorMessage?: string;
}

export interface TranslationProvider {
  readonly name: TranslationProviderName;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
