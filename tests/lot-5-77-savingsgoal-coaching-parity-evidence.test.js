import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
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
    id: "revenue-zero-estimated-zero-acre-inactive",
    values: [],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.22,
    expectedEstimatedCharges: 0,
  },
  {
    id: "revenue-positive-services",
    values: [1000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.22,
    expectedEstimatedCharges: 220,
  },
  {
    id: "low-revenue-floor-goal",
    values: [100],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.22,
    expectedEstimatedCharges: 22,
  },
  {
    id: "high-revenue-high-goal",
    values: [10000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.22,
    expectedEstimatedCharges: 2200,
  },
  {
    id: "multiple-revenues",
    values: [1000, 250, 75],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.22,
    expectedEstimatedCharges: 292,
  },
  {
    id: "commerce-acre-inactive",
    values: [1000],
    activityType: "commerce",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0.123,
    expectedEstimatedCharges: 123,
  },
  {
    id: "services-acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    // LOT 10.1B: pre-reform business so this stays the historical 50% case.
    businessStartDate: "2020-01-01",
    legacyRate: 0.11,
    expectedEstimatedCharges: 110,
  },
  {
    id: "unknown-activity-estimated-zero",
    values: [1000],
    activityType: "unknown",
    acre: "no",
    acreStartDate: "",
    legacyRate: 0,
    expectedEstimatedCharges: 0,
  },
]);

const THRESHOLD_SCENARIOS = Object.freeze([
  {
    id: "threshold-below",
    revenue: 1000,
    estimatedCharges: 220,
    savingsProgress: 230,
    expectedSelected: true,
  },
  {
    id: "threshold-exact",
    revenue: 1000,
    estimatedCharges: 220,
    savingsProgress: 231,
    expectedSelected: false,
  },
  {
    id: "threshold-above",
    revenue: 1000,
    estimatedCharges: 220,
    savingsProgress: 232,
    expectedSelected: false,
  },
]);

