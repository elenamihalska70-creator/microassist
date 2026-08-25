import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_PRIORITY_PARITY_MATCH,
  ACTION_PRIORITY_PARITY_MISMATCH,
  ACTION_PRIORITY_PARITY_FIELDS,
  buildLegacyActionPrioritySnapshot,
  buildCanonicalActionPrioritySnapshot,
  createActionPriorityParityCheck,
  createActionPriorityParityReport,
  createActionPriorityParityEvidence,
  createActionPriorityParityEvidenceStore,
} from "../src/application/shadow/actionPriorityParityEvidence.js";
import { getPrioritizedActions } from "../src/domain/obligations/index.js";

test("createActionPriorityParityCheck reports MATCH for identical primitives", () => {
  const check = createActionPriorityParityCheck("declarationStatus", "upcoming_or_unknown", "upcoming_or_unknown");
  assert.equal(check.status, ACTION_PRIORITY_PARITY_MATCH);
});

test("createActionPriorityParityCheck reports MISMATCH for different primitives", () => {
  const check = createActionPriorityParityCheck("declarationStatus", "overdue", "upcoming_or_unknown");
  assert.equal(check.status, ACTION_PRIORITY_PARITY_MISMATCH);
});

test("buildLegacyActionPrioritySnapshot normalizes legacy urgency vocabulary", () => {
  assert.deepEqual(
    buildLegacyActionPrioritySnapshot({ computed: { urgency: "late", tvaStatus: "exceeded" } }),
    { declarationStatus: "overdue", tvaStatus: "exceeded", premiumOutranksCompliance: false },
  );
  assert.deepEqual(
    buildLegacyActionPrioritySnapshot({ computed: { urgency: "soon", tvaStatus: "soon" } }),
    { declarationStatus: "due_soon", tvaStatus: "soon", premiumOutranksCompliance: false },
  );
  assert.deepEqual(
    buildLegacyActionPrioritySnapshot({ computed: {} }),
    { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false },
  );
});

test("buildLegacyActionPrioritySnapshot flags when a Premium trigger is driven by compliance urgency", () => {
  const snapshot = buildLegacyActionPrioritySnapshot({
    computed: { urgency: null, tvaStatus: "ok" },
    premiumTriggerContext: { triggerType: "declaration_urgent" },
  });
  assert.equal(snapshot.premiumOutranksCompliance, true);
});

test("buildCanonicalActionPrioritySnapshot never lets a Premium action outrank compliance by construction", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
    monthlyRevenue: 4000, // exceeded TVA -- the same condition that drives legacy's premium trigger
  });

  const snapshot = buildCanonicalActionPrioritySnapshot(actions);
  assert.equal(snapshot.declarationStatus, "upcoming_or_unknown");
  assert.equal(snapshot.tvaStatus, "exceeded");
  assert.equal(snapshot.premiumOutranksCompliance, false);
});

test("createActionPriorityParityReport MATCHes on declarationStatus/tvaStatus when legacy and canonical agree", () => {
  const legacyActionSnapshot = { declarationStatus: "due_soon", tvaStatus: "soon", premiumOutranksCompliance: false };
  const canonicalActionSnapshot = { declarationStatus: "due_soon", tvaStatus: "soon", premiumOutranksCompliance: false };

  const report = createActionPriorityParityReport(legacyActionSnapshot, canonicalActionSnapshot);
  assert.equal(report.status, ACTION_PRIORITY_PARITY_MATCH);
  assert.equal(report.checks.length, ACTION_PRIORITY_PARITY_FIELDS.length);
});

test("createActionPriorityParityReport documents the intentional premiumOutranksCompliance divergence", () => {
  // Legacy's own premium trigger fires on TVA-exceeded urgency (App.jsx
  // getPremiumTriggerContext); the canonical model structurally never lets
  // a Premium action outrank compliance (LOT 10.2B section 9). This MUST
  // read as a mismatch -- that is the fix this LOT makes, not a defect.
  const legacyActionSnapshot = { declarationStatus: "upcoming_or_unknown", tvaStatus: "exceeded", premiumOutranksCompliance: true };
  const canonicalActionSnapshot = { declarationStatus: "upcoming_or_unknown", tvaStatus: "exceeded", premiumOutranksCompliance: false };

  const report = createActionPriorityParityReport(legacyActionSnapshot, canonicalActionSnapshot);
  assert.equal(report.status, ACTION_PRIORITY_PARITY_MISMATCH);

  const premiumCheck = report.checks.find((check) => check.name === "premiumOutranksCompliance");
  assert.equal(premiumCheck.status, ACTION_PRIORITY_PARITY_MISMATCH);

  const declarationCheck = report.checks.find((check) => check.name === "declarationStatus");
  assert.equal(declarationCheck.status, ACTION_PRIORITY_PARITY_MATCH);
});

test("createActionPriorityParityEvidence produces a versioned, self-contained record", () => {
  const legacyActionSnapshot = { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false };
  const canonicalActionSnapshot = { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false };

  const evidence = createActionPriorityParityEvidence({
    scenarioId: "app.dashboard.action-priority",
    legacyActionSnapshot,
    canonicalActionSnapshot,
    observedAt: "2026-01-15",
  });

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.scenarioId, "app.dashboard.action-priority");
  assert.equal(evidence.status, ACTION_PRIORITY_PARITY_MATCH);
  assert.deepEqual(evidence.comparedFields, [...ACTION_PRIORITY_PARITY_FIELDS]);
});

test("createActionPriorityParityEvidence requires a non-empty scenario id", () => {
  assert.throws(() =>
    createActionPriorityParityEvidence({
      scenarioId: "",
      legacyActionSnapshot: {},
      canonicalActionSnapshot: {},
    }),
  );
});

test("createActionPriorityParityEvidenceStore is a no-op ring buffer when disabled", () => {
  const store = createActionPriorityParityEvidenceStore({ enabled: false });
  const evidence = createActionPriorityParityEvidence({
    scenarioId: "disabled-store",
    legacyActionSnapshot: { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false },
    canonicalActionSnapshot: { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false },
  });

  const result = store.record(evidence);
  assert.equal(result.accepted, false);
  assert.equal(store.read().length, 0);
});

test("createActionPriorityParityEvidenceStore records and caps entries by capacity when enabled", () => {
  const store = createActionPriorityParityEvidenceStore({ enabled: true, capacity: 2 });
  const makeEvidence = (scenarioId) =>
    createActionPriorityParityEvidence({
      scenarioId,
      legacyActionSnapshot: { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false },
      canonicalActionSnapshot: { declarationStatus: "upcoming_or_unknown", tvaStatus: "ok", premiumOutranksCompliance: false },
    });

  store.record(makeEvidence("scenario-1"));
  store.record(makeEvidence("scenario-2"));
  store.record(makeEvidence("scenario-3"));

  const entries = store.read();
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.scenarioId),
    ["scenario-2", "scenario-3"],
  );
});
