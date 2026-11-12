import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_NONCE_LENGTH,
  createNonce,
  signRequest,
  signaturesMatch,
} from "./signing";

describe("Nexconn request signing", () => {
  it("matches the documented sha1(AppSecret + Nonce + Timestamp) formula", () => {
    // Independent vector:
    //   node -e "console.log(require('crypto').createHash('sha1')
    //     .update('test-secret' + 'abcdef1234567890ab' + '1408710653491')
    //     .digest('hex'))"
    assert.equal(
      signRequest("test-secret", "abcdef1234567890ab", "1408710653491"),
      "dc1df8b9d6344fd95fcd10dca1c3996c2f510af3",
    );
  });

  it("treats a numeric timestamp the same as its string form", () => {
    assert.equal(
      signRequest("test-secret", "abcdef1234567890ab", 1408710653491),
      signRequest("test-secret", "abcdef1234567890ab", "1408710653491"),
    );
  });

  it("returns a 40-character lowercase hex digest", () => {
    assert.match(signRequest("secret", "nonce", 1), /^[0-9a-f]{40}$/);
  });

  it("creates nonces within the documented length limit", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const nonce = createNonce();
      assert.ok(nonce.length <= MAX_NONCE_LENGTH);
      assert.match(nonce, /^[0-9a-f]+$/);
    }
  });

  it("compares signatures in constant time", () => {
    assert.equal(signaturesMatch("abc", "abc"), true);
    assert.equal(signaturesMatch("abc", "abd"), false);
    assert.equal(signaturesMatch("abc", "ab"), false);
    assert.equal(signaturesMatch("", ""), false);
  });
});
