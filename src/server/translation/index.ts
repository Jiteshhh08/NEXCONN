import "server-only";

import { serverEnv } from "@/lib/env";
import type { TranslationProvider } from "@/lib/translation/contracts";

import { LibreTranslateProvider } from "./libretranslate";
import { NexconnTranslationProvider } from "./nexconn";
import { PassthroughTranslationProvider } from "./passthrough";

let provider: TranslationProvider | null = null;

export function getTranslationProvider(): TranslationProvider {
  if (provider) return provider;

  switch (serverEnv.TRANSLATION_PROVIDER) {
    case "nexconn":
      provider = new NexconnTranslationProvider();
      break;
    case "libretranslate":
      provider = new LibreTranslateProvider();
      break;
    default:
      provider = new PassthroughTranslationProvider();
  }

  return provider;
}
