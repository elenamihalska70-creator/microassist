import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 10.2C.1: J-7/J-2 declaration-reminder email release-safety lock-in.
//
// Finding: sendTrialEndingEmail (the function these useEffects call) was
// hardened in an earlier, unrelated LOT for the trial-lifecycle-email flow
// -- it takes NO parameters and POSTs only an Authorization bearer token,
// no body. The Edge Function (supabase/functions/send-trial-ending-email)
// derives its own event type solely from the caller's profiles.trial_ends_at
// row; it has no concept of a declaration deadline. This means the
// declaration-specific payload these useEffects build (eventType, subject,
// html, text, declarationDate) is discarded before it ever reaches the
// network -- this pathway CANNOT send a declaration-reminder email under
// any circumstance today, regardless of how often shouldSendDeclarationReminderJ7/
// J2 return true. The actual risk was therefore never "duplicate/spam
// declaration emails" -- it was misleading, non-functional code that looks
// live (feature-flagged per tier, logs "success") but isn't. Disabled via
// DECLARATION_REMINDER_EMAILS_ENABLED until a dedicated, purpose-built,
// secured declaration-email endpoint exists.
//
// None of the functions under test here are exported from src/App.jsx (a
// React component file, not a plain module), so -- following this repo's
// existing convention for App.jsx-internal logic -- this is a static
// source-text lock-in rather than a live import.

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

function sourceWithoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

const CODE = sourceWithoutComments(APP_SOURCE);

test("sendTrialEndingEmail ignores its caller-supplied argument (the root cause: declaration payloads are built, then discarded)", () => {
  const block = extractBlock(
    "const sendTrialEndingEmail = useCallback(",
    "\n  // Effective plan is the only plan used by UI limits and premium guards.",
  );
  // The callback body takes no parameters and sends no request body.
  assert.match(block, /async \(\)\s*=>\s*\{/);
  assert.doesNotMatch(block, /body:\s*JSON\.stringify/);
});

test("DECLARATION_REMINDER_EMAILS_ENABLED exists and defaults to disabled", () => {
  assert.match(CODE, /const DECLARATION_REMINDER_EMAILS_ENABLED = false;/);
});

test("both the J-7 and J-2 declaration reminder effects are gated behind the master disable flag", () => {
  const j7Block = extractBlock(
    'useEffect(() => {\n    if (!DECLARATION_REMINDER_EMAILS_ENABLED) return;\n    const nextDeclarationDate = computed?.deadlineDate;\n\n    if (!user?.id || !user?.email) return;\n    if (accessProfile?.features?.declaration_email_j7',
    "[declaration-email-j7] error",
  );
  assert.match(j7Block, /if \(!DECLARATION_REMINDER_EMAILS_ENABLED\) return;/);

  const j2Block = extractBlock(
    'useEffect(() => {\n    if (!DECLARATION_REMINDER_EMAILS_ENABLED) return;\n    const nextDeclarationDate = computed?.deadlineDate;\n\n    if (!user?.id || !user?.email) return;\n    if (accessProfile?.features?.declaration_email_j2',
    "[declaration-email-j2] error",
  );
  assert.match(j2Block, /if \(!DECLARATION_REMINDER_EMAILS_ENABLED\) return;/);
});

test("tier gating (declaration_email_j7/j2 feature flags) is still present underneath the master disable", () => {
  assert.match(CODE, /accessProfile\?\.features\?\.declaration_email_j7 !== true/);
  assert.match(CODE, /accessProfile\?\.features\?\.declaration_email_j2 !== true/);
});

// ---------------------------------------------------------------------
// Documents the eligibility-window and dedup-key characteristics of the
// existing (disabled) wiring, for whoever builds a real endpoint later.
// ---------------------------------------------------------------------

test("J-7 eligibility is an 8-day-wide window (0 through 7 days out), not a single exact day", () => {
  const block = extractBlock("function shouldSendDeclarationReminderJ7(", "\nfunction formatDeclarationDeadlineLabel");
  assert.match(block, /return diffDays >= 0 && diffDays <= 7;/);
});

test("J-2 eligibility is a single exact day (diffDays === 2), narrower than J-7's window", () => {
  const block = extractBlock("function shouldSendDeclarationReminderJ2(", "\nfunction shouldSendDeclarationReminderJ7");
  assert.match(block, /return diffDays === 2;/);
});

test("the client-side dedup key is scoped only to eventType + userId -- NOT to the specific declaration period", () => {
  // getEmailEventStorageKey(eventType, userId) has no period/deadline
  // parameter, so re-enabling this pathway as-is would let the 24h rolling
  // cooldown expire and re-fire within the same 8-day J-7 window, or across
  // two genuinely different declaration periods indistinguishably. This is
  // an architectural gap to close (e.g. include the deadline's ISO date in
  // the key) before DECLARATION_REMINDER_EMAILS_ENABLED is ever flipped on.
  const block = extractBlock(
    "function getEmailEventStorageKey(",
    "\nfunction wasEmailEventHandledRecently",
  );
  assert.match(block, /return `\$\{EMAIL_EVENT_KEY_PREFIX\}\$\{eventType\}_\$\{userId\}`;/);
  assert.doesNotMatch(block, /deadline|period/i);
});

test("the client-side dedup cooldown (24h) is narrower than the 8-day J-7 window, confirming repeat-send potential if ever re-enabled unmodified", () => {
  const block = extractBlock(
    "function wasEmailEventHandledRecently(",
    "\nfunction markEmailEventHandled",
  );
  assert.match(block, /cooldownMs = 24 \* 60 \* 60 \* 1000/);
});
