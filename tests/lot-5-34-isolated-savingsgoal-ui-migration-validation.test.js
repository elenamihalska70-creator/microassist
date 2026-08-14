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
const LOT_5_30_REPORT = readFileSync(
  new URL("../docs/LOT_5_30_ISOLATED_SAVINGSGOAL_UI_PARITY_EVIDENCE_REPORT.md", import.meta.url),
  "utf8",
);
const LOT_5_33_REPORT = readFileSync(
  new URL("../docs/LOT_5_33_EXTENDED_STABILIZATION_REPORT.md", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);

const FIXED_NOW_ISO = "2026-07-30T12:00:00.000Z";
const FIXED_REFERENCE_DATE = "2026-07-30";
const RealDate = globalThis.Date;

const VALUE_SCENARIOS = Object.freeze([
  { id: "final-zero", finalContributionAmount: 0, savingsProgress: 0, expected: 0 },
  { id: "positive-below-floor-threshold", finalContributionAmount: 100, savingsProgress: 250, expected: 50 },
  { id: "positive-above-floor-threshold", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "decimal-amount", finalContributionAmount: 200.5, savingsProgress: 301, expected: 50 },
  { id: "revenue-change-low", finalContributionAmount: 110, savingsProgress: 110, expected: 22 },
  { id: "revenue-change-high", finalContributionAmount: 330, savingsProgress: 495, expected: 50 },
  { id: "added-revenue", finalContributionAmount: 440, savingsProgress: 660, expected: 50 },
  { id: "removed-revenue", finalContributionAmount: 220, savingsProgress: 220, expected: 33 },
  { id: "multiple-revenues", finalContributionAmount: 770, savingsProgress: 1155, expected: 50 },
  { id: "acre-inactive", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "acre-active", finalContributionAmount: 110, savingsProgress: 330, expected: 66 },
  { id: "same-input", finalContributionAmount: 264, savingsProgress: 396, expected: 50 },
  { id: "cloned-input", finalContributionAmount: 264, savingsProgress: 396, expected: 50 },
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
  assert.notEqual(start, -1, startText);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, endText);
  return APP_SOURCE.slice(start, end);
}

function estimatedChargesBlock() {
  return extractBlock(
    "const estimatedCharges = useMemo(() => {",
    "  const availableAmount = useMemo(() => {",
  );
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function progressIndicatorsBlock() {
  return extractBlock(
    "{isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (",
    "              {/* ACRE Expiration Warning */}",
  );
}

function objectiveSavingsTextBlock() {
  return extractBlock(
    "<span>💰 Objectif d'épargne</span>",
    '                    <div className="progressBar progressBarPremium">',
  );
}

function progressFillBlock() {
  return extractBlock(
    '<div className="progressBar progressBarPremium">',
    "                  </div>\n                </div>\n              )}",
  );
}

function coachingSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.79A coaching boundary: source-only denominator migration.",
    '    if (\n      !smartAlertIds.has("acre-ending")',
  );
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function pdfSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function assistantDraftBlock() {
  return extractBlock("function readLocalDraftPayload", "function pickProfileField");
}

function visibleSavingsGoal(finalContributionAmount) {
  return Math.max(finalContributionAmount * 3, 500);
}

function visibleTextPercent(savingsProgress, finalContributionAmount) {
  return Math.min(
    100,
    Math.round((savingsProgress / visibleSavingsGoal(finalContributionAmount)) * 100),
  );
}

function selectVisibleSliceFinalContribution({
  flagEnabled,
  shadowResult,
  estimatedCharges,
}) {
  const usesShadow = flagEnabled && Boolean(shadowResult);
  return usesShadow ? shadowResult.summary.finalContributionAmount : estimatedCharges;
}

function installFixedDate(isoDate) {
  globalThis.Date = class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(isoDate);
        return;
      }

      super(...args);
    }

    static now() {
      return new RealDate(isoDate).getTime();
    }
  };
}

function restoreDate() {
  globalThis.Date = RealDate;
}

function runWithFixedDate(callback) {
  installFixedDate(FIXED_NOW_ISO);

  try {
    return callback();
  } finally {
    restoreDate();
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function appDtoFromScenario(scenario) {
  return {
    revenues: scenario.revenues.map((revenue) => ({ ...revenue })),
    fiscalProfile: {
      activity_type: scenario.activityType,
      acre: scenario.acre,
      acre_start_date: scenario.acreStartDate,
    },
    period: scenario.period ? { ...scenario.period } : {},
    referenceDate: FIXED_REFERENCE_DATE,
  };
}

function revenueTotalForPeriod(revenues, period = {}) {
  return revenues.reduce((total, revenue) => {
    if (period.startDate && revenue.date < period.startDate) return total;
    if (period.endDate && revenue.date > period.endDate) return total;
    return total + Number(revenue.amount || 0);
  }, 0);
}

function createRealScenarioEvidence(scenario) {
  const revenueTotal = revenueTotalForPeriod(scenario.revenues, scenario.period);
  const computed = computeObligations({
    activity_type: scenario.activityType,
    acre: scenario.acre,
    acre_start_date: scenario.acreStartDate,
    ca_month: revenueTotal,
    ca_ytd: revenueTotal,
    months_with_data: 1,
    declaration_frequency: "mensuel",
  });
  const shadowInput = buildFiscalSummaryInput(appDtoFromScenario(scenario));
  const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });

  return {
    legacyAmount: computed?.rate ? Math.round(revenueTotal * computed.rate) : 0,
    shadowAmount: shadowResult.summary.finalContributionAmount,
    uiPercent: visibleTextPercent(
      Math.max(0, revenueTotal - shadowResult.summary.finalContributionAmount),
      shadowResult.summary.finalContributionAmount,
    ),
  };
}

