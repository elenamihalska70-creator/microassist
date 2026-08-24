import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { computeObligations } from "../src/utils/obligations.js";
import { ACRE_REFORM_EFFECTIVE_DATE, getAcreRule } from "../src/domain/rules/acreRules.js";

// LOT 10.1B: owner-verified URSSAF ACRE reform, effective 2026-07-01.
// Businesses created before that date keep the historical 50%-of-normal
// rate; businesses created on/after that date pay 75% of the normal rate
// (a 25% exemption). This file exercises the exact scenario matrix required
// by LOT 10.1B section 7, through computeObligations (the single canonical
// path both the dashboard and, since this LOT, the onboarding estimate call).

const ACTIVITIES = [
  { activityType: "services", baseRate: 0.22 },
  { activityType: "commerce", baseRate: 0.123 },
  { activityType: "mixte", baseRate: 0.18 },
];

const PRE_REFORM_START = "2020-01-01";
const POST_REFORM_START_EXACT = "2026-07-01";
const POST_REFORM_START_LATER = "2026-09-15";

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ACRE's 12-month active window is anchored to acre_start_date and evaluated
// against the real current date (computeObligations always uses `new Date()`
// as its reference date, it accepts no injected "today"). A fixed historical
// acre_start_date would read as expired once enough real time has passed, so
// "still active" scenarios anchor it a couple of months before whenever this
// suite actually runs, independently of business_start_date (which only
// needs to sit on the correct side of the regime cutover, not be recent).
function monthsAgo(monthCount) {
  const today = new Date();
  const date = new Date(today);
  date.setMonth(date.getMonth() - monthCount);
  return dateOnly(date);
}

const RECENT_ACRE_START = monthsAgo(2);

test("cutover date matches the owner-verified rule", () => {
  assert.equal(ACRE_REFORM_EFFECTIVE_DATE, "2026-07-01");
});

for (const { activityType, baseRate } of ACTIVITIES) {
  test(`${activityType} without ACRE uses the full base rate`, () => {
    const result = computeObligations({
      ca_month: 1000,
      activity_type: activityType,
      acre: "no",
    });

    assert.equal(result.rate, baseRate);
    assert.equal(result.acreActive, false);
    assert.equal(result.estimatedAmount, Math.round(1000 * baseRate));
  });

  test(`${activityType} with ACRE, creation before 2026-07-01, applies the pre-reform 50% reduction`, () => {
    const result = computeObligations({
      ca_month: 1000,
      activity_type: activityType,
      acre: "yes",
      acre_start_date: RECENT_ACRE_START,
      business_start_date: PRE_REFORM_START,
    });

    assert.equal(result.acreActive, true);
    assert.equal(result.acreStatus, "active");
    assert.equal(result.rate, baseRate * 0.5);
    assert.equal(result.estimatedAmount, Math.round(1000 * baseRate * 0.5));
  });

  test(`${activityType} with ACRE, creation on 2026-07-01, applies the post-reform 75%-of-normal rate`, () => {
    const result = computeObligations({
      ca_month: 1000,
      activity_type: activityType,
      acre: "yes",
      acre_start_date: POST_REFORM_START_EXACT,
      business_start_date: POST_REFORM_START_EXACT,
    });

    assert.equal(result.acreActive, true);
    assert.equal(result.acreStatus, "active");
    assert.equal(result.rate, baseRate * 0.75);
    assert.equal(result.estimatedAmount, Math.round(1000 * baseRate * 0.75));
  });
}

test("creation after 2026-07-01 also uses the post-reform rate", () => {
  const result = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: POST_REFORM_START_LATER,
    business_start_date: POST_REFORM_START_LATER,
  });

  assert.equal(result.rate, 0.22 * 0.75);
  assert.equal(result.acreStatus, "active");
});

