import { createHash, randomBytes } from "node:crypto";

/**
 * Nexconn request-signing helpers.
 *
 * Verified contract:
 *   Signature = sha1(AppSecret + Nonce + Timestamp)  -> lowercase hex
 *   Timestamp = Unix milliseconds;  Nonce = a random string, at most 18 chars
 * https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth
 * https://docs.nexconn.ai/platform-chat-api/webhook/overview
 *
 * These helpers are intentionally free of the `server-only` guard so the focused
 * tests can import them under plain Node. They hold no credentials; the modules
 * that read the App Secret (`./client.ts`) carry the guard themselves.
 */

export const MAX_NONCE_LENGTH = 18;

/**
 * Hex keeps the nonce alphanumeric and independent of the App Secret.
 * 9 random bytes render as exactly 18 hex characters.
 */
export function createNonce(): string {
  return randomBytes(MAX_NONCE_LENGTH / 2).toString("hex");
}

export function signRequest(
  appSecret: string,
  nonce: string,
  timestamp: number | string,
): string {
  return createHash("sha1")
    .update(`${appSecret}${nonce}${String(timestamp)}`)
    .digest("hex");
}

/** Length-guarded, constant-time comparison of two signature strings. */
export function signaturesMatch(expected: string, received: string): boolean {
  if (expected.length === 0 || expected.length !== received.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }

  return mismatch === 0;
}
