import { signaturesMatch, signRequest } from "@/server/nexconn/signing";

/**
 * Nexconn webhook signature verification.
 *
 * Verified contract: every webhook request carries the headers `AppKey`,
 * `Nonce`, `Timestamp` and `Signature`, where
 *   Signature = sha1(AppSecret + Nonce + Timestamp)   (lowercase hex)
 * There is no separate webhook secret — the App Secret signs webhooks.
 * https://docs.nexconn.ai/platform-chat-api/webhook/overview
 *
 * No clock-skew window is documented, so none is enforced here. Replay
 * protection comes from the `WebhookEvent.externalId` uniqueness ledger.
 *
 * Kept free of the `server-only` guard so the focused tests can import it; it
 * receives the App Secret as an argument and never reads the environment.
 */

export interface WebhookSignatureHeaders {
  appKey: string | null;
  nonce: string | null;
  timestamp: string | null;
  signature: string | null;
}

export interface WebhookVerificationInput extends WebhookSignatureHeaders {
  appSecret: string;
  expectedAppKey: string;
}

export function readWebhookSignatureHeaders(
  headers: Headers,
): WebhookSignatureHeaders {
  // Header lookups are case-insensitive, so the documented `AppKey` spelling
  // works regardless of how the client casing arrives.
  return {
    appKey: headers.get("AppKey"),
    nonce: headers.get("Nonce"),
    timestamp: headers.get("Timestamp"),
    signature: headers.get("Signature"),
  };
}

export function verifyWebhookSignature(
  input: WebhookVerificationInput,
): boolean {
  const { appKey, nonce, timestamp, signature, appSecret, expectedAppKey } =
    input;

  if (!appKey || !nonce || !timestamp || !signature) return false;
  if (appKey !== expectedAppKey) return false;

  const expected = signRequest(appSecret, nonce, timestamp);
  return signaturesMatch(expected, signature.trim().toLowerCase());
}
