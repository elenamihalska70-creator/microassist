import test from "node:test";
import assert from "node:assert/strict";
import { extractSvixHeaders } from "../supabase/functions/resend-webhook/webhookHeaders.js";

// UNIT — LOT 8.13 section 4/7. Missing any one of the three required
// Svix headers must reject before signature verification is even
// attempted (index.ts checks this before calling Webhook.verify).

test("extracts all three headers from a Fetch-API-shaped Headers-like object", () => {
  const headers = new Map([
    ["svix-id", "msg_p5jXN8AQM9LWM0D4loKWxJek"],
    ["svix-timestamp", "1614265330"],
    ["svix-signature", "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="],
  ]);
  const headersLike = { get: (name) => headers.get(name) ?? null };
  assert.deepEqual(extractSvixHeaders(headersLike), {
    svixId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
    svixTimestamp: "1614265330",
    svixSignature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
  });
});

test("extracts all three headers from a plain object (test-friendly fallback)", () => {
  const result = extractSvixHeaders({
    "svix-id": "msg_1",
    "svix-timestamp": "1700000000",
    "svix-signature": "v1,abc=",
  });
  assert.deepEqual(result, { svixId: "msg_1", svixTimestamp: "1700000000", svixSignature: "v1,abc=" });
});

test("missing svix-id -> null", () => {
  const result = extractSvixHeaders({ "svix-timestamp": "1700000000", "svix-signature": "v1,abc=" });
  assert.equal(result, null);
});

test("missing svix-timestamp -> null", () => {
  const result = extractSvixHeaders({ "svix-id": "msg_1", "svix-signature": "v1,abc=" });
  assert.equal(result, null);
});

test("missing svix-signature -> null", () => {
  const result = extractSvixHeaders({ "svix-id": "msg_1", "svix-timestamp": "1700000000" });
  assert.equal(result, null);
});

test("empty-string header value is treated as missing, not a valid header", () => {
  const result = extractSvixHeaders({ "svix-id": "", "svix-timestamp": "1700000000", "svix-signature": "v1,abc=" });
  assert.equal(result, null);
});

test("no headers at all -> null, does not throw", () => {
  assert.equal(extractSvixHeaders({}), null);
  assert.doesNotThrow(() => extractSvixHeaders(null));
  assert.equal(extractSvixHeaders(null), null);
  assert.doesNotThrow(() => extractSvixHeaders(undefined));
});
