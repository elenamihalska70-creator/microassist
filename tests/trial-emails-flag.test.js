import test from "node:test";
import assert from "node:assert/strict";
import { isTrialEmailsEnabled } from "../supabase/functions/send-trial-ending-email/trialEmailsFlag.js";

// UNIT — LOT 9.2 section 3/7 (A/B/C). Fail-closed: only the exact string
// "true" enables sending.

test("flag missing (undefined) -> disabled", () => {
  assert.equal(isTrialEmailsEnabled(undefined), false);
});

test("flag null -> disabled", () => {
  assert.equal(isTrialEmailsEnabled(null), false);
});

test("flag explicit 'false' -> disabled", () => {
  assert.equal(isTrialEmailsEnabled("false"), false);
});

test("flag exact string 'true' -> enabled", () => {
  assert.equal(isTrialEmailsEnabled("true"), true);
});

test("flag is fail-closed against near-miss values -- case, whitespace, truthy-looking strings, empty string, boolean true", () => {
  const nearMisses = ["True", "TRUE", " true", "true ", "1", "yes", "on", "", true];
  for (const value of nearMisses) {
    assert.equal(isTrialEmailsEnabled(value), false, `expected disabled for ${JSON.stringify(value)}`);
  }
});