test("ACRE expired reverts to the full base rate regardless of regime", () => {
  const longExpiredAcreStart = monthsAgo(13);
  const preReformExpired = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: longExpiredAcreStart,
    business_start_date: "2019-01-01",
  });
  // Post-reform duration depends only on business_start_date (LOT 10.1C),
  // never on acre_start_date -- so expiry here is driven by a business
  // creation date whose quarter-based window has already closed.
  const postReformExpired = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: longExpiredAcreStart,
    business_start_date: "2024-01-15",
  });

  assert.equal(preReformExpired.acreStatus, "expired");
  assert.equal(preReformExpired.acreActive, false);
  assert.equal(preReformExpired.rate, 0.22);

  assert.equal(postReformExpired.acreStatus, "expired");
  assert.equal(postReformExpired.acreActive, false);
  assert.equal(postReformExpired.rate, 0.22);
});

test("ACRE inactive (acre=no) never applies a reduction even with dates present", () => {
  const result = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "no",
    acre_start_date: PRE_REFORM_START,
    business_start_date: PRE_REFORM_START,
  });

  assert.equal(result.acreActive, false);
  assert.equal(result.rate, 0.22);
});

test("missing business_start_date never guesses a regime: full rate applied, status flagged", () => {
  const result = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: "2026-01-01",
  });

  assert.equal(result.acreStatus, "regime_unknown");
  assert.equal(result.acreActive, false);
  assert.equal(result.rate, 0.22);
  assert.equal(result.estimatedAmount, 220);
});

test("LOT 10.1C: regime_unknown is visibly explained on the dashboard-facing label, not just in the PDF export", () => {
  const result = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: "2026-01-01",
  });

  assert.match(result.amountEstimatedLabel, /complète ta date de création/);
});

test("invalid business_start_date never guesses a regime: full rate applied, status flagged", () => {
  const result = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    acre_start_date: "2026-01-01",
    business_start_date: "not-a-real-date",
  });

  assert.equal(result.acreStatus, "regime_unknown");
  assert.equal(result.acreActive, false);
  assert.equal(result.rate, 0.22);
});

test("zero revenue with active ACRE stays zero regardless of regime", () => {
  const result = computeObligations({
    ca_month: 0,
    activity_type: "services",
    acre: "yes",
    acre_start_date: RECENT_ACRE_START,
    business_start_date: PRE_REFORM_START,
  });

  assert.equal(result.estimatedAmount, 0);
  assert.equal(result.acreActive, true);
});

test("an already-aggregated multi-revenue monthly total is treated like any other ca_month", () => {
  const individualEntries = [420.5, 310.25, 89.25];
  const aggregatedCaMonth = individualEntries.reduce((sum, value) => sum + value, 0);
  const result = computeObligations({
    ca_month: aggregatedCaMonth,
    activity_type: "commerce",
    acre: "yes",
    acre_start_date: POST_REFORM_START_EXACT,
    business_start_date: POST_REFORM_START_EXACT,
  });

  assert.equal(aggregatedCaMonth, 820);
  assert.equal(result.rate, 0.123 * 0.75);
  assert.equal(result.estimatedAmount, Math.round(820 * 0.123 * 0.75));
});

test("rounding matches Math.round at a non-trivial boundary", () => {
  const result = computeObligations({
    ca_month: 733,
    activity_type: "services",
    acre: "yes",
    acre_start_date: POST_REFORM_START_EXACT,
    business_start_date: POST_REFORM_START_EXACT,
  });
  const expectedRaw = 733 * 0.22 * 0.75;

  assert.equal(result.estimatedAmount, Math.round(expectedRaw));
  assert.notEqual(result.estimatedAmount, expectedRaw);
});

