import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyWebhookSignature } from "./signature";

const APP_SECRET = "test-secret";
const APP_KEY = "test-app-key";
const NONCE = "abcdef1234567890ab";
const TIMESTAMP = "1408710653491";
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

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed delivery", () => {
    assert.equal(verifyWebhookSignature(validInput), true);
  });

  it("accepts an upper-case Signature header", () => {
    assert.equal(
      verifyWebhookSignature({
        ...validInput,
        signature: SIGNATURE.toUpperCase(),
      }),
      true,
    );
  });

  it("rejects a tampered payload signature", () => {
    assert.equal(
      verifyWebhookSignature({
        ...validInput,
        nonce: "abcdef1234567890ac",
      }),
      false,
    );
  });

  it("rejects a signature from a different app key", () => {
    assert.equal(
      verifyWebhookSignature({ ...validInput, appKey: "another-app-key" }),
      false,
    );
  });

  it("rejects a signature produced with a different secret", () => {
    assert.equal(
      verifyWebhookSignature({ ...validInput, appSecret: "wrong-secret" }),
      false,
    );
  });

  it("rejects a delivery with missing signature headers", () => {
    assert.equal(
      verifyWebhookSignature({ ...validInput, signature: null }),
      false,
    );
    assert.equal(verifyWebhookSignature({ ...validInput, nonce: null }), false);
    assert.equal(
      verifyWebhookSignature({ ...validInput, timestamp: null }),
      false,
    );
    assert.equal(verifyWebhookSignature({ ...validInput, appKey: null }), false);
  });
});
