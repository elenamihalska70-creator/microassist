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
const LOT_5_29_SOURCE = readFileSync(
  new URL("./lot-5-29-savingsgoal-architecture-hardening.test.js", import.meta.url),
  "utf8",
);

const FIXED_NOW_ISO = "2026-07-30T12:00:00.000Z";
const FIXED_REFERENCE_DATE = "2026-07-30";
const MATCH = "MATCH";
const MISMATCH = "MISMATCH";
const RealDate = globalThis.Date;

const APPROVED_SCENARIOS = Object.freeze([
  {
    id: "zero-revenue-service-acre-inactive",
    description: "zero revenue",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [],
  },
  {
    id: "positive-simple-service-acre-inactive",
    description: "positive simple",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "multiple-revenues-service-acre-inactive",
    description: "multiple revenues",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [
      { id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" },
      { id: "r2", amount: 2500, date: "2026-07-20", revenueCategory: "service" },
    ],
  },
  {
    id: "service-activity-acre-inactive",
    description: "service",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1600, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "sale-activity-acre-inactive",
    description: "sale",
    activityType: "commerce",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1600, date: "2026-07-10", revenueCategory: "vente" }],
  },
  {
    id: "mixed-activity-acre-inactive",
    description: "mixed if supported",
    activityType: "mixte",
    acre: "no",
    acreStartDate: null,
    revenues: [
      { id: "r1", amount: 700, date: "2026-07-10", revenueCategory: "vente" },
      { id: "r2", amount: 300, date: "2026-07-20", revenueCategory: "service" },
    ],
  },
  {
    id: "acre-inactive",
    description: "ACRE inactive",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "acre-active",
    description: "ACRE active",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "acre-expired",
    description: "ACRE expired if supported",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2025-07-01",
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "effective-rate-zero",
    description: "effective rate zero",
    activityType: "",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "decimal-amount",
    description: "decimal amount",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000.5, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "period-change-month-window",
    description: "period change",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
    revenues: [
      { id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" },
      { id: "r2", amount: 500, date: "2026-08-02", revenueCategory: "service" },
    ],
  },
  {
    id: "same-input-twice",
    description: "same input twice",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1234, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "cloned-input",
    description: "cloned input",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    revenues: [{ id: "r1", amount: 1234, date: "2026-07-10", revenueCategory: "service" }],
  },
  {
    id: "different-refs-same-values",
    description: "different refs same values",
    activityType: "commerce",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: "987", date: "2026-07-10", revenueCategory: "vente" }],
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

function coachingSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.79A coaching boundary: source-only denominator migration.",
    '    if (\n      !smartAlertIds.has("acre-ending")',
  );
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

function revenueTotalForPeriod(revenues, period = {}) {
  return revenues.reduce((total, revenue) => {
    if (period.startDate && revenue.date < period.startDate) return total;
    if (period.endDate && revenue.date > period.endDate) return total;
    return total + Number(revenue.amount || 0);
  }, 0);
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

function createLegacyUiSnapshot(scenario) {
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

  return {
    revenueTotal,
    rate: computed.rate,
    acreStatus: computed.acreStatus,
    legacyUiAmount: computed?.rate ? Math.round(revenueTotal * computed.rate) : 0,
    savingsGoal: Math.max((computed?.rate ? Math.round(revenueTotal * computed.rate) : 0) * 3, 500),
  };
}

function createShadowCandidateSnapshot(scenario) {
  const appDto = appDtoFromScenario(scenario);
  const shadowInput = buildFiscalSummaryInput(appDto);
  const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });

  return {
    appDto,
    shadowInput,
    shadowResult,
    shadowCandidateAmount: shadowResult.summary.finalContributionAmount,
    effectiveRate: shadowResult.summary.effectiveRate,
    acreStatus: shadowResult.contributions.acre.acreStatus,
  };
}

