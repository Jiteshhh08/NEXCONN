import type { LanguageCode, TranslationStatus } from "@/lib/domain";

export type TranslationProviderName =
  | "passthrough"
  | "nexconn"
  | "libretranslate";

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
