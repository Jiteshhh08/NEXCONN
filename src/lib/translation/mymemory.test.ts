import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { translateRequestSchema } from "../validation";
import {
  selectTranslationProvider,
  TRANSLATION_PROVIDER_NAMES,
} from "./contracts";
import {
  MYMEMORY_MAX_QUERY_BYTES,
  translateWithMyMemory,
  type MyMemoryTranslationRequest,
} from "./mymemory";

/**
 * Translation is the one feature that can silently lie to a user: if the
 * provider fails and the app returns the original text, the screen looks
 * exactly like a successful translation. These tests pin the opposite
 * contract — a `ready` result always carries text that came from the
 * provider, and every other outcome is an explicit `unavailable` with a
 * message the UI can show.
 */

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

interface Stub {
  calls: FetchCall[];
  fetchImpl: typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(
  responder: (call: FetchCall) => Response | Promise<Response>,
): Stub {
  const calls: FetchCall[] = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { input, init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;

  return { calls, fetchImpl };
}

function request(
  overrides: Partial<MyMemoryTranslationRequest> = {},
): MyMemoryTranslationRequest {
  return {
    messageId: "msg-1",
    text: "Good morning students",
    sourceLanguage: "en",
    targetLanguage: "hi",
    ...overrides,
  };
}

describe("selectTranslationProvider", () => {
  it("accepts every known provider name", () => {
    for (const name of TRANSLATION_PROVIDER_NAMES) {
      assert.equal(selectTranslationProvider(name), name);
    }
  });

  it("falls back to passthrough for unknown or missing values", () => {
    assert.equal(selectTranslationProvider(undefined), "passthrough");
    assert.equal(selectTranslationProvider(null), "passthrough");
    assert.equal(selectTranslationProvider(""), "passthrough");
    assert.equal(selectTranslationProvider("gpt-5"), "passthrough");
  });
});

describe("translateWithMyMemory", () => {
  it("returns the provider's translation on success", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      jsonResponse({
        responseData: { translatedText: "सुप्रभात विद्यार्थियों" },
        responseStatus: 200,
      }),
    );

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "ready");
    assert.equal(result.translatedText, "सुप्रभात विद्यार्थियों");
    assert.equal(result.provider, "mymemory");
    assert.equal(result.targetLanguage, "hi");

    const url = new URL(String(calls[0]?.input));
    assert.equal(url.searchParams.get("q"), "Good morning students");
    assert.equal(url.searchParams.get("langpair"), "en|hi");
  });

  it("treats an identical source and target as a genuine no-op", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({}));

    const result = await translateWithMyMemory(request({ targetLanguage: "en" }), {
      fetchImpl,
    });