function createUiParityEvidence(scenario, options = {}) {
  const legacy = createLegacyUiSnapshot(scenario);
  const shadow = createShadowCandidateSnapshot(scenario);
  const shadowCandidateAmount =
    options.shadowCandidateAmount ?? shadow.shadowCandidateAmount;

  return {
    scenarioId: scenario.id,
    legacyUiAmount: legacy.legacyUiAmount,
    shadowCandidateAmount,
    savingsGoal: legacy.savingsGoal,
    effectiveRate: shadow.effectiveRate,
    status: Object.is(legacy.legacyUiAmount, shadowCandidateAmount) ? MATCH : MISMATCH,
  };
}

function approvedEvidence() {
  return runWithFixedDate(() => APPROVED_SCENARIOS.map(createUiParityEvidence));
}

test("LOT 5.30 identifies the Legacy UI amount source", () => {
  const block = estimatedChargesBlock();

  assert.match(block, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
  assert.match(block, /\}, \[currentMonthTotal, computed\?\.rate\]\);/);
  assert.doesNotMatch(sourceWithoutComments(APP_SOURCE), /const savingsGoal = useMemo/);
});

test("LOT 5.30 identifies the Shadow finalContributionAmount candidate", () => {
  const block = visibleSliceBlock();

  assert.match(block, /finalContributionAmount: usesShadow/);
  assert.match(block, /shadowResult\.summary\.finalContributionAmount/);
  assert.match(block, /: estimatedCharges/);
});

test("LOT 5.30 approved scenario matrix produces only MATCH results", () => {
  const results = approvedEvidence();

  assert.equal(results.length, 15);
  for (const result of results) {
    assert.equal(result.status, MATCH, result.scenarioId);
    assert.equal(result.legacyUiAmount, result.shadowCandidateAmount, result.scenarioId);
  }
});

test("LOT 5.30 intentional mismatch is detected and preserved", () => {
  const scenario = APPROVED_SCENARIOS.find((candidate) => candidate.id === "positive-simple-service-acre-inactive");
  const evidence = runWithFixedDate(() =>
    createUiParityEvidence(scenario, { shadowCandidateAmount: 221 }),
  );

  assert.equal(evidence.status, MISMATCH);
  assert.equal(evidence.legacyUiAmount, 220);
  assert.equal(evidence.shadowCandidateAmount, 221);
});

test("LOT 5.30 same input produces the same result", () => {
  const scenario = APPROVED_SCENARIOS.find((candidate) => candidate.id === "same-input-twice");
  const first = runWithFixedDate(() => createUiParityEvidence(scenario));
  const second = runWithFixedDate(() => createUiParityEvidence(scenario));

  assert.deepEqual(first, second);
});

test("LOT 5.30 cloned input produces the same result", () => {
  const scenario = APPROVED_SCENARIOS.find((candidate) => candidate.id === "cloned-input");
  const original = runWithFixedDate(() => createUiParityEvidence(scenario));
  const cloned = runWithFixedDate(() => createUiParityEvidence(structuredClone(scenario)));

  assert.deepEqual(original, cloned);
});

test("LOT 5.30 does not mutate Legacy inputs", () => {
  const scenario = deepFreeze(structuredClone(APPROVED_SCENARIOS[2]));
  const before = structuredClone(scenario);

  runWithFixedDate(() => createLegacyUiSnapshot(scenario));

  assert.deepEqual(scenario, before);
});

test("LOT 5.30 does not mutate Shadow inputs", () => {
  const scenario = deepFreeze(structuredClone(APPROVED_SCENARIOS[2]));
  const appDto = deepFreeze(appDtoFromScenario(scenario));
  const before = structuredClone({ scenario, appDto });

  runWithFixedDate(() => {
    const shadowInput = deepFreeze(buildFiscalSummaryInput(appDto));
    const shadowInputBefore = structuredClone(shadowInput);
    calculateFiscalSummary(shadowInput, { trace: false });
    assert.deepEqual(shadowInput, shadowInputBefore);
  });

  assert.deepEqual({ scenario, appDto }, before);
});

test("LOT 5.30 adds no Shadow read to coaching", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|shadowResult|finalContributionAmount/);
});

