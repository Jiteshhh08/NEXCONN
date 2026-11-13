import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyWebhookSignature } from "./signature";
import { signRequest } from "@/server/nexconn/signing";

const APP_SECRET = "test-secret";
const APP_KEY = "test-app-key";
const NONCE = "abcdef1234567890ab";
const TIMESTAMP = "1408710653491";
const NOW_MS = 1408710653491;
// sha1(APP_SECRET + NONCE + TIMESTAMP)
const SIGNATURE = "dc1df8b9d6344fd95fcd10dca1c3996c2f510af3";

const validInput = {
  appSecret: APP_SECRET,
  expectedAppKey: APP_KEY,
  appKey: APP_KEY,
  nonce: NONCE,
  timestamp: TIMESTAMP,
  signature: SIGNATURE,
};

const atNow = { nowMs: NOW_MS };

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed delivery", () => {
    assert.equal(verifyWebhookSignature(validInput, atNow), true);
  });

  it("accepts an upper-case Signature header", () => {
    assert.equal(
      verifyWebhookSignature(
        {
          ...validInput,
          signature: SIGNATURE.toUpperCase(),
        },
        atNow,
      ),
      true,
    );
  });

  it("rejects a tampered payload signature", () => {
    assert.equal(
      verifyWebhookSignature(
        {
          ...validInput,
          nonce: "abcdef1234567890ac",
        },
        atNow,
      ),
      false,
    );
  });

  it("rejects a signature from a different app key", () => {
    assert.equal(
      verifyWebhookSignature(
        { ...validInput, appKey: "another-app-key" },
        atNow,
      ),
      false,
    );
  });

  it("rejects a signature produced with a different secret", () => {
    assert.equal(
      verifyWebhookSignature(
        { ...validInput, appSecret: "wrong-secret" },
        atNow,
      ),
      false,
    );
  });

  it("rejects a delivery with missing signature headers", () => {
    assert.equal(
      verifyWebhookSignature({ ...validInput, signature: null }, atNow),
      false,
    );
    assert.equal(
      verifyWebhookSignature({ ...validInput, nonce: null }, atNow),
      false,
    );
    assert.equal(
      verifyWebhookSignature({ ...validInput, timestamp: null }, atNow),
      false,
    );
    assert.equal(
      verifyWebhookSignature({ ...validInput, appKey: null }, atNow),
      false,
    );
  });

  it("rejects a delivery outside the timestamp window", () => {
    assert.equal(
      verifyWebhookSignature(validInput, {
        nowMs: NOW_MS + 10 * 60 * 1000,
      }),
      false,
    );
    assert.equal(
      verifyWebhookSignature(validInput, {
        nowMs: NOW_MS - 10 * 60 * 1000,
      }),
      false,
    );
  });

  it("accepts a timestamp expressed in seconds", () => {
    const seconds = String(Math.floor(NOW_MS / 1000));
    const signature = signRequest(APP_SECRET, NONCE, seconds);

    assert.equal(
      verifyWebhookSignature(
        { ...validInput, timestamp: seconds, signature },
        atNow,
      ),
      true,
    );
  });

  it("rejects a non-numeric timestamp", () => {
    assert.equal(
      verifyWebhookSignature({ ...validInput, timestamp: "not-a-time" }, atNow),
      false,
    );
  });
});
