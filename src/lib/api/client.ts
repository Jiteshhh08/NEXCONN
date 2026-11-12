/**
 * Browser-side helper for the `{ ok, data }` / `{ ok, error }` API envelope.
 * Shared by the room client components; it must never import server modules.
 */

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
}

interface ApiFailureEnvelope {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    // The room board polls this endpoint for new answers, questions and votes.
    // HTTP caching would hand the poll a stale body while the database already
    // holds the new row, so the browser must always revalidate. Callers can
    // still override this by passing their own `cache` option.
    cache: "no-store",
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const envelope = body as ApiSuccessEnvelope<T> | ApiFailureEnvelope | null;

  if (envelope && envelope.ok === true) return envelope.data;

  if (envelope && envelope.ok === false) {
    throw new ApiRequestError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.details,
    );
  }

  throw new ApiRequestError(
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
    response.status,
  );
}
