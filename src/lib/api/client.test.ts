import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ApiRequestError, apiFetch } from "./client";

/**
 * The room board polls the API for new answers, so these tests pin the two
 * properties that make the poll trustworthy: the request is never served from
 * the HTTP cache, and the `{ ok, data }` / `{ ok, error }` envelope is always
 * unwrapped (or reported as an `ApiRequestError`).
 */

const originalFetch = globalThis.fetch;

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function stubFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return response;
  }) as typeof fetch;

  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("apiFetch", () => {
  it("disables HTTP caching so a poll never reads a stale answer", async () => {
    const calls = stubFetch(jsonResponse({ ok: true, data: { questions: [] } }));

    await apiFetch("/api/rooms/ABCDEF/questions");

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.equal(calls[0]?.init?.credentials, "same-origin");
  });

  it("unwraps the success envelope", async () => {
    stubFetch(jsonResponse({ ok: true, data: { questions: [{ id: "q1" }] } }));

    const data = await apiFetch<{ questions: Array<{ id: string }> }>("/x");

    assert.deepEqual(data, { questions: [{ id: "q1" }] });
  });

  it("throws ApiRequestError carrying the failure envelope", async () => {
    stubFetch(
      jsonResponse(
        {
          ok: false,
          error: { code: "FORBIDDEN", message: "Join this room before taking part." },
        },
        403,
      ),
    );

    await assert.rejects(
      () => apiFetch("/x"),
      (error: unknown) => {
        assert.ok(error instanceof ApiRequestError);
        assert.equal(error.code, "FORBIDDEN");
        assert.equal(error.status, 403);
        assert.equal(error.message, "Join this room before taking part.");
        return true;
      },
    );
  });

  it("reports a non-envelope response as an internal error", async () => {
    stubFetch(new Response("gateway timeout", { status: 504 }));

    await assert.rejects(
      () => apiFetch("/x"),
      (error: unknown) =>
        error instanceof ApiRequestError && error.code === "INTERNAL_ERROR",
    );
  });
});
