import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeLiveEvent,
  encodeLiveEvent,
  LIVE_EVENT_MARKER,
} from "./events";

describe("encodeLiveEvent / decodeLiveEvent", () => {
  const event = {
    type: "question.created" as const,
    roomId: "room-123",
    payload: { questionId: "q-1", sourceLanguage: "hi", isAnonymous: false },
  };

  it("round-trips a structured room event", () => {
    const decoded = decodeLiveEvent(encodeLiveEvent(event));
    assert.deepEqual(decoded, event);
  });

  it("tags the encoded text with the Vaani marker", () => {
    const parsed = JSON.parse(encodeLiveEvent(event)) as Record<string, unknown>;
    assert.equal(parsed.vaani, LIVE_EVENT_MARKER);
  });

  it("rejects non-JSON text", () => {
    assert.equal(decodeLiveEvent("just a normal chat message"), null);
  });

  it("rejects JSON that is not a Vaani event", () => {
    assert.equal(decodeLiveEvent('{"hello":"world"}'), null);
    assert.equal(decodeLiveEvent("[1,2,3]"), null);
    assert.equal(decodeLiveEvent("null"), null);
  });

  it("rejects a Vaani event missing required fields", () => {
    assert.equal(
      decodeLiveEvent(JSON.stringify({ vaani: LIVE_EVENT_MARKER })),
      null,
    );
    assert.equal(
      decodeLiveEvent(
        JSON.stringify({ vaani: LIVE_EVENT_MARKER, type: "room.closed" }),
      ),
      null,
    );
  });

  it("rejects a Vaani event whose payload is not an object", () => {
    assert.equal(
      decodeLiveEvent(
        JSON.stringify({
          vaani: LIVE_EVENT_MARKER,
          type: "room.closed",
          roomId: "r1",
          payload: "nope",
        }),
      ),
      null,
    );
  });
});