const TRANSITION_SCENARIOS = Object.freeze([
  { id: "zero-to-positive-before", values: [], expectedSelected: true },
  { id: "zero-to-positive-after", values: [1000], expectedSelected: false },
  { id: "positive-to-zero-before", values: [1000], expectedSelected: false },
  { id: "positive-to-zero-after", values: [], expectedSelected: true },
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

function coachingBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function assistantBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-77-revenue-${index}`,
    amount,
    category: "service",
    revenueCategory: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function revenueTotal(values = []) {
  return values.reduce((sum, amount) => sum + Number(amount || 0), 0);
}

function legacyEstimatedCharges({ currentMonthTotal, rate }) {
  if (rate) {
    return Math.round(currentMonthTotal * rate);
  }
  return 0;
}

function savingsGoalFromCharges(estimatedCharges) {
  return Math.max(estimatedCharges * 3, 500);
}

function savingsProgressFromAmounts({ currentMonthTotal, estimatedCharges }) {
  return Math.max(0, currentMonthTotal - estimatedCharges);
}

function reserveLowRatio({ savingsProgress, savingsGoal }) {
  return savingsProgress / savingsGoal;
}

function selectLowReserveBranch({ smartAlertIds = [], savingsGoal, savingsProgress }) {
  const smartAlertSet = new Set(smartAlertIds);

  if (!smartAlertSet.has("reserve-low") && savingsGoal > 0 && savingsProgress < savingsGoal * 0.35) {
    return LOW_RESERVE_BRANCH;
  }

  return null;
}

function scenarioToLegacyModel(scenario) {
  const currentMonthTotal = "revenue" in scenario ? scenario.revenue : revenueTotal(scenario.values);
  const estimatedCharges =
    scenario.estimatedCharges ??
    legacyEstimatedCharges({
      currentMonthTotal,
      rate: scenario.legacyRate,
    });
  const savingsGoal = savingsGoalFromCharges(estimatedCharges);
  const savingsProgress =
    scenario.savingsProgress ??
    savingsProgressFromAmounts({
      currentMonthTotal,
      estimatedCharges,
    });

  return {
    currentMonthTotal,
    estimatedCharges,
    savingsGoal,
    savingsProgress,
    ratio: reserveLowRatio({ savingsProgress, savingsGoal }),
    branch: selectLowReserveBranch({ savingsGoal, savingsProgress }),
  };
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

function shadowCandidateGoal(finalContributionAmount) {
  return Math.max(finalContributionAmount * 3, 500);
}

function compareCoachingCandidate({ legacy, shadowFinalContributionAmount }) {
  const shadowGoal = shadowCandidateGoal(shadowFinalContributionAmount);
  const shadowBranch = selectLowReserveBranch({
    savingsGoal: shadowGoal,
    savingsProgress: legacy.savingsProgress,
  });

  return {
    amountMatches: Object.is(legacy.savingsGoal, shadowGoal),
    ratioMatches: Object.is(
      reserveLowRatio({
        savingsProgress: legacy.savingsProgress,
        savingsGoal: legacy.savingsGoal,
      }),
      reserveLowRatio({
        savingsProgress: legacy.savingsProgress,
        savingsGoal: shadowGoal,
      }),
    ),
    branchMatches: Object.is(Boolean(legacy.branch), Boolean(shadowBranch)),
    legacyBranch: legacy.branch,
    shadowBranch,
    shadowGoal,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

test("LOT 5.77 identifies the approved migrated coaching consumer", () => {
  const coaching = sourceWithoutComments(coachingBlock());

  assert.match(coaching, /const fiscalCoachingCard = useMemo\(\(\) => \{/);
  assert.match(coaching, /const smartAlertIds = new Set\(smartAlerts\.map\(\(alert\) => alert\.id\)\);/);
  assert.match(coaching, /!smartAlertIds\.has\("reserve-low"\) &&\s*fiscalCoachingSavingsGoal > 0 &&\s*savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(coaching, /text: roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.equal(occurrences(coaching, /\bsavingsGoal\b/g), 0);
});

test("LOT 5.77 confirms root savingsGoal is removed and the coaching alias keeps its Shadow-backed formula", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const rootMatch = app.match(/const savingsGoal = useMemo\(\(\) => \{[\s\S]*?\}, \[estimatedCharges\]\);/);

  // LOT 5.91A: root savingsGoal removed (its own retention condition -- no coaching
  // or PDF consumer left reading it -- was satisfied by LOT 5.79A and LOT 5.86A).
  assert.equal(rootMatch, null);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.77 proves amount parity for approved coaching scenarios", () => {
  for (const scenario of BASE_SCENARIOS) {
    const shadowResult = shadowResultFor(scenario);
    const legacy = scenarioToLegacyModel(scenario);

    assert.equal(legacy.estimatedCharges, scenario.expectedEstimatedCharges, scenario.id);
    assert.equal(shadowResult.summary.finalContributionAmount, scenario.expectedEstimatedCharges, scenario.id);
    assert.equal(legacy.savingsGoal, shadowCandidateGoal(shadowResult.summary.finalContributionAmount), scenario.id);
  }
});

test("LOT 5.77 proves ratio parity separately from amount parity", () => {
  for (const scenario of BASE_SCENARIOS.filter((entry) => entry.expectedEstimatedCharges > 0)) {
    const shadowResult = shadowResultFor(scenario);
    const legacy = scenarioToLegacyModel(scenario);
    const comparison = compareCoachingCandidate({
      legacy,
      shadowFinalContributionAmount: shadowResult.summary.finalContributionAmount,
    });

    assert.equal(comparison.amountMatches, true, scenario.id);
    assert.equal(comparison.ratioMatches, true, scenario.id);
  }
});

test("LOT 5.77 proves boolean parity for the low-reserve branch", () => {
  for (const scenario of BASE_SCENARIOS) {
    const shadowResult = shadowResultFor(scenario);
    const legacy = scenarioToLegacyModel(scenario);
    const comparison = compareCoachingCandidate({
      legacy,
      shadowFinalContributionAmount: shadowResult.summary.finalContributionAmount,
    });

    assert.equal(comparison.branchMatches, true, scenario.id);
    assert.deepEqual(comparison.shadowBranch, comparison.legacyBranch, scenario.id);
  }
});

test("LOT 5.77 proves threshold below exact and above behavior", () => {
  for (const scenario of THRESHOLD_SCENARIOS) {
    const legacy = scenarioToLegacyModel(scenario);
    const comparison = compareCoachingCandidate({
      legacy,
      shadowFinalContributionAmount: scenario.estimatedCharges,
    });

    assert.equal(Boolean(legacy.branch), scenario.expectedSelected, scenario.id);
    assert.equal(comparison.branchMatches, true, scenario.id);
  }
});

test("LOT 5.77 covers revenue zero positive and transition scenarios", () => {
  for (const scenario of TRANSITION_SCENARIOS) {
    const legacy = scenarioToLegacyModel({
      ...scenario,
      activityType: "services",
      acre: "no",
      acreStartDate: "",
      legacyRate: 0.22,
    });

    assert.equal(Boolean(legacy.branch), scenario.expectedSelected, scenario.id);
  }
});

test("LOT 5.77 covers estimatedCharges zero and positive contracts", () => {
  const zero = scenarioToLegacyModel({
    values: [1000],
    legacyRate: 0,
  });
  const positive = scenarioToLegacyModel({
    values: [1000],
    legacyRate: 0.22,
  });

  assert.equal(zero.estimatedCharges, 0);
  assert.equal(zero.savingsGoal, 500);
  assert.equal(positive.estimatedCharges, 220);
  assert.equal(positive.savingsGoal, 660);
});

test("LOT 5.77 covers ACRE inactive and active candidate mapping", () => {
  const inactive = shadowResultFor(BASE_SCENARIOS.find((scenario) => scenario.id === "revenue-positive-services"));
  const active = shadowResultFor(BASE_SCENARIOS.find((scenario) => scenario.id === "services-acre-active"));

  assert.equal(inactive.summary.finalContributionAmount, 220);
  assert.equal(inactive.summary.effectiveRate, 0.22);
  assert.equal(inactive.contributions.acre.acreStatus, "inactive");
  assert.equal(active.summary.finalContributionAmount, 110);
  assert.equal(active.summary.effectiveRate, 0.11);
  assert.equal(active.contributions.acre.acreStatus, "active");
});

test("LOT 5.77 detects intentional amount ratio and branch mismatches", () => {
  const legacy = scenarioToLegacyModel({
    revenue: 1000,
    estimatedCharges: 220,
    savingsProgress: 230,
  });
  const comparison = compareCoachingCandidate({
    legacy,
    shadowFinalContributionAmount: 110,
  });

  assert.equal(comparison.amountMatches, false);
  assert.equal(comparison.ratioMatches, false);
  assert.equal(comparison.branchMatches, false);
  assert.deepEqual(comparison.legacyBranch, LOW_RESERVE_BRANCH);
  assert.equal(comparison.shadowBranch, null);
});

test("LOT 5.77 preserves message branch integrity for matched scenarios", () => {
  const legacy = scenarioToLegacyModel({
    revenue: 1000,
    estimatedCharges: 220,
    savingsProgress: 230,
  });
  const comparison = compareCoachingCandidate({
    legacy,
    shadowFinalContributionAmount: 220,
  });

  assert.deepEqual(comparison.legacyBranch, LOW_RESERVE_BRANCH);
  assert.deepEqual(comparison.shadowBranch, LOW_RESERVE_BRANCH);
  assert.equal(comparison.legacyBranch.text, LOW_RESERVE_MESSAGE_KEY);
  assert.equal(comparison.legacyBranch.title, null);
  assert.equal(comparison.legacyBranch.severity, null);
  assert.equal(comparison.legacyBranch.cta, null);
});

test("LOT 5.77 is deterministic for same input and cloned input", () => {
  const scenario = BASE_SCENARIOS.find((entry) => entry.id === "multiple-revenues");
  const first = scenarioToLegacyModel(scenario);
  const second = scenarioToLegacyModel(scenario);
  const cloned = scenarioToLegacyModel(structuredClone(scenario));

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});

test("LOT 5.77 does not mutate scenario inputs", () => {
  const scenario = deepFreeze(
    structuredClone(BASE_SCENARIOS.find((entry) => entry.id === "multiple-revenues")),
  );
  const before = structuredClone(scenario);

  scenarioToLegacyModel(scenario);
  shadowResultFor(scenario);

  assert.deepEqual(scenario, before);
});

test("LOT 5.77 uses no implicit time random network or persistence in evidence helpers", () => {
  const helperSources = [
    revenueTotal,
    legacyEstimatedCharges,
    savingsGoalFromCharges,
    savingsProgressFromAmounts,
    reserveLowRatio,
    selectLowReserveBranch,
    scenarioToLegacyModel,
    compareCoachingCandidate,
  ]
    .map((fn) => fn.toString())
    .join("\n");

  assert.doesNotMatch(helperSources, /Date\.now|new Date|getTodayIsoDate|Math\.random|fetch|localStorage|sessionStorage|supabase/i);
});

test("LOT 5.77 does not touch assistant persistence payload analytics or feedback", () => {
  const coaching = sourceWithoutComments(coachingBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const assistant = sourceWithoutComments(assistantBlock());

  assert.doesNotMatch(coaching, /localStorage|sessionStorage|supabase|fetch|trackEvent|feedbackContextSnapshot|simpleAssistantGuidance/);
  assert.doesNotMatch(persistence, /\bsavingsGoal\b/);
  assert.doesNotMatch(feedback, /\bsavingsGoal\b/);
  assert.doesNotMatch(assistant, /\bsavingsGoal\b/);
});

test("LOT 5.77 keeps PDF export untouched and out of coaching scope", () => {
  const pdfExport = sourceWithoutComments(exportBlock());
  const coaching = sourceWithoutComments(coachingBlock());

  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(pdfExport, /fiscalSummaryVisibleSlice|shadowResult/);
  assert.doesNotMatch(coaching, /Objectif d epargne|handleExportPDF|drawBox|doc\.save/);
});

test("LOT 5.77 tracks the approved coaching Shadow consumer and baseline fourteen", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const coaching = sourceWithoutComments(coachingBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 14);
  assert.doesNotMatch(coaching, /fiscalSummaryVisibleSlice|shadowResult|finalContributionAmount/);
  assert.match(app, /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/);
});

test("LOT 5.77 characterizes feature flag fallback without creating a new flag", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(visibleSlice, /const usesShadow =\s*FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&\s*Boolean\(shadowResult\);/);
  assert.match(visibleSlice, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/);
  assert.equal(occurrences(app, /SAVINGSGOAL_COACHING/g), 0);
});
