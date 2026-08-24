import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 10.1G section 9. src/App.jsx has no Node test
// harness (16k-line JSX monolith, longstanding documented gap, see
// tests/lot-5-*.test.js and tests/acre-reform-2026-07.test.js for the
// same source-inspection pattern used throughout this repo) -- these
// assert against the shipped source text.
//
// IMPORTANT DISCOVERY (LOT 10.1G): sendTrialEndingEmail is a shared,
// misleadingly-named helper also reused, unmodified by this LOT, by two
// entirely unrelated flows -- declaration_j7/declaration_j2 reminder
// emails and smart_priority_high emails -- neither of which is a trial
// lifecycle event. Those two flows still call
// sendTrialEndingEmail(requestBody) with their own subject/html/text,
// which the hardened callback now silently ignores (no body is ever
// sent). This is a real, pre-existing entanglement this LOT's security
// fix could not avoid touching (the arbitrary-content vulnerability
// closed in index.ts is endpoint-wide, not trial-event-specific -- a
// partial fix would still leave it exploitable), reported prominently in
// the final report rather than silently left alone or silently "fixed"
// under this LOT's stated trial-only scope. It is currently inert only
// because TRIAL_EMAILS_ENABLED stays disabled throughout this LOT.

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("sendTrialEndingEmail no longer uses the anon key as its Authorization credential", () => {
  const fnIndex = APP_SOURCE.indexOf("const sendTrialEndingEmail = useCallback(");
  assert.ok(fnIndex > -1);
  const block = APP_SOURCE.slice(fnIndex, fnIndex + 1200);
  assert.doesNotMatch(block, /VITE_SUPABASE_ANON_KEY/);
  assert.match(block, /supabase\.auth\.getSession\(\)/);
  assert.match(block, /Authorization: `Bearer \$\{accessToken\}`/);
});

test("sendTrialEndingEmail sends no request body -- the server derives everything it needs from the verified session", () => {
  const fnIndex = APP_SOURCE.indexOf("const sendTrialEndingEmail = useCallback(");
  const nextFnIndex = APP_SOURCE.indexOf("useCallback(", fnIndex + 40);
  const block = APP_SOURCE.slice(fnIndex, nextFnIndex > -1 ? nextFnIndex : fnIndex + 1500);
  assert.doesNotMatch(block, /body:\s*JSON\.stringify/);
});

test("the three genuine trial-lifecycle trigger effects call sendTrialEndingEmail with no arguments and no longer build a client-side email payload", () => {
  const trialLogPrefixes = ["[trial-email-send]", "[trial-email-send-j2]", "[trial-email-expired]"];
  for (const prefix of trialLogPrefixes) {
    const anchorIndex = APP_SOURCE.indexOf(prefix);
    assert.ok(anchorIndex > -1, `expected to find the ${prefix} trigger effect`);

    const callIndex = APP_SOURCE.indexOf("await sendTrialEndingEmail(", anchorIndex);
    assert.ok(callIndex > -1, `expected a sendTrialEndingEmail call following ${prefix}`);
    const callEnd = APP_SOURCE.indexOf(")", callIndex);
    const args = APP_SOURCE.slice(callIndex + "await sendTrialEndingEmail(".length, callEnd).trim();
    assert.equal(args, "", `${prefix}'s sendTrialEndingEmail call must take no arguments`);
  }

  assert.doesNotMatch(APP_SOURCE, /buildTrialEndingEmailPayload\(/);
  assert.doesNotMatch(APP_SOURCE, /buildTrialEndingEmailPayloadJ2\(/);
  assert.doesNotMatch(APP_SOURCE, /buildTrialExpiredEmailPayload\(/);
});

test("DISCOVERY: declaration reminder and smart-priority emails still route through the same shared helper with their own payload -- documented, not silently hidden", () => {
  // These are genuinely unrelated features (not trial lifecycle events)
  // that happen to share sendTrialEndingEmail/send-trial-ending-email.
  // This assertion exists so the entanglement stays visible in the test
  // suite rather than being an undocumented surprise -- see LOT 10.1G
  // report for the full explanation and required follow-up.
  assert.match(APP_SOURCE, /buildDeclarationReminderEmailPayloadJ7\(/);
  assert.match(APP_SOURCE, /buildDeclarationReminderEmailPayloadJ2\(/);
  assert.match(APP_SOURCE, /buildSmartPriorityEmailPayload\(/);
  assert.match(APP_SOURCE, /await sendTrialEndingEmail\(requestBody\)/);
});

test("client-side localStorage cooldown remains as a UX optimization, not the source of correctness", () => {
  assert.match(APP_SOURCE, /function wasEmailEventHandledRecently/);
  assert.match(APP_SOURCE, /function markEmailEventHandled/);
});
