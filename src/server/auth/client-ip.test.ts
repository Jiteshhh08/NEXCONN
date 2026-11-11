import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveClientIp } from "./client-ip";

describe("resolveClientIp", () => {
  it("uses a single bare IP", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 1, "203.0.113.7"),
      "203.0.113.7",
    );
  });

  it("uses the client from client, proxy with one trusted hop", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 1, "198.51.100.4, 10.0.0.2"),
      "198.51.100.4",
    );
  });

  it("uses the client from client, proxy1, proxy2 with two trusted hops", () => {
    assert.equal(
      resolveClientIp(
        "x-forwarded-for",
        2,
        "198.51.100.4, 10.0.0.2, 10.0.0.3",
      ),
      "198.51.100.4",
    );
  });

  it("falls back when the chain is shorter than the trusted hops", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 2, "198.51.100.4, 10.0.0.2"),
      null,
    );
  });

  it("falls back when any chain entry is not an IP address", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 1, "not-an-ip, 10.0.0.2"),
      null,
    );
    assert.equal(
      resolveClientIp("x-forwarded-for", 1, "198.51.100.4, not-an-ip"),
      null,
    );
  });

  it("falls back for an invalid hop count", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 0, "198.51.100.4, 10.0.0.2"),
      null,
    );
  });

  it("supports IPv6 addresses", () => {
    assert.equal(
      resolveClientIp("x-forwarded-for", 1, "2001:db8::1, 2001:db8::2"),
      "2001:db8::1",
    );
  });

  it("accepts a single-address header", () => {
    assert.equal(
      resolveClientIp("x-real-ip", 1, "203.0.113.9"),
      "203.0.113.9",
    );
  });

  it("rejects multiple addresses in a single-address header", () => {
    assert.equal(
      resolveClientIp("x-real-ip", 1, "203.0.113.9, 10.0.0.1"),
      null,
    );
  });

  it("rejects an empty or oversized header", () => {
    assert.equal(resolveClientIp("x-forwarded-for", 1, "   "), null);
    assert.equal(resolveClientIp("x-forwarded-for", 1, "1".repeat(1025)), null);
  });
});