// --- Onboarding / dashboard parity -----------------------------------------
//
// buildSimpleAssistantGuidance lives inside src/App.jsx, a React component
// file that this test suite has no JSX execution harness for (consistent
// with every other App.jsx-touching test in this repo, e.g.
// lot-5-91-obsolete-savingsgoal-root-removal.test.js, which also verifies
// App.jsx internals via source inspection rather than by importing and
// calling them). Parity is therefore proven structurally: the onboarding
// path must no longer own an independent rate table, and must delegate to
// the exact same computeObligations() the dashboard calls, passing the same
// ACRE/date fields. Combined with the exhaustive computeObligations coverage
// above, this establishes that the two screens cannot disagree, because
// they are the same call.
test("onboarding guidance no longer owns an independent contribution rate table", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  assert.equal(source.includes("getSimpleChargeRate"), false);
  assert.equal(/SIMPLE_ASSISTANT_CONTRIBUTION_PERCENTAGES/.test(source), false);

  const guidanceStart = source.indexOf("function buildSimpleAssistantGuidance");
  assert.ok(guidanceStart >= 0, "buildSimpleAssistantGuidance must still exist in App.jsx");

  const guidanceBody = source.slice(guidanceStart, guidanceStart + 1800);

  assert.match(guidanceBody, /computeObligations\(/);
  assert.match(guidanceBody, /activity_type:\s*profile\.activity_type/);
  assert.match(guidanceBody, /acre:\s*profile\.acre/);
  assert.match(guidanceBody, /acre_start_date:\s*profile\.acre_start_date/);
  assert.match(guidanceBody, /business_start_date:\s*profile\.business_start_date/);
});

test("the onboarding starter profile now carries the ACRE/date fields the dashboard already reads", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const profileStart = source.indexOf("const unifiedStarterProfile = useMemo(");
  assert.ok(profileStart >= 0, "unifiedStarterProfile must still exist in App.jsx");

  const profileBody = source.slice(profileStart, profileStart + 1200);

  assert.match(profileBody, /acre:\s*dashboardAnswers\?\.acre/);
  assert.match(profileBody, /acre_start_date:\s*dashboardAnswers\?\.acre_start_date/);
  assert.match(profileBody, /business_start_date:\s*dashboardAnswers\?\.business_start_date/);
});

// --- Post-reform duration: official URSSAF examples (LOT 10.1C) -----------
//
// The post-reform reduced-rate window is NOT a flat 12 months from any date.
// It runs through the end of the calendar quarter that is three quarters
// after the quarter containing the official business creation date. Verified
// against three official examples; the first two share an identical end
// date despite ~11 weeks apart, proving the rule depends only on the
// creation's calendar quarter, not the exact day or on acreStartDate.
const OFFICIAL_DURATION_EXAMPLES = [
  { creation: "2026-07-01", expectedEnd: "2027-06-30" },
  { creation: "2026-09-21", expectedEnd: "2027-06-30" },
  { creation: "2026-10-05", expectedEnd: "2027-09-30" },
];

for (const { creation, expectedEnd } of OFFICIAL_DURATION_EXAMPLES) {
  test(`official example: creation ${creation} keeps the reduced rate through ${expectedEnd}`, () => {
    const rule = getAcreRule({
      acre: "yes",
      businessStartDate: creation,
      activityType: "services",
      today: new Date(`${creation}T12:00:00`),
    });

    assert.equal(dateOnly(rule.output.acreEndDate), expectedEnd);
    assert.equal(rule.output.regime, "post_reform_2026_07");
    assert.equal(rule.output.acreActive, true);
  });
}

test("post-reform duration ignores acreStartDate entirely", () => {
  const withoutAcreStart = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-09-21",
    activityType: "services",
    today: new Date("2026-09-21T12:00:00"),
  });
  const withUnrelatedAcreStart = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-09-21",
    acreStartDate: "2020-01-01",
    activityType: "services",
    today: new Date("2026-09-21T12:00:00"),
  });

  assert.equal(dateOnly(withoutAcreStart.output.acreEndDate), "2027-06-30");
  assert.equal(dateOnly(withUnrelatedAcreStart.output.acreEndDate), "2027-06-30");
});

test("post-reform expiry is inclusive of the exact end date, day-precise", () => {
  const context = {
    acre: "yes",
    businessStartDate: "2026-07-01",
    activityType: "services",
  };

  const dayBefore = getAcreRule({ ...context, today: new Date("2027-06-29T12:00:00") });
  const expiryDay = getAcreRule({ ...context, today: new Date("2027-06-30T12:00:00") });
  const dayAfter = getAcreRule({ ...context, today: new Date("2027-07-01T12:00:00") });

  assert.equal(dayBefore.output.acreActive, true);
  assert.equal(dayBefore.output.acreStatus, "active");

  assert.equal(expiryDay.output.acreActive, true);
  assert.equal(expiryDay.output.acreStatus, "active");

  assert.equal(dayAfter.output.acreActive, false);
  assert.equal(dayAfter.output.acreStatus, "expired");
});

