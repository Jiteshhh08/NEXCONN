import "server-only";

import { createHash } from "node:crypto";

import { serverEnv } from "@/lib/env";

import { resolveClientIp } from "./client-ip";

interface Bucket {
  count: number;
  resetAt: number;
}

// A hard ceiling keeps memory bounded even if every request uses a different
// key. At roughly 100 bytes per entry this is a few megabytes at most.
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

/**
 * Drops expired buckets. Sweeps run lazily on requests, at most once a minute,
 * so the limiter never needs a timer that would keep the process alive.
 */
function sweepExpired(now: number, force = false): void {
  if (!force && now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function storeBucket(key: string, bucket: Bucket, now: number): void {
  if (buckets.size >= MAX_BUCKETS) {
    sweepExpired(now, true);

    // Still full: evict the least recently stored entries. Map iteration
    // order is insertion order, so the first key is the oldest.
    while (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next();
      if (oldest.done) break;
      buckets.delete(oldest.value);
    }
  }

  buckets.set(key, bucket);
}

/**
 * Small in-process fixed-window limiter. It protects a single Node instance
 * during development and demos. A multi-instance deployment should replace it
 * with a shared store (see TEAM_LEAD.md, production checklist).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    // Re-insert so a refreshed bucket becomes the newest entry.
    buckets.delete(key);
    storeBucket(key, { count: 1, resetAt: now + windowMs }, now);
    return { allowed: true };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      ),
    };
  }

  current.count += 1;
  return { allowed: true };
}

/**
 * Reads the client address from the deployment's trusted proxy header, if one
 * is configured. Returns null when no trusted source is available so callers
 * can use the conservative shared bucket.
 */
function getTrustedClientIp(request: Request): string | null {
  const headerName = serverEnv.TRUSTED_PROXY_HEADER;
  if (headerName === "none") return null;

  return resolveClientIp(
    headerName,
    serverEnv.TRUSTED_PROXY_HOPS,
    request.headers.get(headerName),
  );
}

/**
 * Reads a cookie value without importing the session module. Keeping this
 * local avoids a cycle and keeps the limiter usable from any route.
 */
function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Client key for coarse abuse limiting, never for authorization.
 *
 * When a trusted proxy header is configured, the address is used. Otherwise
 * the limiter falls back to the session cookie (stable and costly to forge for
 * a signed-in or joined browser) and then to a hash of request hints. There is
 * deliberately no shared `untrusted` bucket: a global bucket lets one client
 * exhaust the limit for every user on the deployment.
 */
export function getClientKey(request: Request, scope: string): string {
  const ip = getTrustedClientIp(request);
  if (ip) return `${scope}:ip:${ip}`;

  const sessionToken = readCookie(
    request.headers.get("cookie"),
    "vaani_session",
  );
  if (sessionToken) {
    return `${scope}:session:${fingerprint(sessionToken)}`;
  }

  const hints = [
    request.headers.get("user-agent") ?? "",
    request.headers.get("accept-language") ?? "",
    request.headers.get("sec-ch-ua") ?? "",
  ].join("\n");

  return `${scope}:fingerprint:${fingerprint(hints)}`;
}
