import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import {
  createRuntimeParityEvidence,
  createRuntimeParityEvidenceStore,
  SHADOW_PARITY_MATCH,
  SHADOW_PARITY_MISMATCH,
} from "../src/application/shadow/runtimeParityEvidence.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";
import { computeObligations } from "../src/utils/obligations.js";

const EVIDENCE_SOURCE = readFileSync(
  new URL("../src/application/shadow/runtimeParityEvidence.js", import.meta.url),
  "utf8",
);
const TEST_SOURCE = readFileSync(new URL(import.meta.url), "utf8");
const FIXED_NOW_ISO = "2026-07-30T12:00:00.000Z";
const FIXED_REFERENCE_DATE = "2026-07-30";
const FIRST_SLICE_FIELDS = Object.freeze([
  "revenue.total",
  "summary.baseAmount",
  "summary.finalContributionAmount",
  "summary.effectiveRate",
  "acre.status",
]);

const RealDate = Date;

const SCENARIOS = Object.freeze([
  {
    id: "revenue-null-service-acre-inactive",
    description: "revenu nul, service, ACRE inactive",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "revenue-positive-service-acre-inactive",
    description: "revenu positif simple, service, ACRE inactive",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "multiple-revenues-service-acre-inactive",
    description: "plusieurs revenus, service, ACRE inactive",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [
      { id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" },
      { id: "r2", amount: 2500, date: "2026-07-20", revenueCategory: "service" },
    ],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "commerce-acre-inactive",
    description: "type activite vente, ACRE inactive",
    activityType: "commerce",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "vente" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "mixed-activity-acre-inactive",
    description: "activite mixte supportee, ACRE inactive",
    activityType: "mixte",
    acre: "no",
    acreStartDate: null,
    revenues: [
      { id: "r1", amount: 700, date: "2026-07-10", revenueCategory: "vente" },
      { id: "r2", amount: 300, date: "2026-07-20", revenueCategory: "service" },
    ],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-acre-active",
    description: "ACRE active avec date explicite",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-acre-expired",
    description: "expiration ACRE avec date explicite",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2025-07-01",
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-acre-boundary-active",
    description: "valeur limite ACRE encore active",
    activityType: "services",
    acre: "yes",
    acreStartDate: "2025-08-01",
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-acre-missing-start-date",
    description: "donnees optionnelles absentes, ACRE sans date de debut",
    activityType: "services",
    acre: "yes",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-amount-low",
    description: "montant faible",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 1, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "service-amount-high",
    description: "montant eleve",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: 987654, date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "period-change-month-window",
    description: "changement de periode avec fenetre mensuelle explicite",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
    revenues: [
      { id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" },
      { id: "r2", amount: 500, date: "2026-08-02", revenueCategory: "service" },
    ],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
  {
    id: "restored-state-equivalent-values",
    description: "etat restaure avec objets distincts mais valeurs identiques",
    activityType: "services",
    acre: "no",
    acreStartDate: null,
    revenues: [{ id: "r1", amount: "1000", date: "2026-07-10", revenueCategory: "service" }],
    expectedStatus: SHADOW_PARITY_MATCH,
  },
]);

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

function createLegacySnapshot(scenario) {
  const revenueTotal = revenueTotalForPeriod(
    scenario.revenues,
    scenario.period,
  );
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
    estimatedAmount: computed.estimatedAmount,
    rate: computed.rate,
    acreStatus: computed.acreStatus,
  };
}

function createScenarioEvidence(scenario) {
  const appDto = appDtoFromScenario(scenario);
  const shadowInput = buildFiscalSummaryInput(appDto);
  const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });
  const legacySnapshot = createLegacySnapshot(scenario);

  return createRuntimeParityEvidence({
    scenarioId: scenario.id,
    legacySnapshot,
    shadowResult,
    shadowInput,
    observedAt: "LOT_5_11_FIXED_OBSERVATION",
  });
}

function runWithFixedDate(callback) {
  installFixedDate(FIXED_NOW_ISO);

  try {
    return callback();
  } finally {
    restoreDate();
  }
}

function assertAllFieldsMatch(evidence) {
  assert.equal(evidence.status, SHADOW_PARITY_MATCH);
  assert.deepEqual(evidence.comparedFields, FIRST_SLICE_FIELDS);

  for (const check of evidence.checks) {
    assert.equal(check.status, SHADOW_PARITY_MATCH, check.name);
  }
}

test("LOT 5.11 produces reproducible MATCH evidence for every approved scenario", () => {
  const results = runWithFixedDate(() => SCENARIOS.map(createScenarioEvidence));

  assert.deepEqual(
    results.map((evidence) => evidence.scenarioId),
    SCENARIOS.map((scenario) => scenario.id),
  );

  for (const evidence of results) {
    assertAllFieldsMatch(evidence);
    assert.equal(evidence.observedAt, "LOT_5_11_FIXED_OBSERVATION");
    assert.equal(evidence.referenceDate, FIXED_REFERENCE_DATE);
  }
});

