import "server-only";

import { serverEnv } from "@/lib/env";
import {
  selectTranslationProvider,
  type TranslationProvider,
} from "@/lib/translation/contracts";

import { LibreTranslateProvider } from "./libretranslate";
import { MyMemoryTranslationProvider } from "./mymemory";
import { NexconnTranslationProvider } from "./nexconn";
import { PassthroughTranslationProvider } from "./passthrough";

let provider: TranslationProvider | null = null;
let providerName: string | null = null;

/**
 * Builds the provider selected by `TRANSLATION_PROVIDER`. The value is
 * resolved through `selectTranslationProvider`, so an unknown or unset name
 * falls back to `passthrough`, which never fabricates a translation.
 */
export function getTranslationProvider(): TranslationProvider {
  const selected = selectTranslationProvider(serverEnv.TRANSLATION_PROVIDER);
  if (provider && providerName === selected) return provider;

  switch (selected) {
    case "nexconn":
      provider = new NexconnTranslationProvider();
      break;
    case "libretranslate":
      provider = new LibreTranslateProvider();
      break;
    case "mymemory":
      provider = new MyMemoryTranslationProvider();
      break;
    default:
      provider = new PassthroughTranslationProvider();
  }

  providerName = selected;
  return provider;
}
