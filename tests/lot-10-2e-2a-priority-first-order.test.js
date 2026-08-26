import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 10.2E.2A: the canonical PriorityCard must render BEFORE every
// marketing/discovery/Premium surface identified in the LOT 10.2E.2
// analysis -- JSX ORDER, not just CSS positioning, since a crawler/
// screen-reader/reduced-motion user and the actual DOM mount order all
// follow render order, not visual layout. These tests lock in the JSX
// text order in App.jsx directly (the same "source-shape" convention
// already used for App.jsx-internal structure elsewhere in this repo,
// e.g. tests/lot-10-2c-1-premium-compliance-safety.test.js) rather than
// relying on a live render or on stylesheet rules.

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

// Scope to the TOP of the authenticated dashboard's own JSX branch
// (appView === "dashboard") -- a bounded window comfortably larger than
// the above-the-fold block under test, so a marker string that
// coincidentally also appears elsewhere in this 16k-line file (e.g. in an
// unrelated modal much further down) can never produce a false pass/fail
// here.
const DASHBOARD_TOP_WINDOW_CHARS = 9000;

function dashboardBranchSource() {
  const start = APP_SOURCE.indexOf('appView === "dashboard" ? (');
  assert.notEqual(start, -1, "dashboard branch start not found");
  return APP_SOURCE.slice(start, start + DASHBOARD_TOP_WINDOW_CHARS);
}

function indexOfOrFail(source, marker, label) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Marker not found in dashboard branch: ${label} ("${marker}")`);
  return index;
}

test("PriorityCard renders before the founder banner", () => {
  const source = dashboardBranchSource();
  const priorityCardIndex = indexOfOrFail(source, "<PriorityCard", "PriorityCard");
  const founderBannerIndex = indexOfOrFail(source, "dashboardFounderBanner", "founder banner");
  assert.ok(
    priorityCardIndex < founderBannerIndex,
    "PriorityCard must render before the founder banner",
  );
});

test("PriorityCard renders before the discovery-mode banner stack", () => {
  const source = dashboardBranchSource();
  const priorityCardIndex = indexOfOrFail(source, "<PriorityCard", "PriorityCard");
  const discoveryBannerIndex = indexOfOrFail(source, '"discoveryBanner"', "discovery banner");
  assert.ok(
    priorityCardIndex < discoveryBannerIndex,
    "PriorityCard must render before the discovery banner stack",
  );
});

test("PriorityCard renders before the inline Premium promotional banner (premiumBannerContent)", () => {
  const source = dashboardBranchSource();
  const priorityCardIndex = indexOfOrFail(source, "<PriorityCard", "PriorityCard");
  const premiumBannerIndex = indexOfOrFail(
    source,
    "premiumBannerContent.line1",
    "inline Premium banner",
  );
  assert.ok(
    priorityCardIndex < premiumBannerIndex,
    "PriorityCard must render before the inline Premium promotional banner",
  );
});

test("PriorityCard still renders before the legacy 'Action prioritaire' hero (unmoved, unremoved this LOT)", () => {
  const source = dashboardBranchSource();
  const priorityCardIndex = indexOfOrFail(source, "<PriorityCard", "PriorityCard");
  const legacyHeroIndex = indexOfOrFail(source, "dashboardCockpit", "legacy hero");
  assert.ok(
    priorityCardIndex < legacyHeroIndex,
    "PriorityCard must remain before the (still-present) legacy hero",
  );
});

test("the page heading ('Mon espace fiscal') still renders before PriorityCard, preserving heading context", () => {
  const source = dashboardBranchSource();
  const headingIndex = indexOfOrFail(source, "Mon espace fiscal", "page heading");
  const priorityCardIndex = indexOfOrFail(source, "<PriorityCard", "PriorityCard");
  assert.ok(headingIndex < priorityCardIndex, "the page heading must precede PriorityCard");
});

test("ADDITIVE: none of the moved surfaces were deleted -- founder banner, all 4 discovery-banner variants, and the inline Premium banner are all still present", () => {
  const source = dashboardBranchSource();
  assert.match(source, /Offre fondateur/);
  assert.match(source, /Session temporaire/); // guest discovery variant
  assert.match(source, /Ton mode découverte se termine aujourd’hui/); // early_access_ending variant
  assert.match(source, /Mode découverte activé/); // isEarlyFullAccess variant
  assert.match(source, /Certaines fonctionnalités sont maintenant en Premium/); // post_early_access variant
  assert.match(source, /premiumBannerButtonLabel/); // inline Premium banner CTA
});

test("ADDITIVE: none of the moved surfaces' eligibility/gating conditions were changed", () => {
  const source = dashboardBranchSource();
  assert.match(source, /\{isFounder && \(/);
  assert.match(source, /!isPremiumUser && isGuest \? \(/);
  assert.match(source, /!isPremiumUser && isEarlyAccessEndingToday \? \(/);
  assert.match(source, /!isPremiumUser && isEarlyFullAccess \? \(/);
  assert.match(source, /!isPremiumUser && isPostEarlyAccessTrial \? \(/);
});

test("PriorityCard is still gated the same way as before (hasProfileCore || simpleAssistantProfile) -- gating logic unchanged, only position moved", () => {
  const source = dashboardBranchSource();
  const priorityCardBlockStart = source.lastIndexOf(
    "(hasProfileCore || simpleAssistantProfile) && priorityCardViewModel",
  );
  assert.notEqual(priorityCardBlockStart, -1);
});
