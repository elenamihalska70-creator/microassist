import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 10.2C.1: a legal/fiscal compliance deadline must never be used as a
// pressure mechanism for monetization. LOT 10.2C made the declaration
// deadline engine's DUE_SOON/DUE/OVERDUE states reachable for the first
// time through real dates -- which also made two previously-dead Premium
// auto-trigger branches ("tva_exceeded", "declaration_urgent" in
// getPremiumTriggerContext, App.jsx) reachable for the first time. This
// file locks in that those two branches are gone, that the OTHER
// (non-compliance) Premium triggers are untouched, and that the raw
// compliance information keeps rendering unconditionally on the dashboard
// regardless of Premium tier.
//
// getPremiumTriggerContext is a top-level function inside src/App.jsx (not
// a separately importable module), so -- following this repo's existing
// convention for App.jsx-internal logic (see tests/lot-5-91-*.test.js and
// siblings) -- this is a static source-text lock-in rather than a live
// import.

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

function premiumTriggerContextBlock() {
  return sourceWithoutComments(
    extractBlock("function getPremiumTriggerContext(", "\nfunction shouldSendTrialEndingEmail"),
  );
}

test("getPremiumTriggerContext no longer returns a trigger for an exceeded TVA threshold", () => {
  const block = premiumTriggerContextBlock();
  assert.doesNotMatch(block, /tva_exceeded/);
  assert.doesNotMatch(block, /computed\?\.tvaStatus/);
});

test("getPremiumTriggerContext no longer returns a trigger for an approaching declaration deadline", () => {
  const block = premiumTriggerContextBlock();
  assert.doesNotMatch(block, /declaration_urgent/);
  assert.doesNotMatch(block, /computed\?\.deadlineDate/);
});

test("getPremiumTriggerContext no longer reads `computed` at all -- it has no compliance-urgency inputs left", () => {
  const block = premiumTriggerContextBlock();
  assert.doesNotMatch(block, /\bcomputed\b/);
});

test("getPremiumTriggerContext's non-compliance engagement triggers are untouched", () => {
  const block = premiumTriggerContextBlock();
  assert.match(block, /multiple_priorities/);
  assert.match(block, /early_access_ending/);
  assert.match(block, /post_early_access/);
});

test("the auto-opening Premium modal effect still exists for the remaining (non-compliance) triggers", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.match(code, /openPremiumModal\(premiumTriggerContext\.triggerType\)/);
});

test("the 'Repères fiscaux' dashboard section (the compliance action's own surface) renders unconditionally, not behind a Premium/tier gate", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const marker = code.indexOf('<div className="fiscalTimeline">');
  assert.notEqual(marker, -1, "fiscalTimeline section not found");

  // The 300 characters immediately before the section must not contain a
  // truthiness gate keyed on Premium/billing/access state -- i.e. it is not
  // wrapped in `{somePremiumFlag && ( ... <div className="fiscalTimeline">`.
  const precedingText = code.slice(Math.max(0, marker - 300), marker);
  assert.doesNotMatch(precedingText, /hasPremiumLikeAccess/);
  assert.doesNotMatch(precedingText, /billingUiState\s*===\s*["']premium/);
  assert.doesNotMatch(precedingText, /accessProfile\??\.features/);
});

test("premium_active and guest users are exempt from ANY auto-trigger (unchanged, pre-existing guard)", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.match(
    code,
    /if \(billingUiState === "guest" \|\| billingUiState === "premium_active"\) \{\s*return;\s*\}/,
  );
});