test("LOT 5.11 detects and preserves MISMATCH without correction", () => {
  const evidence = runWithFixedDate(() => {
    const scenario = SCENARIOS.find(
      (candidate) => candidate.id === "revenue-positive-service-acre-inactive",
    );
    const appDto = appDtoFromScenario(scenario);
    const shadowInput = buildFiscalSummaryInput(appDto);
    const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });
    const legacySnapshot = {
      ...createLegacySnapshot(scenario),
      estimatedAmount: 999,
    };

    return createRuntimeParityEvidence({
      scenarioId: "intentional-mismatch-final-contribution",
      legacySnapshot,
      shadowResult,
      shadowInput,
      observedAt: "LOT_5_11_FIXED_OBSERVATION",
    });
  });

  assert.equal(evidence.status, SHADOW_PARITY_MISMATCH);
  assert.deepEqual(
    evidence.checks.map((check) => [check.name, check.status]),
    [
      ["revenue.total", SHADOW_PARITY_MATCH],
      ["summary.baseAmount", SHADOW_PARITY_MATCH],
      ["summary.finalContributionAmount", SHADOW_PARITY_MISMATCH],
      ["summary.effectiveRate", SHADOW_PARITY_MATCH],
      ["acre.status", SHADOW_PARITY_MATCH],
    ],
  );
  assert.equal(evidence.checks[2].legacyValue, 999);
  assert.equal(evidence.checks[2].shadowValue, 220);
});

test("LOT 5.11 same input, cloned input and distinct references remain deterministic", () => {
  const scenario = SCENARIOS.find(
    (candidate) => candidate.id === "service-acre-active",
  );
  const first = runWithFixedDate(() => createScenarioEvidence(scenario));
  const second = runWithFixedDate(() => createScenarioEvidence(scenario));
  const cloned = runWithFixedDate(() =>
    createScenarioEvidence(structuredClone(scenario)),
  );
  const distinctReferences = runWithFixedDate(() =>
    createScenarioEvidence({
      ...scenario,
      revenues: scenario.revenues.map((revenue) => ({ ...revenue })),
    }),
  );

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
  assert.deepEqual(first, distinctReferences);
});

test("LOT 5.11 does not mutate legacy, shadow or input data", () => {
  const scenario = deepFreeze(
    structuredClone(
      SCENARIOS.find((candidate) => candidate.id === "multiple-revenues-service-acre-inactive"),
    ),
  );
  const appDto = deepFreeze(appDtoFromScenario(scenario));
  const before = structuredClone({ scenario, appDto });

  runWithFixedDate(() => {
    const shadowInput = deepFreeze(buildFiscalSummaryInput(appDto));
    const shadowResult = deepFreeze(calculateFiscalSummary(shadowInput, { trace: false }));
    const legacySnapshot = deepFreeze(createLegacySnapshot(scenario));
    const evidence = createRuntimeParityEvidence({
      scenarioId: scenario.id,
      legacySnapshot,
      shadowResult,
      shadowInput,
      observedAt: "LOT_5_11_FIXED_OBSERVATION",
    });

    assertAllFieldsMatch(evidence);
  });

  assert.deepEqual({ scenario, appDto }, before);
});

test("LOT 5.11 disabled evidence store has no application effect", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: false });
  const evidence = runWithFixedDate(() => createScenarioEvidence(SCENARIOS[0]));
  const result = store.record(evidence);

  assert.equal(result.accepted, false);
  assert.equal(result.evidence, null);
  assert.deepEqual(result.entries, []);
  assert.deepEqual(store.read(), []);
});

test("LOT 5.11 evidence order is stable across successive changes", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: true });
  const results = runWithFixedDate(() => SCENARIOS.map(createScenarioEvidence));

  for (const evidence of results) {
    store.record(evidence);
  }

  assert.deepEqual(
    store.read().map((evidence) => evidence.scenarioId),
    SCENARIOS.map((scenario) => scenario.id),
  );
  assert.deepEqual(
    store.read()[0].checks.map((check) => check.name),
    FIRST_SLICE_FIELDS,
  );
});

test("LOT 5.11 harness and evidence module avoid forbidden external dependencies", () => {
  for (const source of [EVIDENCE_SOURCE, TEST_SOURCE]) {
    assert.doesNotMatch(source, /\blocalStorage\b/);
    assert.doesNotMatch(source, /\bsessionStorage\b/);
    assert.doesNotMatch(source, /\bsupabase\b/i);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\bMath\.random\b/);
  }

  assert.doesNotMatch(EVIDENCE_SOURCE, /\bDate\.now\b/);
  assert.doesNotMatch(EVIDENCE_SOURCE, /\bnew\s+Date\b/);
});
