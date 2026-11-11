import "server-only";

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
 * Client key for coarse abuse limiting, never for authorization. When no
 * trusted proxy header is configured, every request shares the `untrusted`
 * key: one conservative bucket is safer than letting clients choose their own.
 */
export function getClientKey(request: Request, scope: string): string {
  const ip = getTrustedClientIp(request);
  return `${scope}:${ip ?? "untrusted"}`;
}
