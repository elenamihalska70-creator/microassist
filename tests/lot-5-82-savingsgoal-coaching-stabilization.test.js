import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";
import { computeObligations } from "../src/utils/obligations.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_77_SOURCE = readFileSync(
  new URL("./lot-5-77-savingsgoal-coaching-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_81_SOURCE = readFileSync(
  new URL("./lot-5-81-savingsgoal-coaching-migration-validation.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 13,
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences), dropping
  // 1 useMemo( call site.
  savingsGoal: 0,
  pdfSavingsGoal: 5,
  useState: 87, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 59, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 94, // LOT 10.2D: +4 useMemo (declaration dossier view selectors); LOT 10.2E.1: +2 (dashboardPrioritizedActions, priorityCardViewModel)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});
const REFERENCE_DATE = "2026-07-20";
const LOW_RESERVE_MESSAGE_KEY = "roleBasedTips.dailyFiscalTip.lowReserve";
const LOW_RESERVE_BRANCH = Object.freeze({
  text: LOW_RESERVE_MESSAGE_KEY,
  title: null,
  severity: null,
  cta: null,
});

const CONTRIBUTION_SCENARIOS = Object.freeze([
  { id: "contribution-zero", finalContributionAmount: 0, expectedGoal: 500 },
  { id: "contribution-low", finalContributionAmount: 22, expectedGoal: 500 },
  { id: "contribution-medium", finalContributionAmount: 220, expectedGoal: 660 },
  { id: "contribution-high", finalContributionAmount: 2200, expectedGoal: 6600 },
]);

const REVENUE_SCENARIOS = Object.freeze([
  {
    id: "revenue-zero",
    values: [],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 0,
  },
  {
    id: "revenue-low",
    values: [100],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 22,
  },
  {
    id: "revenue-high",
    values: [10000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 2200,
  },
  {
    id: "charges-zero",
    values: [1000],
    activityType: "unknown",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0,
    expectedCharges: 0,
  },
  {
    id: "charges-positive-acre-inactive",
    values: [1000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 220,
    expectedAcreStatus: "inactive",
  },
  {
    id: "charges-positive-acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    // LOT 10.1B: pre-reform business so this stays the historical 50% case.
    businessStartDate: "2020-01-01",
    expectedRate: 0.11,
    expectedCharges: 110,
    expectedAcreStatus: "active",
  },
]);

function sourceWithoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function occurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

function coachingSavingsGoalBlock() {
  return extractBlock("const fiscalCoachingSavingsGoal = Math.max(", "  const pdfSavingsGoal = Math.max");
}

function pdfSavingsGoalBlock() {
  return extractBlock("const pdfSavingsGoal = Math.max(", "  const fiscalCoachingCard = useMemo");
}

function fiscalCoachingCardBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
}

function lowReserveBranch() {
  const coaching = fiscalCoachingCardBlock();
  const start = coaching.indexOf("// LOT 5.79A coaching boundary: source-only denominator migration.");
  assert.notEqual(start, -1);
  const end = coaching.indexOf('    if (\n      !smartAlertIds.has("acre-ending")', start);
  assert.notEqual(end, -1);
  return coaching.slice(start, end);
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function assistantBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function smartAlertsBlock() {
  return extractBlock("const smartAlertEstimatedCharges =", "  const smartPriorities = useMemo");
}

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

function invoicesBlock() {
  return extractBlock("const invoiceSectionSummary = useMemo(() => {", "  const fiscalRecommendationCard = useMemo");
}

function remindersBlock() {
  return extractBlock("const activeReminderItems = useMemo(() => {", "  const dashboardWeeklyRecap = useMemo");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-82-revenue-${index}`,
    amount,
    category: "service",
    revenueCategory: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function revenueTotal(values = []) {
  return values.reduce((sum, amount) => sum + Number(amount || 0), 0);
}

function shadowResultFor(scenario) {
  const shadowInput = buildFiscalSummaryInput({
    revenues: revenuesFrom(scenario.values),
    fiscalProfile: {
      activity_type: scenario.activityType,
      acre: scenario.acre,
      acre_start_date: scenario.acreStartDate,
      business_start_date: scenario.businessStartDate ?? "",
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(shadowInput, { trace: false });
}

function legacyChargesFor(scenario) {
  const computed = computeObligations({
    activity_type: scenario.activityType,
    acre: scenario.acre,
    acre_start_date: scenario.acreStartDate,
    business_start_date: scenario.businessStartDate ?? "",
    referenceDate: REFERENCE_DATE,
  });
  const total = revenueTotal(scenario.values);

  return computed?.rate ? Math.round(total * computed.rate) : 0;
}

function savingsGoalFromCharges(charges) {
  return Math.max(charges * 3, 500);
}

function selectLowReserveBranch({ smartAlertIds = [], savingsGoal, savingsProgress }) {
  const smartAlertSet = new Set(smartAlertIds);

  if (!smartAlertSet.has("reserve-low") && savingsGoal > 0 && savingsProgress < savingsGoal * 0.35) {
    return LOW_RESERVE_BRANCH;
  }

  return null;
}

function stabilizationSnapshot({ finalContributionAmount, savingsProgress, smartAlertIds = [] }) {
  const fiscalCoachingSavingsGoal = savingsGoalFromCharges(finalContributionAmount);

  return {
    fiscalCoachingSavingsGoal,
    threshold: fiscalCoachingSavingsGoal * 0.35,
    branch: selectLowReserveBranch({
      smartAlertIds,
      savingsGoal: fiscalCoachingSavingsGoal,
      savingsProgress,
    }),
  };
}

test("LOT 5.82 keeps the Shadow source and denominator alias stable", () => {
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(
    alias,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.equal(occurrences(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(alias, /savingsGoal|Math\.round|Math\.min|\|\||\?\?|Number\(|parseFloat|toLocaleString/);
});

test("LOT 5.82 keeps Shadow baseline thirteen with no fourteenth occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const pdfAlias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 12);
  assert.match(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(pdfAlias, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(pdfAlias, /\bfiscalSummaryVisibleSlice\b/g), 1);
});

test("LOT 5.82 keeps Math.max multiplier minimum and transform contract stable", () => {
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(alias, /Math\.max\(/);
  assert.match(alias, /finalContributionAmount \* 3/);
  assert.match(alias, /\b500\b/);
  assert.equal(occurrences(alias, /\* 3/g), 1);
  assert.equal(occurrences(alias, /\b500\b/g), 1);
  assert.doesNotMatch(alias, /Math\.round|Math\.floor|Math\.ceil|Math\.min|toFixed|clamp|normalize|format/);
});

test("LOT 5.82 keeps numerator ratio threshold comparator branch and output stable", () => {
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.match(branch, /!smartAlertIds\.has\("reserve-low"\) &&\s*fiscalCoachingSavingsGoal > 0 &&\s*savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(branch, /return \{\s*text: roleBasedTips\.dailyFiscalTip\.lowReserve,\s*\};/);
  assert.doesNotMatch(branch, /\bsavingsGoal\b|\/|savingsProgress <=|savingsProgress >|savingsProgress >=/);
  assert.doesNotMatch(branch, /Math\.round|Math\.floor|Math\.ceil|toFixed|cta:|title:|severity:|priority:|icon:/);
});

test("LOT 5.82 stabilizes contribution zero low medium and high denominators", () => {
  for (const scenario of CONTRIBUTION_SCENARIOS) {
    const snapshot = stabilizationSnapshot({
      finalContributionAmount: scenario.finalContributionAmount,
      savingsProgress: 0,
    });

    assert.equal(snapshot.fiscalCoachingSavingsGoal, scenario.expectedGoal, scenario.id);
  }
});

test("LOT 5.82 stabilizes minimum and above-minimum denominator transitions", () => {
  const minimum = stabilizationSnapshot({ finalContributionAmount: 22, savingsProgress: 174 });
  const above = stabilizationSnapshot({ finalContributionAmount: 220, savingsProgress: 174 });
  const backToMinimum = stabilizationSnapshot({ finalContributionAmount: 0, savingsProgress: 174 });

  assert.equal(minimum.fiscalCoachingSavingsGoal, 500);
  assert.equal(above.fiscalCoachingSavingsGoal, 660);
  assert.equal(backToMinimum.fiscalCoachingSavingsGoal, 500);
  assert.equal(Boolean(minimum.branch), true);
  assert.equal(Boolean(above.branch), true);
  assert.equal(Boolean(backToMinimum.branch), true);
});

test("LOT 5.82 stabilizes threshold below exact above and ordered transitions", () => {
  const below = stabilizationSnapshot({ finalContributionAmount: 220, savingsProgress: 230 });
  const exact = stabilizationSnapshot({ finalContributionAmount: 220, savingsProgress: 231 });
  const above = stabilizationSnapshot({ finalContributionAmount: 220, savingsProgress: 232 });
  const belowToExactToAbove = [below, exact, above].map((entry) => Boolean(entry.branch));
  const aboveToBelow = [above, below].map((entry) => Boolean(entry.branch));

  assert.equal(below.threshold, 230.99999999999997);
  assert.deepEqual(below.branch, LOW_RESERVE_BRANCH);
  assert.equal(exact.branch, null);
  assert.equal(above.branch, null);
  assert.deepEqual(belowToExactToAbove, [true, false, false]);
  assert.deepEqual(aboveToBelow, [false, true]);
});

test("LOT 5.82 stabilizes revenue charges and ACRE transitions through Shadow finalContributionAmount", () => {
  for (const scenario of REVENUE_SCENARIOS) {
    const shadowResult = shadowResultFor(scenario);
    const legacyCharges = legacyChargesFor(scenario);

    assert.equal(legacyCharges, scenario.expectedCharges, scenario.id);
    assert.equal(shadowResult.summary.finalContributionAmount, scenario.expectedCharges, scenario.id);
    assert.equal(shadowResult.summary.effectiveRate, scenario.expectedRate, scenario.id);
    assert.equal(savingsGoalFromCharges(legacyCharges), savingsGoalFromCharges(shadowResult.summary.finalContributionAmount), scenario.id);

    if (scenario.expectedAcreStatus) {
      assert.equal(shadowResult.contributions.acre.acreStatus, scenario.expectedAcreStatus, scenario.id);
    }
  }
});

test("LOT 5.82 keeps feature flag ON and OFF behavior in the visible slice", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(visibleSlice, /const usesShadow =\s*FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&\s*Boolean\(shadowResult\);/);
  assert.match(visibleSlice, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/);
  assert.doesNotMatch(visibleSlice, /finalContributionAmount:[\s\S]*?\?\?|finalContributionAmount:[\s\S]*?\|\|/);
  assert.equal(occurrences(app, /SAVINGSGOAL_COACHING/g), 0);
  assert.doesNotMatch(app, /localStorage\.[gs]etItem\([^)]*FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
});

test("LOT 5.82 confirms root savingsGoal is removed (LOT 5.91A) and PDF export stays Shadow-migrated", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const pdfExport = sourceWithoutComments(exportBlock());
  const pdfAlias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    pdfAlias,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(pdfExport, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(pdfExport, /Pas encore assez de données/);
  assert.doesNotMatch(pdfExport, /fiscalCoachingSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount|\bsavingsGoal\b/);
});

test("LOT 5.82 keeps other coaching consumers isolated", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const beforeLowReserve = coaching.slice(0, coaching.indexOf('!smartAlertIds.has("reserve-low")'));
  const afterLowReserve = coaching.slice(coaching.indexOf('!smartAlertIds.has("acre-ending")'));

  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.irregularRevenue/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.tvaWatch/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.missingExpenses/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.deadline/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.acreEnding/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.guestHistory/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.firstInvoice/);
  assert.doesNotMatch(`${beforeLowReserve}\n${afterLowReserve}`, /fiscalSummaryVisibleSlice/);
});

test("LOT 5.82 keeps assistant persistence payloads feedback and analytics isolated", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.doesNotMatch(coaching, /simpleAssistantGuidance|localStorage|sessionStorage|supabase|payload|trackEvent|feedbackContextSnapshot|handleExportPDF/i);
  assert.doesNotMatch(assistant, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(persistence, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.82 keeps smart alerts invoices reminders and weekly recap isolated", () => {
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const invoices = sourceWithoutComments(invoicesBlock());
  const reminders = sourceWithoutComments(remindersBlock());

  assert.doesNotMatch(smartAlerts, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(weekly, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(invoices, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(reminders, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.82 keeps React and fiscal pipeline counts stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const pdfAlias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(alias, /useState|useEffect|useMemo\(|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.doesNotMatch(pdfAlias, /useState|useEffect|useMemo\(|buildFiscalSummaryInput|calculateFiscalSummary/);
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: APPROVED_COUNTS.useState/useEffect/useMemo above are whole-file totals -- they
  // shift on any unrelated hook addition or removal anywhere in the ~15,000-line file
  // (documented fragility class B in LOT 5.96/5.97). This supplements, without replacing, that
  // count with a check scoped to the three savingsGoal boundaries this file's own history
  // cares about (the coaching/PDF denominator aliases and the low-reserve branch that reads
  // them), mirroring the pattern LOT 5.97 established in lot-5-29. fiscalCoachingCardBlock()
  // is intentionally not included here: its own start marker is the `useMemo(` declaration of
  // the coaching card itself, so a zero-count check against it would always fail regardless of
  // this boundary's actual content.
  const alias = coachingSavingsGoalBlock();
  const pdfAlias = pdfSavingsGoalBlock();
  const branch = lowReserveBranch();

  for (const block of [alias, pdfAlias, branch]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.82 keeps parity validation and runtime evidence intact", () => {
  assert.match(LOT_5_77_SOURCE, /intentional amount ratio and branch mismatches/);
  assert.match(LOT_5_81_SOURCE, /LOT 5\.81 validates the exact Shadow-backed coaching alias/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /runtime parity evidence has no UI, state, persistence, network or implicit time access/);
});

test("LOT 5.82 keeps rollback local to the low-reserve denominator", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.equal(occurrences(app, /\bfiscalCoachingSavingsGoal\b/g), 4);
  assert.equal(occurrences(app, /\bpdfSavingsGoal\b/g), APPROVED_COUNTS.pdfSavingsGoal);
  assert.equal(occurrences(app, /\bsavingsGoal\b/g), APPROVED_COUNTS.savingsGoal);
  assert.equal(occurrences(alias, /\bfiscalCoachingSavingsGoal\b/g), 1);
  assert.equal(occurrences(coaching, /\bfiscalCoachingSavingsGoal\b/g), 3);
  assert.equal(occurrences(branch, /\bfiscalCoachingSavingsGoal\b/g), 2);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
});

test("LOT 5.82 keeps same input and cloned input deterministic", () => {
  const input = Object.freeze({
    finalContributionAmount: 220,
    savingsProgress: 230,
  });
  const first = stabilizationSnapshot(input);
  const second = stabilizationSnapshot(input);
  const cloned = stabilizationSnapshot(structuredClone(input));

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});
