import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAnswerSchema,
  historyQuerySchema,
  joinCodeSchema,
  joinRoomSchema,
  moderateQuestionSchema,
  submitQuestionSchema,
} from "./validation";

describe("joinCodeSchema", () => {
  it("normalises a valid join code to upper case", () => {
    assert.equal(joinCodeSchema.parse("ab3defg"), "AB3DEFG");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(joinCodeSchema.parse("  ab3defg  "), "AB3DEFG");
  });

  it("rejects codes shorter than 6 characters", () => {
    assert.equal(joinCodeSchema.safeParse("abc12").success, false);
  });

  it("rejects codes longer than 12 characters", () => {
    assert.equal(joinCodeSchema.safeParse("abcdefghijklm").success, false);
  });

  it("rejects punctuation and inner spaces", () => {
    assert.equal(joinCodeSchema.safeParse("ABC-123").success, false);
    assert.equal(joinCodeSchema.safeParse("ABC 123").success, false);
  });
});

describe("joinRoomSchema", () => {
  it("accepts a minimal join and defaults isAnonymous to false", () => {
    const parsed = joinRoomSchema.parse({ preferredLanguage: "hi" });
    assert.equal(parsed.isAnonymous, false);
    assert.equal(parsed.displayName, undefined);
  });

  it("treats a whitespace-only display name as anonymous", () => {
    const parsed = joinRoomSchema.parse({
      preferredLanguage: "hi",
      displayName: "   ",
    });
    assert.equal(parsed.displayName, undefined);
  });

  it("rejects a display name longer than 40 characters", () => {
    assert.equal(
      joinRoomSchema.safeParse({
        preferredLanguage: "hi",
        displayName: "x".repeat(41),
      }).success,
      false,
    );
  });

  it("requires a supported preferred language", () => {
    assert.equal(
      joinRoomSchema.safeParse({ preferredLanguage: "fr" }).success,
      false,
    );
  });
});

describe("submitQuestionSchema", () => {
  const valid = {
    text: "How do we deploy this?",
    sourceLanguage: "en",
    clientNonce: "nonce-12345678",
  };

  it("accepts a valid submission and defaults isAnonymous to false", () => {
    const parsed = submitQuestionSchema.parse(valid);
    assert.equal(parsed.isAnonymous, false);
    assert.equal(parsed.sourceLanguage, "en");
  });

  it("rejects text shorter than 3 characters", () => {
    assert.equal(
      submitQuestionSchema.safeParse({ ...valid, text: "hi" }).success,
      false,
    );
  });

  it("rejects text longer than 1000 characters", () => {
    assert.equal(
      submitQuestionSchema.safeParse({ ...valid, text: "x".repeat(1001) })
        .success,
      false,
    );
  });

  it("rejects an unsupported source language", () => {
    assert.equal(
      submitQuestionSchema.safeParse({ ...valid, sourceLanguage: "zz" })
        .success,
      false,
    );
  });

  it("rejects a missing client nonce", () => {
    const { clientNonce: _clientNonce, ...withoutNonce } = valid;
    assert.equal(submitQuestionSchema.safeParse(withoutNonce).success, false);
  });

  it("rejects unknown keys", () => {
    assert.equal(
      submitQuestionSchema.safeParse({ ...valid, sneaky: 1 }).success,
      false,
    );
  });
});

describe("createAnswerSchema", () => {
  const valid = { answerText: "Use the staging cluster.", answerLanguage: "en" };

  it("accepts a valid answer and defaults isPinned to false", () => {
    const parsed = createAnswerSchema.parse(valid);
    assert.equal(parsed.isPinned, false);
  });

  it("rejects a one-character answer", () => {
    assert.equal(
      createAnswerSchema.safeParse({ ...valid, answerText: "x" }).success,
      false,
    );
  });
});

describe("moderateQuestionSchema", () => {
  it("accepts the documented host actions", () => {
    for (const status of ["approved", "hidden", "rejected"] as const) {
      assert.equal(moderateQuestionSchema.safeParse({ status }).success, true);
    }
  });

  it("rejects 'pending' because it is not a host action", () => {
    assert.equal(
      moderateQuestionSchema.safeParse({ status: "pending" }).success,
      false,
    );
  });

  it("rejects an unknown status", () => {
    assert.equal(
      moderateQuestionSchema.safeParse({ status: "deleted" }).success,
      false,
    );
  });
});

describe("historyQuerySchema", () => {
  it("defaults the limit to 50", () => {
    assert.equal(historyQuerySchema.parse({}).limit, 50);
  });

  it("coerces a string limit", () => {
    assert.equal(historyQuerySchema.parse({ limit: "25" }).limit, 25);
  });

  it("rejects a limit above 100", () => {
    assert.equal(historyQuerySchema.safeParse({ limit: "101" }).success, false);
  });

  it("rejects a limit below 1", () => {
    assert.equal(historyQuerySchema.safeParse({ limit: "0" }).success, false);
  });
});
