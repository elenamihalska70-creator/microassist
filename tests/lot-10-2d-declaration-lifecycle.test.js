import assert from "node:assert/strict";
import test from "node:test";

import { resolveDossierStatus } from "../src/domain/declarationDossier/resolveDossierStatus.js";
import { computeDeclarationDeadline } from "../src/domain/rules/declarationPeriod.js";
import { OBLIGATION_STATUS, ACTION_TYPE, PRIORITY_TIER } from "../src/domain/obligations/constants.js";
import { getPrioritizedActions } from "../src/domain/obligations/index.js";

const QUARTER_2_2026 = { type: "quarter", year: 2026, quarter: 2 }; // due 2026-07-31
const DUE_DATE = computeDeclarationDeadline({ period: QUARTER_2_2026 }).dueDate;

// ---------------------------------------------------------------------
// LIFECYCLE: pure status resolution (resolveDossierStatus)
// ---------------------------------------------------------------------

test("LIFECYCLE: upcoming (well before deadline, no dossier)", () => {
  const status = resolveDossierStatus({ dueDate: DUE_DATE, referenceDate: "2026-05-01" });
  assert.equal(status, OBLIGATION_STATUS.upcoming);
});

test("LIFECYCLE: due soon (within the warning window, no dossier)", () => {
  const status = resolveDossierStatus({ dueDate: DUE_DATE, referenceDate: "2026-07-24" });
  assert.equal(status, OBLIGATION_STATUS.dueSoon);
});

test("LIFECYCLE: due (deadline day, no dossier)", () => {
  const status = resolveDossierStatus({ dueDate: DUE_DATE, referenceDate: "2026-07-31" });
  assert.equal(status, OBLIGATION_STATUS.due);
});

test("LIFECYCLE: overdue (past deadline, no dossier)", () => {
  const status = resolveDossierStatus({ dueDate: DUE_DATE, referenceDate: "2026-08-05" });
  assert.equal(status, OBLIGATION_STATUS.overdue);
});

test("LIFECYCLE: a declared_at fact overrides OVERDUE -- confirming late still reads as DECLARED, not still-overdue", () => {
  const status = resolveDossierStatus({
    dueDate: DUE_DATE,
    referenceDate: "2026-08-05", // would be OVERDUE without a dossier
    declaredAt: "2026-08-04T00:00:00.000Z",
  });
  assert.equal(status, OBLIGATION_STATUS.declared);
});

test("LIFECYCLE: declared_at overrides UPCOMING too -- an early, on-time confirmation still reads as DECLARED", () => {
  const status = resolveDossierStatus({
    dueDate: DUE_DATE,
    referenceDate: "2026-05-01",
    declaredAt: "2026-04-28T00:00:00.000Z",
  });
  assert.equal(status, OBLIGATION_STATUS.declared);
});

test("LIFECYCLE: paid_at is DECLARED's own separate, higher fact -- never implied by declared_at alone", () => {
  const declaredOnly = resolveDossierStatus({
    dueDate: DUE_DATE,
    referenceDate: "2026-08-05",
    declaredAt: "2026-08-04T00:00:00.000Z",
  });
  assert.equal(declaredOnly, OBLIGATION_STATUS.declared);
  assert.notEqual(declaredOnly, OBLIGATION_STATUS.paid);

  const declaredAndPaid = resolveDossierStatus({
    dueDate: DUE_DATE,
    referenceDate: "2026-08-05",
    declaredAt: "2026-08-04T00:00:00.000Z",
    paidAt: "2026-08-06T00:00:00.000Z",
  });
  assert.equal(declaredAndPaid, OBLIGATION_STATUS.paid);
});

// ---------------------------------------------------------------------
// LIFECYCLE: canonical obligation model integration (LOT 10.2D section 11)
// ---------------------------------------------------------------------

const QUARTERLY_PROFILE = Object.freeze({
  activity_type: "services",
  acre: "no",
  acre_start_date: null,
  business_start_date: null,
  declaration_frequency: "trimestriel",
});

// July 2026 is Q2's one-month declaration WINDOW (see
// tests/lot-10-2c-declaration-deadline-lifecycle.test.js for the full
// window-month matrix). referenceDate 2026-07-29 is 2 days before the
// 31 July deadline -- DUE_SOON at the mandatory-immediate tier, and, per
// LOT 10.2C's own findings, the closest reachable-through-real-dates state
// to "urgent" via the auto-selecting integration layer (sustained OVERDUE
// is not reachable there by design: no persisted state means the model
// advances to a fresh upcoming period the day after a window closes,
// rather than continuing to show a missed period as indefinitely overdue).
const Q2_WINDOW_REFERENCE_DATE = "2026-07-29";

test("INTEGRATION: before confirmation, an urgent quarterly declaration ranks at the top (mandatory-immediate tier)", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE, // Q2 due 31 Jul 2026, 2 days out, no dossier
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.ok(declarationAction);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.dueSoon);
  assert.equal(declarationAction.priorityTier, PRIORITY_TIER.mandatoryImmediate);
  assert.equal(actions[0].id, declarationAction.id);
});

test("INTEGRATION: after the user confirms, that exact period no longer ranks as an active urgent action", () => {
  const dossier = {
    id: "dossier-1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-27T00:00:00.000Z",
    paid_at: null,
    calculated_revenue: 1500,
    estimated_contributions: 330,
    declared_revenue: 1500,
    actual_contributions: null,
  };

  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE, // same date that was DUE_SOON above
    declarationDossiers: [dossier],
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.ok(declarationAction);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.declared);
  // No longer at the mandatory-immediate tier -- confirmed, calm,
  // informational instead of an active compliance risk.
  assert.equal(declarationAction.priorityTier, PRIORITY_TIER.informationalGuidance);
  assert.notEqual(declarationAction.priorityTier, PRIORITY_TIER.mandatoryImmediate);
});

test("INTEGRATION: a confirmed declaration never outranks a genuinely urgent, DIFFERENT compliance action (e.g. TVA exceeded)", () => {
  const dossier = {
    id: "dossier-1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-27T00:00:00.000Z",
  };

  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossiers: [dossier],
    monthlyRevenue: 4000, // exceeds the VAT threshold
  });

  const tvaAction = actions.find((action) => action.type === ACTION_TYPE.tvaThreshold);
  assert.ok(tvaAction);
  assert.equal(actions[0].id, tvaAction.id);
});

test("INTEGRATION: a PAID dossier surfaces as PAID, not merely DECLARED, in the canonical model", () => {
  const dossier = {
    id: "dossier-1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-27T00:00:00.000Z",
    paid_at: "2026-07-28T00:00:00.000Z",
    actual_contributions: 325.4,
  };

  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossiers: [dossier],
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.paid);
  assert.equal(declarationAction.amount, 325.4); // the user-confirmed actual amount, not a re-derived estimate
  assert.equal(declarationAction.amountKind, "actual");
});

test("INTEGRATION: confirming a DIFFERENT period's dossier does not affect the current period's own status", () => {
  // Q1's dossier is confirmed; today's relevant period (auto-selected) is
  // still Q2, genuinely due soon and unrelated to Q1's own confirmation.
  const q1Dossier = {
    id: "dossier-q1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-01-01",
    period_end: "2026-03-31",
    due_date: "2026-04-30",
    declared_at: "2026-04-20T00:00:00.000Z",
  };

  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE, // relevant period is Q2, due soon -- unrelated to Q1's dossier
    declarationDossiers: [q1Dossier],
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.dueSoon); // Q2 still genuinely due soon
  assert.equal(declarationAction.metadata.dossierId, null); // no dossier for Q2
});
