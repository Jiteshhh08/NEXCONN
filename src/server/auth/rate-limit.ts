import "server-only";

import { isIP } from "node:net";

import { serverEnv } from "@/lib/env";

interface Bucket {
  count: number;
  resetAt: number;
}

// A hard ceiling keeps memory bounded even if every request uses a different
// key. At roughly 100 bytes per entry this is a few megabytes at most.
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;
// Forwarding headers are normally short. Reject absurd values before parsing.
// 1 KiB still fits a chain of 10 maximum-length IPv6 addresses.
const MAX_IP_HEADER_LENGTH = 1024;
// Headers whose value is a comma-separated chain of addresses.
const CHAINED_PROXY_HEADERS = new Set([
  "x-forwarded-for",
  "x-vercel-forwarded-for",
]);

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
 * Resolves the client address from a header that a proxy we control is
 * expected to set. Returns null when no trusted source is configured or the
 * value is not a bare IP address, so spoofed or malformed headers can never
 * create distinct buckets.
 */
function resolveClientIp(request: Request): string | null {
  const headerName = serverEnv.TRUSTED_PROXY_HEADER;
  if (headerName === "none") return null;

  const raw = request.headers.get(headerName);
  if (!raw) return null;

  const value = raw.trim();
  if (!value || value.length > MAX_IP_HEADER_LENGTH) return null;

  if (!CHAINED_PROXY_HEADERS.has(headerName)) {
    // A single-address header must contain exactly one valid IP.
    return isIP(value) ? value : null;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  // The entries appended nearest to this server are the ones written by our
  // trusted proxies. Anything to the left of that position may be supplied by
  // the client, so count back from the end by the configured hop count.
  const index = parts.length - serverEnv.TRUSTED_PROXY_HOPS;
  const candidate = parts[index];
  if (!candidate || !isIP(candidate)) return null;

  return candidate;
}

/**
 * Client key for coarse abuse limiting, never for authorization. When no
 * trusted proxy header is configured, every request shares the `untrusted`
 * key: one conservative bucket is safer than letting clients choose their own.
 */
export function getClientKey(request: Request, scope: string): string {
  const ip = resolveClientIp(request);
  return `${scope}:${ip ?? "untrusted"}`;
}
