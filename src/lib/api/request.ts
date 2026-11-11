import "server-only";

import { forbidden } from "@/lib/api/errors";

/**
 * Rejects state-changing requests whose Origin does not match this deployment.
 * Same-origin fetch/forms set Origin; non-browser clients may omit it, and the
 * session cookie's SameSite=Lax setting remains the second line of defence.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    throw forbidden("This request did not come from Vaani Room.");
  }
}