test("post-reform duration handles a year-boundary creation date", () => {
  const endOfYear = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-12-31",
    activityType: "services",
    today: new Date("2026-12-31T12:00:00"),
  });
  const startOfYear = getAcreRule({
    acre: "yes",
    businessStartDate: "2027-01-01",
    activityType: "services",
    today: new Date("2027-01-01T12:00:00"),
  });

  // 2026-12-31 falls in Q4 2026, same bucket as the 2026-10-05 official
  // example -> same end date.
  assert.equal(dateOnly(endOfYear.output.acreEndDate), "2027-09-30");
  // 2027-01-01 falls in Q1 2027 -> three quarters later is Q4 2027.
  assert.equal(dateOnly(startOfYear.output.acreEndDate), "2027-12-31");
});

test("post-reform duration arithmetic is correct across a leap year", () => {
  const rule = getAcreRule({
    acre: "yes",
    businessStartDate: "2027-10-05",
    activityType: "services",
    today: new Date("2027-10-05T12:00:00"),
  });

  // 2027-10-05 is in Q4 2027; three quarters later is Q3 2028 (2028 is a
  // leap year). The end-of-quarter arithmetic never lands in February, but
  // this proves the year-rollover math stays correct when it crosses into
  // a leap year.
  assert.equal(dateOnly(rule.output.acreEndDate), "2028-09-30");
});

test("2026-07-01 cutover boundary: the exact three days around it classify correctly", () => {
  const dayBefore = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-06-30",
    activityType: "services",
    today: new Date("2026-06-30T12:00:00"),
  });
  const cutoverDay = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-07-01",
    activityType: "services",
    today: new Date("2026-07-01T12:00:00"),
  });
  const dayAfter = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-07-02",
    activityType: "services",
    today: new Date("2026-07-02T12:00:00"),
  });

  assert.equal(dayBefore.output.regime, "pre_reform");
  assert.equal(dayBefore.output.effectiveRate, 0.11);

  assert.equal(cutoverDay.output.regime, "post_reform_2026_07");
  assert.equal(cutoverDay.output.effectiveRate, 0.165);

  assert.equal(dayAfter.output.regime, "post_reform_2026_07");
  assert.equal(dayAfter.output.effectiveRate, 0.165);
});

test("cutover classification is immune to timezone: raw string vs pre-parsed Date give the same regime", () => {
  // Regression guard for the timezone bug found and fixed in LOT 10.1B: a
  // raw "YYYY-MM-DD" string (parsed by coerceDate as UTC midnight) and a
  // pre-parsed local-midnight Date object (as calculateLegacyAcreContribution
  // would pass) must classify identically for the exact cutover date.
  const fromRawString = getAcreRule({
    acre: "yes",
    businessStartDate: "2026-07-01",
    activityType: "services",
    today: new Date("2026-07-01T12:00:00"),
  });
  const fromLocalMidnightDate = getAcreRule({
    acre: "yes",
    businessStartDate: new Date(2026, 6, 1),
    activityType: "services",
    today: new Date("2026-07-01T12:00:00"),
  });

  assert.equal(fromRawString.output.regime, "post_reform_2026_07");
  assert.equal(fromLocalMidnightDate.output.regime, "post_reform_2026_07");
});

test("pre-reform duration is unaffected by the post-reform duration fix", () => {
  const rule = getAcreRule({
    acre: "yes",
    acreStartDate: RECENT_ACRE_START,
    businessStartDate: PRE_REFORM_START,
    activityType: "services",
    today: new Date(),
  });

  assert.equal(rule.output.regime, "pre_reform");
  assert.equal(rule.output.acreActive, true);
  assert.equal(rule.output.acreMonthsLeft, 10);
});
