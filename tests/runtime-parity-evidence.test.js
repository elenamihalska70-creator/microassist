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

const MODULE_SOURCE = readFileSync(
  new URL("../src/application/shadow/runtimeParityEvidence.js", import.meta.url),
  "utf8",
);

const STANDARD_NON_ACRE_INPUT = Object.freeze({
  revenues: Object.freeze([
    Object.freeze({
      id: "standard-non-acre-r1",
      amount: 1000,
      date: "2026-07-15",
      revenueCategory: "service",
    }),
  ]),
  fiscalProfile: Object.freeze({
    activity_type: "services",
    acre: "no",
    acre_start_date: null,
  }),
  period: Object.freeze({}),
  referenceDate: "2026-07-30",
});

const MATCHING_SHADOW_RESULT = Object.freeze({
  revenue: Object.freeze({
    total: 1000,
  }),
  summary: Object.freeze({
    baseAmount: 1000,
    finalContributionAmount: 220,
    effectiveRate: 0.22,
  }),
  contributions: Object.freeze({
    acre: Object.freeze({
      acreStatus: "inactive",
    }),
  }),
});

const MATCHING_LEGACY_SNAPSHOT = Object.freeze({
  revenueTotal: 1000,
  estimatedAmount: 220,
  rate: 0.22,
  acreStatus: "inactive",
});

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function createMatchingEvidence(overrides = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "standard non-ACRE activity",
    legacySnapshot: MATCHING_LEGACY_SNAPSHOT,
    shadowResult: MATCHING_SHADOW_RESULT,
    shadowInput: buildFiscalSummaryInput(STANDARD_NON_ACRE_INPUT),
    observedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  });
}

test("collects runtime parity evidence when active", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: true });
  const evidence = createMatchingEvidence();
  const result = store.record(evidence);

  assert.equal(result.accepted, true);
  assert.equal(result.evidence.status, SHADOW_PARITY_MATCH);
  assert.equal(result.entries.length, 1);
  assert.equal(store.read().length, 1);
});

test("records MATCH with compared fields and reproduction input", () => {
  const evidence = createMatchingEvidence();

  assert.equal(evidence.status, SHADOW_PARITY_MATCH);
  assert.deepEqual(
    evidence.checks.map((check) => [check.name, check.status]),
    [
      ["revenue.total", SHADOW_PARITY_MATCH],
      ["summary.baseAmount", SHADOW_PARITY_MATCH],
      ["summary.finalContributionAmount", SHADOW_PARITY_MATCH],
      ["summary.effectiveRate", SHADOW_PARITY_MATCH],
      ["acre.status", SHADOW_PARITY_MATCH],
    ],
  );
  assert.equal(evidence.scenarioId, "standard non-ACRE activity");
  assert.equal(evidence.observedAt, "2026-07-30T00:00:00.000Z");
  assert.equal(evidence.referenceDate, "2026-07-30");
  assert.deepEqual(evidence.reproduction.shadowInput, {
    revenues: [
      {
        id: "standard-non-acre-r1",
        amount: 1000,
        date: "2026-07-15",
        revenueCategory: "service",
      },
    ],
    fiscalProfile: {
      activityType: "services",
      acre: "no",
      acreStartDate: null,
    },
    period: {},
    referenceDate: "2026-07-30",
  });
});

test("covers the LOT 5.8 scenario names with deterministic evidence records", () => {
  const scenarios = [
    {
      scenarioId: "standard non-ACRE activity",
      legacySnapshot: MATCHING_LEGACY_SNAPSHOT,
      shadowResult: MATCHING_SHADOW_RESULT,
    },
    {
      scenarioId: "ACRE active",
      legacySnapshot: {
        revenueTotal: 1000,
        estimatedAmount: 110,
        rate: 0.11,
        acreStatus: "active",
      },
      shadowResult: {
        revenue: { total: 1000 },
        summary: {
          baseAmount: 1000,
          finalContributionAmount: 110,
          effectiveRate: 0.11,
        },
        contributions: { acre: { acreStatus: "active" } },
      },
    },
    {
      scenarioId: "ACRE expired",
      legacySnapshot: {
        revenueTotal: 1000,
        estimatedAmount: 220,
        rate: 0.22,
        acreStatus: "expired",
      },
      shadowResult: {
        revenue: { total: 1000 },
        summary: {
          baseAmount: 1000,
          finalContributionAmount: 220,
          effectiveRate: 0.22,
        },
        contributions: { acre: { acreStatus: "expired" } },
      },
    },
    {
      scenarioId: "missing ACRE start date",
      legacySnapshot: {
        revenueTotal: 1000,
        estimatedAmount: 220,
        rate: 0.22,
        acreStatus: "inactive",
      },
      shadowResult: {
        revenue: { total: 1000 },
        summary: {
          baseAmount: 1000,
          finalContributionAmount: 220,
          effectiveRate: 0.22,
        },
        contributions: { acre: { acreStatus: "inactive" } },
      },
    },
    {
      scenarioId: "multiple revenues",
      legacySnapshot: {
        revenueTotal: 1500,
        estimatedAmount: 330,
        rate: 0.22,
        acreStatus: "inactive",
      },
      shadowResult: {
        revenue: { total: 1500 },
        summary: {
          baseAmount: 1500,
          finalContributionAmount: 330,
          effectiveRate: 0.22,
        },
        contributions: { acre: { acreStatus: "inactive" } },
      },
    },
    {
      scenarioId: "empty revenues",
      legacySnapshot: {
        revenueTotal: 0,
        estimatedAmount: 0,
        rate: 0.22,
        acreStatus: "inactive",
      },
      shadowResult: {
        revenue: { total: 0 },
        summary: {
          baseAmount: 0,
          finalContributionAmount: 0,
          effectiveRate: 0.22,
        },
        contributions: { acre: { acreStatus: "inactive" } },
      },
    },
  ];

  const shadowInput = buildFiscalSummaryInput(STANDARD_NON_ACRE_INPUT);
  const evidenceRecords = scenarios.map((scenario) =>
    createRuntimeParityEvidence({
      ...scenario,
      shadowInput,
      observedAt: "2026-07-30T00:00:00.000Z",
    }),
  );

  assert.deepEqual(
    evidenceRecords.map((evidence) => [evidence.scenarioId, evidence.status]),
    scenarios.map((scenario) => [scenario.scenarioId, SHADOW_PARITY_MATCH]),
  );
});

