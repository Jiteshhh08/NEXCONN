import { createHash } from "node:crypto";

import { AppError, forbidden, unauthorized } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { translateRequestSchema } from "@/lib/validation";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import {
  assertRoomParticipant,
  loadRoomByCode,
} from "@/server/rooms/access";
import { getTranslationProvider } from "@/server/translation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Translates one piece of room text into the viewer's language.
 *
 * This is not an open translation proxy: the caller must be the room's host or
 * a joined participant, and the text must exist as a question or answer in
 * that room. Successful translations are cached in `MessageTranslation`, keyed
 * by a deterministic hash of the source language, target language and text, so
 * repeated board polls do not spend provider quota.
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

    const room = await loadRoomByCode(input.joinCode);
    if (room.hostUserId !== user.id) {
      await assertRoomParticipant(room.id, user.id);
    }

    // Only text that already exists in this room may be translated. Without
    // this check any signed-in user could use the endpoint as a free,
    // unauthenticated machine-translation API.
    const source = await prisma.question.findFirst({
      where: {
        roomId: room.id,
        OR: [
          { originalText: input.text },
          { answers: { some: { answerText: input.text } } },
        ],
      },
      select: { id: true },
    });
    if (!source) {
      throw forbidden(
        "Only questions and answers from this room can be translated.",
      );
    }

    const cacheKey = createHash("sha256")
      .update(
        `${input.sourceLanguage}\n${input.targetLanguage}\n${input.text}`,
      )
      .digest("hex");
    const messageId = `sha256:${cacheKey}`;

    const cached = await prisma.messageTranslation.findUnique({
      where: {
        messageId_targetLanguage: {
          messageId,
          targetLanguage: input.targetLanguage,
        },
      },
      select: { translatedText: true, provider: true, status: true },
    });

    if (cached?.status === "ready" && cached.translatedText) {
      return apiSuccess({
        translation: {
          translatedText: cached.translatedText,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          provider: cached.provider,
        },
        cached: true,
      });
    }

    const result = await getTranslationProvider().translate({
      messageId,
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

    await prisma.messageTranslation
      .upsert({
        where: {
          messageId_targetLanguage: {
            messageId,
            targetLanguage: input.targetLanguage,
          },
        },
        create: {
          messageId,
          targetLanguage: input.targetLanguage,
          sourceLanguage: input.sourceLanguage,
          sourceText: input.text,
          translatedText: result.translatedText,
          status: "ready",
          provider: result.provider,
        },
        update: {
          translatedText: result.translatedText,
          status: "ready",
          provider: result.provider,
          errorMessage: null,
        },
      })
      .catch((error: unknown) => {
        // The translation itself succeeded; a cache write must not turn it
        // into an error response.
        console.error(
          "[translate] Could not cache the translation:",
          error instanceof Error ? error.message : error,
        );
      });

    return apiSuccess({
      translation: {
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        provider: result.provider,
      },
      cached: false,
    });
  } catch (error) {
    return apiError(error);
  }
}