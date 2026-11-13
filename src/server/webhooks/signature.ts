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
 * No clock-skew window is documented by Nexconn, so Vaani applies a
 * conservative five-minute window in both directions. Because the vendor
 * signature covers only `AppSecret + Nonce + Timestamp` and not the body, the
 * window plus the unique nonce ledger in the webhook route are the available
 * replay protections. Body integrity cannot be guaranteed by this contract.
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

/**
 * Nexconn signs `sha1(AppSecret + Nonce + Timestamp)` only — the body is not
 * part of the signature. A timestamp window plus the unique nonce ledger in
 * the webhook route therefore provide replay protection; they cannot provide
 * body integrity. Accept that residual vendor-contract limitation explicitly.
 */
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export interface WebhookVerificationOptions {
  /** Injectable clock for tests. */
  nowMs?: number;
  toleranceMs?: number;
}

export function verifyWebhookSignature(
  input: WebhookVerificationInput,
  options: WebhookVerificationOptions = {},
): boolean {
  const { appKey, nonce, timestamp, signature, appSecret, expectedAppKey } =
    input;

  if (!appKey || !nonce || !timestamp || !signature) return false;
  if (appKey !== expectedAppKey) return false;

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return false;

  // The documented unit is Unix milliseconds; also accept seconds so a
  // provider/config drift does not silently disable delivery.
  const timestampMs =
    numericTimestamp < 1_000_000_000_000
      ? numericTimestamp * 1000
      : numericTimestamp;
  const now = options.nowMs ?? Date.now();
  const tolerance = options.toleranceMs ?? WEBHOOK_TOLERANCE_MS;
  if (Math.abs(now - timestampMs) > tolerance) return false;

  const expected = signRequest(appSecret, nonce, timestamp);
  return signaturesMatch(expected, signature.trim().toLowerCase());
}