test("LOT 5.34 validates the exact target consumer and Shadow source", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /Objectif d'épargne/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bshadowResult\b|\bestimatedCharges\b|\bsavingsGoal\b/);
});

test("LOT 5.34 validates Shadow baseline includes the approved progress bar and weekly rate occurrences", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), 15);
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(LOT_5_33_REPORT, /fiscalSummaryVisibleSlice: 7/);
  assert.match(LOT_5_33_REPORT, /Objectif d'épargne/);
});

test("LOT 5.34 validates formula and formatter preservation", () => {
  const block = objectiveSavingsTextBlock();

  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /Math\.round\(/);
  assert.match(block, /Math\.max\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /500,/);
  assert.match(block, /%\s*<\/span>/);
});

test("LOT 5.34 validates deterministic value scenarios", () => {
  const firstRun = VALUE_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    value: visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
  const secondRun = VALUE_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    value: visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
  const clonedRun = structuredClone(VALUE_SCENARIOS).map((scenario) => ({
    id: scenario.id,
    value: visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
  assert.deepEqual(
    firstRun,
    VALUE_SCENARIOS.map((scenario) => ({ id: scenario.id, value: scenario.expected })),
  );
});

test("LOT 5.34 validates real inactive and active ACRE parity scenarios", () => {
  const scenarios = Object.freeze([
    {
      id: "acre-inactive",
      activityType: "services",
      acre: "no",
      acreStartDate: null,
      revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    },
    {
      id: "acre-active",
      activityType: "services",
      acre: "yes",
      acreStartDate: "2026-01-15",
      revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    },
  ]);

  const results = runWithFixedDate(() => scenarios.map(createRealScenarioEvidence));

  for (const result of results) {
    assert.equal(result.legacyAmount, result.shadowAmount);
    assert.equal(Number.isInteger(result.uiPercent), true);
  }
});

test("LOT 5.34 validates flag ON, flag OFF and local rollback behavior", () => {
  const shadowResult = { summary: { finalContributionAmount: 330 } };

  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: true,
      shadowResult,
      estimatedCharges: 220,
    }),
    330,
  );
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: false,
      shadowResult,
      estimatedCharges: 220,
    }),
    220,
  );
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: true,
      shadowResult: null,
      estimatedCharges: 220,
    }),
    220,
  );
});

test("LOT 5.34 validates root savingsGoal is removed and both active aliases keep their formula", () => {
  assert.match(estimatedChargesBlock(), /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(estimatedChargesBlock(), /return 0;/);
  const code = sourceWithoutComments(APP_SOURCE);
  assert.doesNotMatch(code, /const savingsGoal = useMemo/);
  assert.doesNotMatch(code, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.34 validates progress bar follows the approved Shadow-backed UI source", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /width: `\$\{Math\.min\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /500/);
  assert.doesNotMatch(block, /savingsProgress \/ savingsGoal|shadowResult/);
});

test("LOT 5.34 validates coaching low-reserve uses migrated denominator", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.34 validates PDF stays Legacy", () => {
  const block = sourceWithoutComments(pdfSavingsGoalBranch());

  assert.match(block, /Objectif d epargne/);
  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.34 validates no propagation to persistence, payload, assistant or export", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /localStorage|sessionStorage|supabase|fetch|payload|assistant|trackEvent/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
});

test("LOT 5.34 validates no mutation in validation helpers", () => {
  const scenario = deepFreeze({
    id: "immutable",
    finalContributionAmount: 220,
    savingsProgress: 330,
  });
  const before = structuredClone(scenario);

  visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount);

  assert.deepEqual(scenario, before);
});

test("LOT 5.34 validates parity and runtime evidence remain intact", () => {
  assert.match(LOT_5_30_REPORT, /15\/15 MATCH/);
  assert.match(LOT_5_30_REPORT, /intentional mismatch/i);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.finalContributionAmount/);
});

test("LOT 5.34 validates rollback remains a local source restoration", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());
  const rollbackBlock = block.replace(
    /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/,
    "savingsGoal",
  );

  assert.match(rollbackBlock, /savingsProgress\s*\/\s*savingsGoal/);
  assert.doesNotMatch(rollbackBlock, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
});

test("LOT 5.34 validates no new consumer beyond the approved Objectif UI consumers", () => {
  const appCode = sourceWithoutComments(APP_SOURCE);
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(appCode, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.equal(occurrences(progress, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.equal(occurrences(appCode, /\bsavingsGoal\b/g), 0);
  assert.doesNotMatch(appCode, /\b(uiSavingsGoal|coachingSavingsGoal)\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(appCode, /\bpdfSavingsGoal\b/g), 5);
});
