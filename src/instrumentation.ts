/**
 * Next.js calls `register` once when a new server instance starts, before it
 * accepts requests. Runtime-only environment requirements are enforced here
 * rather than at module load so `next build` can collect pages without
 * deployment secrets that are only injected into the running server.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Loaded dynamically so the Node-only startup module is not part of the
  // Edge runtime bundle.
  const { assertStartupEnv } = await import("./server/startup");
  assertStartupEnv();
}