    assert.equal(result.status, "ready");
    assert.equal(result.translatedText, "Good morning students");
    assert.equal(calls.length, 0);
  });

  it("reports empty text as unavailable without calling the provider", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({}));

    const result = await translateWithMyMemory(request({ text: "   " }), {
      fetchImpl,
    });

    assert.equal(result.status, "unavailable");
    assert.equal(result.translatedText, null);
    assert.equal(calls.length, 0);
  });

  it("rejects text above the documented query limit", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({}));

    const result = await translateWithMyMemory(
      request({ text: "a".repeat(MYMEMORY_MAX_QUERY_BYTES + 1) }),
      { fetchImpl },
    );

    assert.equal(result.status, "unavailable");
    assert.match(result.errorMessage ?? "", /bytes per request/);
    assert.equal(calls.length, 0);
  });

  it("counts the query limit in bytes, not characters", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({}));

    // 300 Marathi characters are 900 UTF-8 bytes, above the 500-byte limit.
    const result = await translateWithMyMemory(
      request({ text: "स".repeat(300), sourceLanguage: "mr" }),
      { fetchImpl },
    );

    assert.equal(result.status, "unavailable");
    assert.equal(calls.length, 0);
  });

  it("reports an HTTP failure as unavailable", async () => {
    const { fetchImpl } = stubFetch(() => new Response("nope", { status: 503 }));

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.equal(result.translatedText, null);
    assert.match(result.errorMessage ?? "", /HTTP 503/);
  });

  it("survives a network failure without throwing", async () => {
    const { fetchImpl } = stubFetch(() => {
      throw new Error("socket hang up");
    });

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.match(result.errorMessage ?? "", /could not be reached/);
  });

  it("bounds the provider call with a timeout signal", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      jsonResponse({ responseData: { translatedText: "ok" } }),
    );

    await translateWithMyMemory(request(), { fetchImpl, timeoutMs: 5_000 });

    assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
  });

  it("reports an unparsable body as unavailable", async () => {
    const { fetchImpl } = stubFetch(() => new Response("<html>oops</html>"));

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.match(result.errorMessage ?? "", /unexpected response/);
  });

  it("reports an exhausted quota as unavailable", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({ quotaFinished: true, responseData: {} }),
    );

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.match(result.errorMessage ?? "", /quota/i);
  });

  it("surfaces the provider's own error detail", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({
        responseStatus: 403,
        responseDetails: "INVALID LANGUAGE PAIR",
        responseData: { translatedText: "" },
      }),
    );

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.equal(result.errorMessage, "INVALID LANGUAGE PAIR");
  });

  it("does not accept an empty translation as success", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({
        responseStatus: 200,
        responseData: { translatedText: "  " },
      }),
    );

    const result = await translateWithMyMemory(request(), { fetchImpl });

    assert.equal(result.status, "unavailable");
    assert.equal(result.translatedText, null);
  });

  it("passes the optional contact address to raise the quota", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      jsonResponse({ responseData: { translatedText: "नमस्ते" } }),
    );

    await translateWithMyMemory(request(), {
      fetchImpl,
      email: "teacher@example.com",
    });

    const url = new URL(String(calls[0]?.input));
    assert.equal(url.searchParams.get("de"), "teacher@example.com");
  });

  it("never leaks the contact address into the result", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({ responseData: { translatedText: "नमस्ते" } }),
    );

    const result = await translateWithMyMemory(request(), {
      fetchImpl,
      email: "teacher@example.com",
    });

    assert.equal(JSON.stringify(result).includes("teacher@example.com"), false);
  });
});

describe("translateRequestSchema", () => {
  it("accepts a well formed translation request", () => {
    const parsed = translateRequestSchema.parse({
      joinCode: "ABC123",
      text: "Good morning students",
      sourceLanguage: "en",
      targetLanguage: "mr",
    });

    assert.equal(parsed.targetLanguage, "mr");
  });

  it("rejects empty text", () => {
    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "   ",
        sourceLanguage: "en",
        targetLanguage: "hi",
      }).success,
      false,
    );
  });

  it("rejects text longer than the provider limit", () => {
    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "a".repeat(501),
        sourceLanguage: "en",
        targetLanguage: "hi",
      }).success,
      false,
    );
  });

  it("applies the limit in UTF-8 bytes, not characters", () => {
    // 300 Devanagari characters are 900 bytes: under the old character-based
    // limit they passed validation and then failed inside the provider.
    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "स".repeat(300),
        sourceLanguage: "mr",
        targetLanguage: "hi",
      }).success,
      false,
    );

    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "स".repeat(160),
        sourceLanguage: "mr",
        targetLanguage: "hi",
      }).success,
      true,
    );
  });

  it("rejects an unsupported target language", () => {
    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "Good morning students",
        sourceLanguage: "en",
        targetLanguage: "zz",
      }).success,
      false,
    );
  });

  it("rejects unexpected extra fields", () => {
    assert.equal(
      translateRequestSchema.safeParse({
        joinCode: "ABC123",
        text: "Good morning students",
        sourceLanguage: "en",
        targetLanguage: "hi",
        apiKey: "should-not-be-accepted",
      }).success,
      false,
    );
  });
});
