import test from "node:test";
import assert from "node:assert/strict";
import { hasDurableAcceptedOutcome } from "../supabase/functions/send-reminder/reminderReplay.js";

// UNIT — LOT 7.22 replay-safety decision. A reclaim must not trigger a
// second provider call when a prior attempt's outcome was already durably
// persisted as "accepted" for this exact logical delivery (Phase A
// succeeded, Phase B/finalize did not).

const LOGICAL_KEY = "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-08-23";

test("accepted outcome for the same logical delivery -> true (skip provider call)", () => {
  const metadata = { provider_status: "accepted", logical_delivery_key: LOGICAL_KEY };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), true);
});

test("no prior metadata (first-ever attempt) -> false", () => {
  assert.equal(hasDurableAcceptedOutcome({}, LOGICAL_KEY), false);
  assert.equal(hasDurableAcceptedOutcome(null, LOGICAL_KEY), false);
});

test("failed/unknown/conflict/concurrent outcomes -> false (must retry provider)", () => {
  for (const providerStatus of ["failed", "unknown", "conflict", "concurrent"]) {
    const metadata = { provider_status: providerStatus, logical_delivery_key: LOGICAL_KEY };
    assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
  }
});

test("accepted outcome recorded under a DIFFERENT logical delivery key -> false", () => {
  const metadata = {
    provider_status: "accepted",
    logical_delivery_key: "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-09-23",
  };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
});

test("accepted outcome with missing logical_delivery_key -> false (fail closed, not open)", () => {
  const metadata = { provider_status: "accepted" };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
});

test("non-object metadata -> false, does not throw", () => {
  assert.equal(hasDurableAcceptedOutcome("accepted", LOGICAL_KEY), false);
  assert.equal(hasDurableAcceptedOutcome(42, LOGICAL_KEY), false);
});
