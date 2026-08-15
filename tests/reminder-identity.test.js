import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLogicalDeliveryKey,
  buildProviderIdempotencyKey,
} from "../supabase/functions/send-reminder/reminderIdentity.js";

// UNIT — LOT 7.18/7.20 logical delivery identity. Pure functions of stable
// reminder fields only: no attempt_count, no PII, no "today" dependency.

const REMINDER = {
  id: "931a309f-c7fb-4e5b-8c88-7c99da0dd9ef",
  reminder_type: "declaration",
  reminder_date: "2026-08-23",
};

test("same occurrence -> same logical delivery key, called twice", () => {
  const first = buildLogicalDeliveryKey(REMINDER);
  const second = buildLogicalDeliveryKey(REMINDER);
  assert.equal(first, second);
  assert.equal(first, "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-08-23");
});

test("next occurrence (different reminder_date) -> different key", () => {
  const first = buildLogicalDeliveryKey(REMINDER);
  const next = buildLogicalDeliveryKey({ ...REMINDER, reminder_date: "2026-11-30" });
  assert.notEqual(first, next);
});

test("different reminder_type on the same row id -> different key", () => {
  const declaration = buildLogicalDeliveryKey(REMINDER);
  const tva = buildLogicalDeliveryKey({ ...REMINDER, reminder_type: "tva" });
  assert.notEqual(declaration, tva);
});

test("key never contains attempt_count-shaped input (function has no such parameter)", () => {
  assert.equal(buildLogicalDeliveryKey.length, 1);
});

test("key contains no email/PII markers (only type, uuid, date)", () => {
  const key = buildLogicalDeliveryKey(REMINDER);
  assert.doesNotMatch(key, /@/);
});

test("provider idempotency key: same logical key -> identical key, well under 256 chars", () => {
  const logicalKey = buildLogicalDeliveryKey(REMINDER);
  const a = buildProviderIdempotencyKey(logicalKey);
  const b = buildProviderIdempotencyKey(logicalKey);
  assert.equal(a, b);
  assert.ok(a.length <= 256);
});

test("provider idempotency key: next occurrence -> different key", () => {
  const keyA = buildProviderIdempotencyKey(buildLogicalDeliveryKey(REMINDER));
  const keyB = buildProviderIdempotencyKey(
    buildLogicalDeliveryKey({ ...REMINDER, reminder_date: "2026-11-30" }),
  );
  assert.notEqual(keyA, keyB);
});

test("provider idempotency key is derived only from the logical key (deterministic prefix)", () => {
  const logicalKey = buildLogicalDeliveryKey(REMINDER);
  const idempotencyKey = buildProviderIdempotencyKey(logicalKey);
  assert.ok(idempotencyKey.endsWith(logicalKey));
});