test("LOT 5.30 adds no Shadow read to PDF export", () => {
  const block = sourceWithoutComments(pdfSavingsGoalBranch());

  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|shadowResult|finalContributionAmount/);
});

test("LOT 5.30 confirms root savingsGoal removed and both active aliases keep their formula", () => {
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

test("LOT 5.30 keeps estimatedCharges unchanged", () => {
  const block = estimatedChargesBlock();

  assert.match(block, /if \(computed\?\.rate\) \{/);
  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
});

test("LOT 5.30 adds no new rounding to the isolated UI parity path", () => {
  const code = sourceWithoutComments(
    [estimatedChargesBlock(), progressIndicatorsBlock(), pdfSavingsGoalBranch()].join("\n"),
  );

  assert.equal(occurrences(code, /Math\.round\(currentMonthTotal \* computed\.rate\)/g), 1);
  assert.equal(occurrences(code, /Math\.max\(estimatedCharges \* 3, 500\)/g), 0);
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 2);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/g), 0);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100 \|\| 0\)/g), 0);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/g), 1);
});

test("LOT 5.30 adds no new fallback to the isolated UI parity path", () => {
  const code = sourceWithoutComments(
    [estimatedChargesBlock(), progressIndicatorsBlock()].join("\n"),
  );

  assert.doesNotMatch(code, /\?\?\s*(fiscalSummaryVisibleSlice|finalContributionAmount|estimatedCharges)/);
  assert.doesNotMatch(code, /\|\|\s*(fiscalSummaryVisibleSlice|finalContributionAmount|estimatedCharges)/);
});

test("LOT 5.30 keeps persistence unchanged", () => {
  assert.doesNotMatch(coachingSavingsGoalBranch(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(pdfSavingsGoalBranch(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(progressIndicatorsBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
});

test("LOT 5.30 keeps payloads unchanged", () => {
  assert.doesNotMatch(coachingSavingsGoalBranch(), /payload/i);
  assert.doesNotMatch(pdfSavingsGoalBranch(), /payload/i);
  assert.doesNotMatch(progressIndicatorsBlock(), /payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(APP_SOURCE, /function isSameFiscalProfilePayload\(payload, currentProfile\)/);
});

test("LOT 5.30 keeps assistant unchanged", () => {
  assert.doesNotMatch(coachingSavingsGoalBranch(), /assistant/i);
  assert.doesNotMatch(pdfSavingsGoalBranch(), /assistant/i);
  assert.doesNotMatch(progressIndicatorsBlock(), /assistant/i);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.30 keeps Legacy Retention intact", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.match(LOT_5_29_SOURCE, /LOT 5\.29 keeps Legacy retention/);
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences); estimatedCharges
  // drops by 2 (formula body + dependency array) as a direct consequence.
  assert.equal(occurrences(code, /\bsavingsGoal\b/g), 0);
  assert.equal(occurrences(code, /\bestimatedCharges\b/g), 12);
  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), 15);
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    1,
  );
  assert.doesNotMatch(code, /\buiSavingsGoal\b|\bcoachingSavingsGoal\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(code, /\bpdfSavingsGoal\b/g), 5);
});

test("LOT 5.30 covers successive revenue changes and distinct references", () => {
  const base = APPROVED_SCENARIOS.find((candidate) => candidate.id === "different-refs-same-values");
  const changed = [100, 200, 300].map((amount) => ({
    ...base,
    id: `successive-revenue-change-${amount}`,
    revenues: [{ id: "r1", amount, date: "2026-07-10", revenueCategory: "vente" }],
  }));
  const firstReference = { ...base, revenues: base.revenues.map((revenue) => ({ ...revenue })) };
  const secondReference = { ...base, revenues: base.revenues.map((revenue) => ({ ...revenue })) };

  const results = runWithFixedDate(() => [
    ...changed.map(createUiParityEvidence),
    createUiParityEvidence(firstReference),
    createUiParityEvidence(secondReference),
  ]);

  for (const result of results) {
    assert.equal(result.status, MATCH, result.scenarioId);
  }

  assert.deepEqual(results.at(-2), results.at(-1));
});
