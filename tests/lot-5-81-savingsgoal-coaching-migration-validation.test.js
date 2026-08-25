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
const LOT_5_79_SOURCE = readFileSync(
  new URL("./lot-5-79-savingsgoal-coaching-migration.test.js", import.meta.url),
  "utf8",
);
const LOT_5_80_REPORT = readFileSync(
  new URL("../docs/LOT_5_80_EXTENDED_STABILIZATION_REPORT.md", import.meta.url),
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
  fiscalSummaryVisibleSlice: 15,
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences), dropping
  // 1 useMemo( call site.
  savingsGoal: 0,
  useState: 86, // LOT 10.2D: +5 useState (declaration dossier UI state)
  useEffect: 59, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 92, // LOT 10.2D: +4 useMemo (declaration dossier view selectors)
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

const BASE_SCENARIOS = Object.freeze([
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
    id: "revenue-positive",
    values: [1000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 220,
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
    id: "acre-inactive",
    values: [1000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 220,
    expectedAcreStatus: "inactive",
  },
  {
    id: "acre-active",
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
  return extractBlock("const fiscalCoachingSavingsGoal = Math.max(", "  const fiscalCoachingCard = useMemo");
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
    id: `lot-5-81-revenue-${index}`,
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

function deterministicCoachingSnapshot({ finalContributionAmount, savingsProgress, smartAlertIds = [] }) {
  const fiscalCoachingSavingsGoal = savingsGoalFromCharges(finalContributionAmount);

  return {
    fiscalCoachingSavingsGoal,
    branch: selectLowReserveBranch({
      smartAlertIds,
      savingsGoal: fiscalCoachingSavingsGoal,
      savingsProgress,
    }),
  };
}

test("LOT 5.81 validates the exact Shadow-backed coaching alias", () => {
  // LOT 5.86A placed the approved pdfSavingsGoal alias directly after
  // fiscalCoachingSavingsGoal, so this extraction range now carries both
  // Shadow-backed savings-goal aliases (coaching, then PDF), in that order.
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(
    alias,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    alias,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.equal(occurrences(alias, /\bfiscalCoachingSavingsGoal\b/g), 1);
  assert.equal(occurrences(alias, /\bpdfSavingsGoal\b/g), 1);
  assert.equal(occurrences(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.doesNotMatch(alias, /\bsavingsGoal\b|Math\.round|Math\.min|\|\||\?\?|Number\(|parseFloat|toLocaleString/);
});

test("LOT 5.81 validates visible slice finalContributionAmount source and feature flag behavior", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(visibleSlice, /const usesShadow =\s*FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&\s*Boolean\(shadowResult\);/);
  assert.match(visibleSlice, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/);
  assert.doesNotMatch(visibleSlice, /finalContributionAmount:[\s\S]*?\?\?|finalContributionAmount:[\s\S]*?\|\|/);
  assert.equal(occurrences(app, /SAVINGSGOAL_COACHING/g), 0);
});

test("LOT 5.81 validates the migrated low-reserve consumer has no direct savingsGoal read", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.doesNotMatch(coaching, /\bsavingsGoal\b/);
  assert.match(branch, /!smartAlertIds\.has\("reserve-low"\) &&\s*fiscalCoachingSavingsGoal > 0 &&\s*savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
  assert.doesNotMatch(branch, /fiscalSummaryVisibleSlice|shadowResult|finalContributionAmount/);
});

test("LOT 5.81 validates root savingsGoal is removed (LOT 5.91A) and the coaching alias keeps its formula", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.81 validates denominator contract Math.max multiplier floor and no new transform", () => {
  // Two approved aliases (fiscalCoachingSavingsGoal, pdfSavingsGoal) share
  // this Math.max(... * 3, 500) contract in the same extraction range.
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(alias, /Math\.max\(/);
  assert.match(alias, /finalContributionAmount \* 3/);
  assert.match(alias, /\b500\b/);
  assert.equal(occurrences(alias, /Math\.max\(/g), 2);
  assert.equal(occurrences(alias, /\* 3/g), 2);
  assert.equal(occurrences(alias, /\b500\b/g), 2);
  assert.equal(occurrences(alias, /\bfiscalCoachingSavingsGoal\b/g), 1);
  assert.equal(occurrences(alias, /\bpdfSavingsGoal\b/g), 1);
  assert.doesNotMatch(alias, /Math\.round|Math\.floor|Math\.ceil|Math\.min|toFixed|clamp|normalize/);
});

test("LOT 5.81 validates numerator ratio threshold comparator branch and message integrity", () => {
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(branch, /return \{\s*text: roleBasedTips\.dailyFiscalTip\.lowReserve,\s*\};/);
  assert.doesNotMatch(branch, /savingsProgress <=|savingsProgress >|savingsProgress >=|\/|0\.34|0\.36/);
  assert.doesNotMatch(branch, /Math\.round|Math\.floor|Math\.ceil|toFixed|cta:|title:|severity:|priority:|icon:/);
});

test("LOT 5.81 validates threshold below exact and above parity", () => {
  const finalContributionAmount = 220;
  const legacyGoal = savingsGoalFromCharges(finalContributionAmount);
  const threshold = legacyGoal * 0.35;

  assert.equal(legacyGoal, 660);
  assert.equal(threshold, 230.99999999999997);
  assert.deepEqual(
    deterministicCoachingSnapshot({ finalContributionAmount, savingsProgress: 230 }).branch,
    LOW_RESERVE_BRANCH,
  );
  assert.equal(
    deterministicCoachingSnapshot({ finalContributionAmount, savingsProgress: 231 }).branch,
    null,
  );
  assert.equal(
    deterministicCoachingSnapshot({ finalContributionAmount, savingsProgress: 232 }).branch,
    null,
  );
});

test("LOT 5.81 validates reserve-low smart alert suppresses only the migrated branch", () => {
  const noAlert = deterministicCoachingSnapshot({
    finalContributionAmount: 220,
    savingsProgress: 230,
  });
  const existingAlert = deterministicCoachingSnapshot({
    finalContributionAmount: 220,
    savingsProgress: 230,
    smartAlertIds: ["reserve-low"],
  });

  assert.deepEqual(noAlert.branch, LOW_RESERVE_BRANCH);
  assert.equal(existingAlert.branch, null);
});

test("LOT 5.81 validates deterministic amount parity across revenue and ACRE scenarios", () => {
  for (const scenario of BASE_SCENARIOS) {
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

test("LOT 5.81 validates same input and cloned input determinism", () => {
  const scenario = BASE_SCENARIOS.find((entry) => entry.id === "revenue-positive");
  const first = deterministicCoachingSnapshot({
    finalContributionAmount: scenario.expectedCharges,
    savingsProgress: 230,
  });
  const second = deterministicCoachingSnapshot({
    finalContributionAmount: scenario.expectedCharges,
    savingsProgress: 230,
  });
  const cloned = deterministicCoachingSnapshot(
    structuredClone({
      finalContributionAmount: scenario.expectedCharges,
      savingsProgress: 230,
    }),
  );

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});

test("LOT 5.81 validates Shadow baseline fourteen and no fifteenth occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(app, /\bsavingsGoal\b/g), APPROVED_COUNTS.savingsGoal);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 14);
  assert.match(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
});

test("LOT 5.81 validates PDF export remains Legacy and isolated", () => {
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(pdfExport, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(pdfExport, /Pas encore assez de données/);
  assert.match(pdfExport, /pdfSavingsGoal,\s*\n\s*savingsProgress,/);
  assert.doesNotMatch(pdfExport, /fiscalCoachingSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.81 validates other coaching consumers remain isolated", () => {
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

test("LOT 5.81 validates no propagation to assistant persistence payloads or feedback", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.doesNotMatch(coaching, /simpleAssistantGuidance|localStorage|sessionStorage|supabase|payload|trackEvent|feedbackContextSnapshot|handleExportPDF/i);
  assert.doesNotMatch(assistant, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(persistence, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.81 validates no propagation to smart alerts invoices reminders or weekly recap", () => {
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const invoices = sourceWithoutComments(invoicesBlock());
  const reminders = sourceWithoutComments(remindersBlock()).replace(sourceWithoutComments(fiscalCoachingCardBlock()), "");

  assert.doesNotMatch(smartAlerts, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(weekly, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(invoices, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(reminders, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.81 validates React and pipeline stability counts", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(alias, /useState|useEffect|useMemo\(|buildFiscalSummaryInput|calculateFiscalSummary/);
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: APPROVED_COUNTS.useState/useEffect/useMemo above are whole-file totals -- they
  // shift on any unrelated hook addition or removal anywhere in the ~15,000-line file
  // (documented fragility class B in LOT 5.96/5.97). This supplements, without replacing, that
  // count with a check scoped to the two savingsGoal boundaries this file's own history cares
  // about (the coaching denominator alias and the low-reserve branch that reads it), mirroring
  // the pattern LOT 5.97 established in lot-5-29. fiscalCoachingCardBlock() is intentionally
  // not included here: its own start marker is the `useMemo(` declaration of the coaching card
  // itself, so a zero-count check against it would always fail regardless of this boundary's
  // actual content.
  const alias = coachingSavingsGoalBlock();
  const branch = lowReserveBranch();

  for (const block of [alias, branch]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.81 validates parity runtime evidence and stabilization guards remain intact", () => {
  assert.match(LOT_5_77_SOURCE, /intentional amount ratio and branch mismatches/);
  assert.match(LOT_5_77_SOURCE, /LOT 5\.77 tracks the approved coaching Shadow consumer and baseline fourteen/);
  assert.match(LOT_5_79_SOURCE, /LOT 5\.79 uses the exact Shadow-backed denominator alias/);
  assert.match(LOT_5_80_REPORT, /Full validation PASS/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /runtime parity evidence has no UI, state, persistence, network or implicit time access/);
});

test("LOT 5.81 validates rollback remains local to the low-reserve denominator", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.equal(occurrences(app, /\bfiscalCoachingSavingsGoal\b/g), 4);
  assert.equal(occurrences(alias, /\bfiscalCoachingSavingsGoal\b/g), 1);
  assert.equal(occurrences(coaching, /\bfiscalCoachingSavingsGoal\b/g), 3);
  assert.equal(occurrences(branch, /\bfiscalCoachingSavingsGoal\b/g), 2);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
});
