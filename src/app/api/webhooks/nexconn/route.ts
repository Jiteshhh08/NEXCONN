import { Prisma } from "@prisma/client";
import { z } from "zod";

import { apiError, apiFailure, apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import {
  readWebhookSignatureHeaders,
  verifyWebhookSignature,
} from "@/server/webhooks/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nexconn webhook receiver.
 *
 * Source: https://docs.nexconn.ai/platform-chat-api/webhook/overview
 *
 * - Deliveries are signed with the **App Secret** (there is no separate webhook
 *   secret): `Signature = sha1(AppSecret + Nonce + Timestamp)` in the
 *   `AppKey` / `Nonce` / `Timestamp` / `Signature` headers.
 * - The signature is verified before the body is parsed.
 * - The signature covers `AppSecret + Nonce + Timestamp` only, so two ledgers
 *   protect against replay: `WebhookEvent.externalId` makes repeated
 *   deliveries of one event idempotent, and `WebhookEvent.nonce` rejects a
 *   re-used signed header inside the timestamp window.
 * - The `Timestamp` header must be within {@link WEBHOOK_TOLERANCE_MS}.
 * - Per-event payload shapes are not yet interpreted; events are archived raw
 *   until each documented payload has been confirmed against a live app.
 */
const webhookEnvelopeSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().min(1),
    time: z.number().optional(),
    data: z.array(z.unknown()).optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    const appKey = serverEnv.NEXCONN_APP_KEY;
    const appSecret = serverEnv.NEXCONN_APP_SECRET;

    if (!appKey || !appSecret) {
      return apiFailure(
        "INTEGRATION_NOT_CONFIGURED",
        "Nexconn webhooks cannot be verified until the App Key and App Secret are configured.",
        503,
      );
    }

    const rawBody = await request.text();

    const signatureHeaders = readWebhookSignatureHeaders(request.headers);
    const verified = verifyWebhookSignature({
      ...signatureHeaders,
      appSecret,
      expectedAppKey: appKey,
    });

    if (!verified) {
      return apiFailure(
        "UNAUTHORIZED",
        "Webhook signature verification failed.",
        401,
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return apiFailure(
        "INVALID_JSON",
        "Webhook body must be valid JSON.",
        400,
      );
    }

    const envelope = webhookEnvelopeSchema.safeParse(parsedBody);
    if (!envelope.success) {
      return apiFailure(
        "VALIDATION_ERROR",
        "Unexpected Nexconn webhook payload shape.",
        400,
      );
    }

    const { id, type } = envelope.data;
    const nonce = signatureHeaders.nonce;

    // Two deliveries can share an event id (retry) or reuse signed headers
    // with a different body (replay). Either is a duplicate, not new work.
    const existing = await prisma.webhookEvent.findFirst({
      where: { OR: [{ externalId: id }, ...(nonce ? [{ nonce }] : [])] },
      select: { id: true },
    });

    if (existing) {
      return apiSuccess({ received: true, duplicate: true });
    }

    try {
      await prisma.webhookEvent.create({
        data: {
          externalId: id,
          nonce,
          eventType: type,
          payload: rawBody,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      // A concurrent delivery of the same event is not an error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return apiSuccess({ received: true, duplicate: true });
      }
      throw error;
    }

    return apiSuccess({ received: true, duplicate: false });
  } catch (error) {
    return apiError(error);
  }
}
