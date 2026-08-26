import assert from "node:assert/strict";
import test from "node:test";

import {
  getCurrentDeclarationView,
  getUpcomingDeclarationView,
  getLastConfirmedDeclaration,
  getDeclarationHistory,
} from "../src/domain/declarationDossier/declarationHistory.js";
import { OBLIGATION_STATUS } from "../src/domain/obligations/constants.js";

const QUARTERLY_PROFILE = Object.freeze({ declaration_frequency: "trimestriel" });

const Q1_DOSSIER = Object.freeze({
  id: "d-q1",
  user_id: "u1",
  declaration_type: "urssaf_ca",
  period_start: "2026-01-01",
  period_end: "2026-03-31",
  due_date: "2026-04-30",
  declared_at: "2026-04-20T00:00:00.000Z",
});

const Q2_DOSSIER = Object.freeze({
  id: "d-q2",
  user_id: "u1",
  declaration_type: "urssaf_ca",
  period_start: "2026-04-01",
  period_end: "2026-06-30",
  due_date: "2026-07-31",
  declared_at: "2026-07-27T00:00:00.000Z",
});

// A row that (hypothetically) exists but was never confirmed -- must never
// appear as "history".
const UNCONFIRMED_ROW = Object.freeze({
  id: "d-unconfirmed",
  user_id: "u1",
  declaration_type: "urssaf_ca",
  period_start: "2026-07-01",
  period_end: "2026-09-30",
  due_date: "2026-10-31",
  declared_at: null,
});

test("HISTORY: getCurrentDeclarationView resolves the active period and its status without a dossier", () => {
  const view = getCurrentDeclarationView({
    fiscalProfile: QUARTERLY_PROFILE,
    dossiers: [],
    referenceDate: "2026-07-29",
  });

  assert.equal(view.status, OBLIGATION_STATUS.dueSoon);
  assert.equal(view.dueDate, "2026-07-31");
  assert.equal(view.dossier, null);
  assert.equal(view.firstDeclarationUnresolved, false);
});

test("FIRST DECLARATION: a business that started AFTER the auto-selected period begins returns an explicit unresolved state, not a fabricated due/overdue claim", () => {
  const view = getCurrentDeclarationView({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-05-15" }, // mid-Q2
    dossiers: [],
    referenceDate: "2026-07-29", // current period = Q2 (Apr-Jun), which started BEFORE the business existed
  });

  assert.equal(view.firstDeclarationUnresolved, true);
  assert.equal(view.status, null);
  assert.equal(view.dueDate, null);
  assert.deepEqual(view.period, { type: "quarter", year: 2026, quarter: 2 });
});

test("FIRST DECLARATION: a business that started BEFORE the auto-selected period begins resolves normally (no false unresolved flag)", () => {
  // LOT 10.2E.1A: a confirmed Q1 dossier is the checkpoint
  // resolveActiveDeclarationPeriod() stops its backward walk at -- this
  // isolates the test to its own actual concern (the current period's
  // own resolution) rather than incidentally exercising the separate
  // missed-declaration-persistence walk (covered in
  // tests/lot-10-2e-1a-missed-declaration-persistence.test.js).
  const q1Dossier = {
    id: "d-q1",
    declaration_type: "urssaf_ca",
    period_start: "2026-01-01",
    period_end: "2026-03-31",
    declared_at: "2026-04-20T00:00:00.000Z",
  };
  const view = getCurrentDeclarationView({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2020-01-01" }, // long-established
    dossiers: [q1Dossier],
    referenceDate: "2026-07-29",
  });

  assert.equal(view.firstDeclarationUnresolved, false);
  assert.equal(view.status, OBLIGATION_STATUS.dueSoon);
});

test("FIRST DECLARATION: a business that started exactly ON the period's start date is NOT flagged unresolved (period fully applies)", () => {
  const view = getCurrentDeclarationView({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-04-01" }, // exact start of Q2
    dossiers: [],
    referenceDate: "2026-07-29",
  });

  assert.equal(view.firstDeclarationUnresolved, false);
});

test("HISTORY: getCurrentDeclarationView reflects a matching confirmed dossier", () => {
  const view = getCurrentDeclarationView({
    fiscalProfile: QUARTERLY_PROFILE,
    dossiers: [Q2_DOSSIER],
    referenceDate: "2026-07-29",
  });

  assert.equal(view.status, OBLIGATION_STATUS.declared);
  assert.equal(view.dossier.id, "d-q2");
});

test("HISTORY: getUpcomingDeclarationView is one calendar step ahead of the current period, regardless of confirmation", () => {
  const view = getUpcomingDeclarationView({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-29", // current = Q2 (Apr-Jun)
  });

  assert.deepEqual(view.period, { type: "quarter", year: 2026, quarter: 3 }); // Jul-Sep
  assert.equal(view.dueDate, "2026-10-31");
});

test("HISTORY: getLastConfirmedDeclaration returns the most recent by declared_at, not by period order or array order", () => {
  // Deliberately out-of-order array; Q2 was declared later even though Q1's
  // period comes first.
  const last = getLastConfirmedDeclaration([Q2_DOSSIER, Q1_DOSSIER]);
  assert.equal(last.id, "d-q2");
});

test("HISTORY: getLastConfirmedDeclaration returns null when nothing has ever been confirmed", () => {
  assert.equal(getLastConfirmedDeclaration([]), null);
  assert.equal(getLastConfirmedDeclaration([UNCONFIRMED_ROW]), null);
});

test("HISTORY: getDeclarationHistory orders multiple historical declarations most-recent-period-first", () => {
  const history = getDeclarationHistory([Q1_DOSSIER, Q2_DOSSIER]);
  assert.deepEqual(
    history.map((dossier) => dossier.id),
    ["d-q2", "d-q1"],
  );
});

test("HISTORY: getDeclarationHistory never includes an unconfirmed row, even if one exists", () => {
  const history = getDeclarationHistory([Q1_DOSSIER, UNCONFIRMED_ROW]);
  assert.deepEqual(
    history.map((dossier) => dossier.id),
    ["d-q1"],
  );
});

test("HISTORY: getDeclarationHistory returns an empty array, never null/undefined, when there are no dossiers", () => {
  assert.deepEqual(getDeclarationHistory([]), []);
  assert.deepEqual(getDeclarationHistory(undefined), []);
});
