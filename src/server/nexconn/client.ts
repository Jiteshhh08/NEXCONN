import "server-only";

import { AppError, IntegrationNotConfiguredError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";

import { createNonce, signRequest } from "./signing";

/**
 * Signed HTTP client for the Nexconn Platform Chat Server API.
 *
 * Every endpoint is `POST` with a JSON body and the same signed headers:
 *   App-Key, Nonce, Timestamp, Signature, Content-Type
 * where `Signature = sha1(AppSecret + Nonce + Timestamp)` (lowercase hex).
 *
 * Sources:
 *   https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth
 *   https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/base-url
 *   https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/chat-server-api-list
 *
 * Security: this module is server-only. The App Secret never leaves the server.
 */

/** Documented failover trigger: a 5-second timeout or an unexpected status. */
const REQUEST_TIMEOUT_MS = 5_000;

/** Regional hosts are published as `api.<region>` with an `api-b.<region>` backup. */
const PRIMARY_HOST_PATTERN = "://api.";
const BACKUP_HOST_REPLACEMENT = "://api-b.";

export interface NexconnCredentials {
  appKey: string;
  appSecret: string;
}

/** Envelope shared by all Platform Chat API responses. */
interface NexconnEnvelope<T> {
  code: number;
  msg?: string;
  result?: T;
}

export class NexconnRequestError extends AppError {
  readonly endpoint: string;
  readonly nexconnCode: number;

  constructor(endpoint: string, nexconnCode: number, message: string) {
    super(
      "INTERNAL_ERROR",
      `Nexconn request to ${endpoint} failed (code ${nexconnCode}): ${message}`,
      502,
    );
    this.name = "NexconnRequestError";
    this.endpoint = endpoint;
    this.nexconnCode = nexconnCode;
  }
}

/**
 * Reads the App Key and App Secret, or throws the documented configuration
 * error so callers surface a clear 503 instead of a network failure.
 */
export function readNexconnCredentials(): NexconnCredentials {
  const appKey = serverEnv.NEXCONN_APP_KEY;
  const appSecret = serverEnv.NEXCONN_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new IntegrationNotConfiguredError("Nexconn Chat");
  }

  return { appKey, appSecret };
}

/**
 * Returns the account's regional host followed by its documented backup host.
 * The backup is only derived when the configured URL follows the published
 * `api.<region>` naming; an unrecognised host is used alone.
 */
export function resolveBaseUrls(): string[] {
  const configured = serverEnv.NEXCONN_API_BASE_URL;

  if (!configured) {
    throw new IntegrationNotConfiguredError("Nexconn Chat");
  }

  const primary = configured.replace(/\/+$/, "");
  const urls = [primary];

  if (primary.includes(PRIMARY_HOST_PATTERN)) {
    urls.push(primary.replace(PRIMARY_HOST_PATTERN, BACKUP_HOST_REPLACEMENT));
  }

  return urls;
}

function buildSignedHeaders(appKey: string, appSecret: string): Headers {
  const nonce = createNonce();
  const timestamp = Date.now();

  return new Headers({
    "App-Key": appKey,
    Nonce: nonce,
    Timestamp: String(timestamp),
    Signature: signRequest(appSecret, nonce, timestamp),
    "Content-Type": "application/json",
  });
}

async function postJson(
  url: string,
  headers: Headers,
  body: Record<string, unknown>,
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    return { status: response.status, text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Signs and sends one Platform Chat API request, returning the `result` field
 * of the response envelope. A timeout, a network error, or a 5xx response
 * moves to the next regional host before failing.
 */
export async function nexconnRequest<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { appKey, appSecret } = readNexconnCredentials();
  const baseUrls = resolveBaseUrls();

  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    try {
      const { status, text } = await postJson(
        `${baseUrl}${endpoint}`,
        buildSignedHeaders(appKey, appSecret),
        body,
      );

      if (status >= 500) {
        lastError = new Error(`Nexconn returned HTTP ${status} for ${endpoint}.`);
        continue;
      }

      let envelope: NexconnEnvelope<T>;
      try {
        envelope = JSON.parse(text) as NexconnEnvelope<T>;
      } catch {
        throw new NexconnRequestError(
          endpoint,
          -1,
          "the response was not valid JSON",
        );
      }

      if (envelope.code !== 0) {
        throw new NexconnRequestError(
          endpoint,
          envelope.code,
          envelope.msg ?? "unknown Nexconn error",
        );
      }

      return envelope.result as T;
    } catch (error) {
      // Business errors and configuration errors must not trigger failover.
      if (
        error instanceof NexconnRequestError ||
        error instanceof IntegrationNotConfiguredError
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new NexconnRequestError(
    endpoint,
    -1,
    lastError instanceof Error
      ? lastError.message
      : "no regional host responded",
  );
}
