import "server-only";

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@/lib/translation/contracts";
import { translateWithMyMemory } from "@/lib/translation/mymemory";

/**
 * Server-side MyMemory provider.
 *
 * The request/response handling lives in `@/lib/translation/mymemory` so it can
 * be unit-tested; this class only adapts that logic to the
 * {@link TranslationProvider} seam and keeps it out of browser bundles.
 *
 * `MYMEMORY_EMAIL` is optional: MyMemory raises the daily quota when a contact
 * address is supplied. It is read on the server and never sent to the browser.
 */
export class MyMemoryTranslationProvider implements TranslationProvider {
  readonly name = "mymemory" as const;

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const email = process.env.MYMEMORY_EMAIL?.trim();

    return translateWithMyMemory(request, {
      ...(email ? { email } : {}),
    });
  }
}

export default MyMemoryTranslationProvider;
