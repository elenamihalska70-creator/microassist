import test from "node:test";
import assert from "node:assert/strict";
import { isDuplicateSvixIdError } from "../supabase/functions/resend-webhook/duplicateInsertOutcome.js";

// UNIT — LOT 8.13 section 10. A 23505 (unique_violation) on the
// delivery_events insert is svix_id's uniqueness constraint firing --
// the only unique constraint on this table (LOT 8.12) -- and must be
// treated as an idempotent replay (200), not a failure (5xx).

test("Postgres unique_violation (23505) is classified as a duplicate", () => {
  const dbError = { code: "23505", message: 'duplicate key value violates unique constraint "delivery_events_svix_id_unique"' };
  assert.equal(isDuplicateSvixIdError(dbError), true);
});

test("a different Postgres error code is NOT classified as a duplicate", () => {
  const dbError = { code: "23502", message: "null value in column violates not-null constraint" };
  assert.equal(isDuplicateSvixIdError(dbError), false);
});

test("a connection/network-shaped error (no code) is NOT classified as a duplicate", () => {
  assert.equal(isDuplicateSvixIdError({ message: "fetch failed" }), false);
});

test("null/undefined/non-object input is never classified as a duplicate", () => {
  assert.equal(isDuplicateSvixIdError(null), false);
  assert.equal(isDuplicateSvixIdError(undefined), false);
  assert.equal(isDuplicateSvixIdError("some string"), false);
});
