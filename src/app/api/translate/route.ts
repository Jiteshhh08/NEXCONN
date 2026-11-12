import { AppError, unauthorized } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { translateRequestSchema } from "@/lib/validation";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import { getTranslationProvider } from "@/server/translation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Translates one piece of room text into the viewer's language.
 *
 * The provider is chosen server-side from `TRANSLATION_PROVIDER`; the browser
 * never learns which credential a provider uses (none are returned). A
 * provider that cannot translate produces an explicit
 * `TRANSLATION_UNAVAILABLE` (502) — the caller must never treat a 200 as proof
 * of a translation, and an unavailable provider never returns the original
 * text in place of a translation.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const user = await getSessionUser();
    if (!user) throw unauthorized("Join a room before translating.");

    const limit = checkRateLimit(`translate:${user.id}`, 60, 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "You are translating very quickly. Please wait a moment and try again.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, translateRequestSchema);

    const result = await getTranslationProvider().translate({
      messageId: crypto.randomUUID(),
      text: input.text,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    });

    if (result.status !== "ready" || !result.translatedText) {
      throw new AppError(
        "TRANSLATION_UNAVAILABLE",
        result.errorMessage ??
          "Translation is not available right now. The original text is shown.",
        502,
      );
    }

    return apiSuccess({
      translation: {
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        provider: result.provider,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
