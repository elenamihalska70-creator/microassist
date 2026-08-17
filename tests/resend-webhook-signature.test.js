import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";

// UNIT (SIGNATURE) — LOT 8.13 section 18. Uses the real `svix` npm
// package (devDependency, pinned to 1.99.1 -- the exact version pinned
// in index.ts's Deno esm.sh import) to prove the sign/verify contract
// index.ts relies on, not a mock of it. This does not execute index.ts
// itself (Deno-only APIs, see resend-webhook-wiring.test.js's documented
// limitation) -- it proves the underlying verification primitive behaves
// as index.ts assumes: valid signatures verify, tampering/wrong-secret/
// missing-headers do not.

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function signPayload(secret, id, payload, timestampDate = new Date()) {
  const wh = new Webhook(secret);
  const signature = wh.sign(id, timestampDate, payload);
  const timestamp = Math.floor(timestampDate.getTime() / 1000).toString();
  return { headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature }, payload };
}

test("valid signature verifies and returns the parsed payload", () => {
  const payload = JSON.stringify({
    type: "email.delivered",
    created_at: "2026-08-17T08:00:00.000Z",
    data: { email_id: "56761188-7520-42d8-8898-ff6fc54ce618" },
  });
  const { headers } = signPayload(SECRET, "msg_valid_1", payload);
  const wh = new Webhook(SECRET);
  const verified = wh.verify(payload, headers);
  assert.equal(verified.type, "email.delivered");
  assert.equal(verified.data.email_id, "56761188-7520-42d8-8898-ff6fc54ce618");
});

test("wrong secret is rejected", () => {
  const payload = JSON.stringify({ type: "email.sent", created_at: "2026-08-17T08:00:00.000Z", data: {} });
  const { headers } = signPayload(SECRET, "msg_wrong_secret", payload);
  const wrongWh = new Webhook("whsec_completelyDifferentSecretValueXX");
  assert.throws(() => wrongWh.verify(payload, headers));
});

test("tampered body (payload changed after signing) is rejected", () => {
  const originalPayload = JSON.stringify({ type: "email.sent", created_at: "2026-08-17T08:00:00.000Z", data: { email_id: "abc" } });
  const { headers } = signPayload(SECRET, "msg_tampered", originalPayload);
  const tamperedPayload = JSON.stringify({ type: "email.sent", created_at: "2026-08-17T08:00:00.000Z", data: { email_id: "ATTACKER-CONTROLLED" } });
  const wh = new Webhook(SECRET);
  assert.throws(() => wh.verify(tamperedPayload, headers));
});

test("tampered signature header is rejected", () => {
  const payload = JSON.stringify({ type: "email.bounced", created_at: "2026-08-17T08:00:00.000Z", data: {} });
  const { headers } = signPayload(SECRET, "msg_tampered_sig", payload);
  const wh = new Webhook(SECRET);
  const badHeaders = { ...headers, "svix-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" };
  assert.throws(() => wh.verify(payload, badHeaders));
});

test("missing svix-signature header is rejected by the library itself", () => {
  const payload = JSON.stringify({ type: "email.sent", created_at: "2026-08-17T08:00:00.000Z", data: {} });
  const { headers } = signPayload(SECRET, "msg_missing_sig", payload);
  const wh = new Webhook(SECRET);
  const { "svix-signature": _dropped, ...incompleteHeaders } = headers;
  assert.throws(() => wh.verify(payload, incompleteHeaders));
});

test("stale timestamp far outside the tolerance window is rejected (replay protection)", () => {
  const payload = JSON.stringify({ type: "email.sent", created_at: "2026-08-17T08:00:00.000Z", data: {} });
  const ancientDate = new Date("2020-01-01T00:00:00.000Z");
  const { headers } = signPayload(SECRET, "msg_stale", payload, ancientDate);
  const wh = new Webhook(SECRET);
  assert.throws(() => wh.verify(payload, headers));
});
