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

test("getPremiumTriggerContext still detects non-compliance inline notice triggers", () => {
  const block = premiumTriggerContextBlock();
  assert.match(block, /multiple_priorities/);
  assert.match(block, /early_access_ending/);
  assert.match(block, /post_early_access/);
});

test("the remaining non-compliance triggers are rendered as inline notices, not automatic modal opens", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.match(code, /buildPremiumInlineNotice\(premiumTriggerContext,\s*premiumTrigger\)/);
  assert.match(code, /premium_inline_notice/);
  assert.doesNotMatch(code, /openPremiumModal\(premiumTriggerContext\.triggerType\)/);
  assert.doesNotMatch(code, /openPremiumModal\(premiumTrigger\)/);
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

// ---------------------------------------------------------------------
// LOT 10.2E.2A: LOT 10.2C.1 closed the DIRECT "tva_exceeded"/
// "declaration_urgent" auto-triggers, but buildSmartPriorities() still
// pushes a "Déclaration urgente" (actionKey "deadline") and/or "TVA
// dépassée"/"TVA proche du seuil" (actionKey "tva") entry for the exact
// same compliance conditions -- and the "multiple_priorities" trigger
// below counted smartPriorities.length unconditionally, so an urgent
// declaration combined with any other priority could still auto-open
// Premium INDIRECTLY through that trigger. These tests extract the real
// buildSmartPriorities/getPremiumTriggerContext source from App.jsx and
// evaluate it with real fixture inputs (behavioral, not just source-shape
// matching) -- a genuine seam exists here since both functions are pure
// and self-contained, just not separately exported modules.
// ---------------------------------------------------------------------

function buildSmartPrioritiesBlock() {
  return extractBlock("function buildSmartPriorities(computed) {", "\nfunction getEstimatedRate");
}

// premiumTriggerContextBlock() (above) only starts at "function
// getPremiumTriggerContext(" -- it does not include the two new helpers
// declared just before it, which getPremiumTriggerContext's own body now
// calls. This captures those too, so the extracted source is actually
// self-contained and evaluable.
function complianceHelpersBlock() {
  return extractBlock(
    "const COMPLIANCE_ACTION_KEYS = new Set(",
    "\nfunction getPremiumTriggerContext(",
  );
}

function loadCompliancePremiumFunctions() {
  const source = [
    buildSmartPrioritiesBlock(),
    complianceHelpersBlock(),
    premiumTriggerContextBlock(),
    "return { buildSmartPriorities, getPremiumTriggerContext, countNonComplianceSmartPriorities, COMPLIANCE_ACTION_KEYS };",
  ].join("\n");
  return new Function(source)();
}

function urgentDeclarationComputed(overrides = {}) {
  const soon = new Date();
  soon.setDate(soon.getDate() + 1); // 1 day out -- well within the <=2 day "urgent" window
  return { deadlineDate: soon, deadlineLabel: "1 septembre 2026", tvaStatus: null, ...overrides };
}

function overdueDeclarationComputed(overrides = {}) {
  const past = new Date();
  past.setDate(past.getDate() - 3); // already 3 days past due
  return { deadlineDate: past, deadlineLabel: "23 août 2026", tvaStatus: null, ...overrides };
}

test("COMPLIANCE_ACTION_KEYS marks exactly 'deadline' and 'tva' as compliance-derived actionKeys", () => {
  const { COMPLIANCE_ACTION_KEYS } = loadCompliancePremiumFunctions();
  assert.ok(COMPLIANCE_ACTION_KEYS.has("deadline"));
  assert.ok(COMPLIANCE_ACTION_KEYS.has("tva"));
  assert.equal(COMPLIANCE_ACTION_KEYS.size, 2);
});

test("INVARIANT 1: an urgent declaration ALONE never auto-opens Premium", () => {
  const { buildSmartPriorities, getPremiumTriggerContext } = loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities(urgentDeclarationComputed());
  assert.equal(smartPriorities.length, 1);
  assert.equal(smartPriorities[0].actionKey, "deadline");

  const trigger = getPremiumTriggerContext({
    smartPriorities,
    trialDaysLeft: null,
    isEarlyAccessEndingToday: false,
    isPostEarlyAccessTrial: false,
  });
  assert.equal(trigger, null);
});

test("INVARIANT 2: an OVERDUE declaration ALONE never auto-opens Premium", () => {
  const { buildSmartPriorities, getPremiumTriggerContext } = loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities(overdueDeclarationComputed());
  assert.equal(smartPriorities.length, 1);
  assert.equal(smartPriorities[0].actionKey, "deadline");

  const trigger = getPremiumTriggerContext({
    smartPriorities,
    trialDaysLeft: null,
    isEarlyAccessEndingToday: false,
    isPostEarlyAccessTrial: false,
  });
  assert.equal(trigger, null);
});

test("INVARIANT 3: declaration urgency + TVA exceeded (two compliance priorities) still never auto-opens Premium", () => {
  const { buildSmartPriorities, getPremiumTriggerContext } = loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities(
    urgentDeclarationComputed({ tvaStatus: "exceeded" }),
  );
  // Both entries exist and are compliance-derived -- the dashboard still
  // shows both (smartPriorities itself is untouched by the fix).
  assert.equal(smartPriorities.length, 2);
  assert.ok(smartPriorities.every((p) => p.actionKey === "deadline" || p.actionKey === "tva"));

  const trigger = getPremiumTriggerContext({
    smartPriorities,
    trialDaysLeft: null,
    isEarlyAccessEndingToday: false,
    isPostEarlyAccessTrial: false,
  });
  assert.equal(trigger, null);
});

test("THE ORIGINAL LOOPHOLE, closed: declaration urgency + one non-compliance priority reaches length 2 but must NOT auto-open Premium", () => {
  const { buildSmartPriorities, getPremiumTriggerContext } = loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities(
    urgentDeclarationComputed({ recommendedReserve: 10, estimatedAmount: 1000 }),
  );
  // Total length is 2 (this is exactly what used to trigger
  // multiple_priorities before this LOT) -- but only one of the two is
  // non-compliance.
  assert.equal(smartPriorities.length, 2);

  const trigger = getPremiumTriggerContext({
    smartPriorities,
    trialDaysLeft: null,
    isEarlyAccessEndingToday: false,
    isPostEarlyAccessTrial: false,
  });
  assert.equal(trigger, null);
});

test("INVARIANT 4: legitimate non-compliance multiple_priorities behavior is preserved as an inline notice candidate", () => {
  const { buildSmartPriorities, getPremiumTriggerContext } = loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities({
    deadlineDate: null,
    tvaStatus: null,
    recommendedReserve: 10,
    estimatedAmount: 1000, // "Réserve insuffisante" -- actionKey "profile"
    nextDeclarationLabel: "Déclaration trimestrielle", // "Prochaine déclaration" -- actionKey null
  });
  assert.equal(smartPriorities.length, 2);
  assert.ok(smartPriorities.every((p) => p.actionKey !== "deadline" && p.actionKey !== "tva"));

  const trigger = getPremiumTriggerContext({
    smartPriorities,
    trialDaysLeft: null,
    isEarlyAccessEndingToday: false,
    isPostEarlyAccessTrial: false,
  });
  assert.equal(trigger?.triggerType, "multiple_priorities");
});

test("countNonComplianceSmartPriorities never mutates or filters the array it's given -- smartPriorities itself stays intact for the dashboard", () => {
  const { buildSmartPriorities, countNonComplianceSmartPriorities } =
    loadCompliancePremiumFunctions();
  const smartPriorities = buildSmartPriorities(
    urgentDeclarationComputed({ recommendedReserve: 10, estimatedAmount: 1000 }),
  );
  const originalLength = smartPriorities.length;
  const count = countNonComplianceSmartPriorities(smartPriorities);

  assert.equal(count, 1); // only the "profile" entry counts
  assert.equal(smartPriorities.length, originalLength); // untouched, still 2
  assert.ok(smartPriorities.some((p) => p.actionKey === "deadline")); // compliance entry still present
});

test("INVARIANT 5: explicit, user-clicked Premium opening call sites are unchanged", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  // A representative sample of existing onClick-triggered openPremiumModal
  // calls (not the auto-opening useEffect) -- these must still exist
  // verbatim, proving this LOT did not touch explicit user interactions.
  assert.match(code, /onClick=\{\(\) => openPremiumModal\("smart_priorities_lock"\)\}/);
  assert.match(code, /onClick=\{\(\) => openPremiumModal\("early_access_end"\)\}/);
  assert.match(code, /openPremiumModal\("pricing_page"\)/);
});