test("records MISMATCH without hidden normalization or tolerance", () => {
  const evidence = createMatchingEvidence({
    legacySnapshot: {
      ...MATCHING_LEGACY_SNAPSHOT,
      estimatedAmount: 221,
    },
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
  assert.equal(evidence.checks[2].legacyValue, 221);
  assert.equal(evidence.checks[2].shadowValue, 220);
});

test("does not collect evidence when disabled", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: false });
  const result = store.record(createMatchingEvidence());

  assert.equal(result.accepted, false);
  assert.equal(result.evidence, null);
  assert.deepEqual(result.entries, []);
  assert.deepEqual(store.read(), []);
});

test("can be disabled after active collection without affecting report determinism", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: true });
  const evidence = createMatchingEvidence();

  assert.equal(store.record(evidence).accepted, true);
  assert.equal(store.configureEnabled(false), false);

  const disabledRecord = store.record(
    createMatchingEvidence({ scenarioId: "ACRE active" }),
  );

  assert.equal(disabledRecord.accepted, false);
  assert.deepEqual(store.read(), [evidence]);
  assert.deepEqual(createMatchingEvidence(), evidence);
});

test("does not mutate legacy snapshot, shadow result or shadow input", () => {
  const legacySnapshot = deepFreeze(structuredClone(MATCHING_LEGACY_SNAPSHOT));
  const shadowResult = deepFreeze(structuredClone(MATCHING_SHADOW_RESULT));
  const shadowInput = deepFreeze(buildFiscalSummaryInput(STANDARD_NON_ACRE_INPUT));
  const before = structuredClone({ legacySnapshot, shadowResult, shadowInput });

  createRuntimeParityEvidence({
    scenarioId: "standard non-ACRE activity",
    legacySnapshot,
    shadowResult,
    shadowInput,
    observedAt: "2026-07-30T00:00:00.000Z",
  });

  assert.deepEqual({ legacySnapshot, shadowResult, shadowInput }, before);
});

test("is deterministic for same input, cloned input and different references", () => {
  const first = createMatchingEvidence();
  const second = createMatchingEvidence();
  const cloned = createMatchingEvidence({
    legacySnapshot: structuredClone(MATCHING_LEGACY_SNAPSHOT),
    shadowResult: structuredClone(MATCHING_SHADOW_RESULT),
    shadowInput: buildFiscalSummaryInput(structuredClone(STANDARD_NON_ACRE_INPUT)),
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});

test("store returns defensive copies and no side effect changes later reports", () => {
  const store = createRuntimeParityEvidenceStore({ enabled: true, capacity: 2 });
  const first = createMatchingEvidence();
  const second = createMatchingEvidence({ scenarioId: "multiple revenues" });

  const firstRecord = store.record(first);
  firstRecord.entries[0].checks[0].status = SHADOW_PARITY_MISMATCH;
  const secondRecord = store.record(second);

  assert.equal(store.read()[0].checks[0].status, SHADOW_PARITY_MATCH);
  assert.deepEqual(secondRecord.evidence, second);
  assert.deepEqual(createMatchingEvidence(), first);
});

test("can collect evidence from the Adapter and Calculation Facade without replacing Legacy", () => {
  const shadowInput = buildFiscalSummaryInput(STANDARD_NON_ACRE_INPUT);
  const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });
  const evidence = createRuntimeParityEvidence({
    scenarioId: "standard non-ACRE activity",
    legacySnapshot: MATCHING_LEGACY_SNAPSHOT,
    shadowResult,
    shadowInput,
    observedAt: "2026-07-30T00:00:00.000Z",
  });

  assert.equal(evidence.status, SHADOW_PARITY_MATCH);
  assert.deepEqual(evidence.comparedFields, [
    "revenue.total",
    "summary.baseAmount",
    "summary.finalContributionAmount",
    "summary.effectiveRate",
    "acre.status",
  ]);
});

test("runtime parity evidence has no UI, state, persistence, network or implicit time access", () => {
  assert.doesNotMatch(MODULE_SOURCE, /\bset[A-Z]\w*\s*\(/);
  assert.doesNotMatch(MODULE_SOURCE, /\blocalStorage\b/);
  assert.doesNotMatch(MODULE_SOURCE, /\bsessionStorage\b/);
  assert.doesNotMatch(MODULE_SOURCE, /\bsupabase\b/i);
  assert.doesNotMatch(MODULE_SOURCE, /\bfetch\s*\(/);
  assert.doesNotMatch(MODULE_SOURCE, /\bconsole\.(log|info|warn|error)\b/);
  assert.doesNotMatch(MODULE_SOURCE, /\bDate\.now\b/);
  assert.doesNotMatch(MODULE_SOURCE, /\bnew\s+Date\b/);
  assert.doesNotMatch(MODULE_SOURCE, /\bMath\.random\b/);
});
