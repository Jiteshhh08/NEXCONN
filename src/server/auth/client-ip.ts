import { isIP } from "node:net";

// Headers whose value is a comma-separated chain of addresses.
const CHAINED_PROXY_HEADERS = new Set([
  "x-forwarded-for",
  "x-vercel-forwarded-for",
]);

// Forwarding headers are normally short. Reject absurd values before parsing.
// 1 KiB still fits a chain of 10 maximum-length IPv6 addresses.
const MAX_IP_HEADER_LENGTH = 1024;

/**
 * Resolves the client address from a header that a proxy we control is
 * expected to set.
 *
 * A chain like `client, proxy1, proxy2` has one entry appended by each proxy.
 * With one trusted hop the client is at `parts.length - 1 - 1`; with two
 * trusted hops it is at `parts.length - 2 - 1`. A single bare value is also
 * accepted because an overwriting proxy leaves only the client address.
 *
 * Returns null for malformed values, a chain shorter than the configured hops,
 * or any entry that is not an IP address, so untrusted values cannot create
 * distinct rate-limit buckets.
 */
export function resolveClientIp(
  headerName: string,
  hops: number,
  rawHeader: string | null,
): string | null {
  const value = rawHeader?.trim();
  if (!value || value.length > MAX_IP_HEADER_LENGTH) return null;

  if (!CHAINED_PROXY_HEADERS.has(headerName)) {
    // A single-address header must contain exactly one valid IP.
    return isIP(value) ? value : null;
  }

  const parts = value.split(",").map((part) => part.trim());

  // A single value is what an overwriting proxy leaves behind, so accept it
  // even though there is no chain to count back through.
  if (parts.length === 1) {
    const single = parts[0];
    return single && isIP(single) ? single : null;
  }

  if (!Number.isInteger(hops) || hops < 1) return null;
  if (parts.some((part) => !isIP(part))) return null;

  const index = parts.length - hops - 1;
  if (index < 0 || index >= parts.length) return null;

  return parts[index] ?? null;
}
