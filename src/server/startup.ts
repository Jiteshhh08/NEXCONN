import "server-only";

import { assertRuntimeEnv } from "@/lib/env";

/**
 * Node-only startup enforcement. Kept separate from `instrumentation.ts` so
 * the Edge compilation of that shared hook never sees Node-specific APIs.
 */
export function assertStartupEnv(): void {
  try {
    assertRuntimeEnv();
  } catch (error) {
    // Next logs instrumentation failures but keeps the process alive. A server
    // without its required production secret must not accept traffic at all.
    console.error(
      "[vaani-room] Refusing to start with an invalid environment:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
