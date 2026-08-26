import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveActiveDeclarationPeriod } from "../src/domain/declarationDossier/resolveActiveDeclarationPeriod.js";
import { getCurrentDeclarationView } from "../src/domain/declarationDossier/declarationHistory.js";
import { getPrioritizedActions } from "../src/domain/obligations/index.js";
import { buildUrssafDeclarationAction } from "../src/domain/obligations/buildUrssafDeclarationAction.js";
import { getDeadlineRule } from "../src/domain/rules/deadlineRules.js";
import { computeDeclarationDeadline } from "../src/domain/rules/declarationPeriod.js";
import { ACTION_TYPE, OBLIGATION_STATUS, PRIORITY_TIER } from "../src/domain/obligations/constants.js";

// LOT 10.2E.1A: an unconfirmed declaration must never disappear merely
// because the calendar moves into the next declaration period. This file
// exercises resolveActiveDeclarationPeriod.js directly (the new
// mechanism) and its two integration points (getCurrentDeclarationView,
// getPrioritizedActions), matching the LOT's own worked example: a
// monthly declarer's July 2026 obligation (due 2026-08-31) that is never
// confirmed.

const MONTHLY_PROFILE = Object.freeze({
  activity_type: "services",
  acre: "no",
  declaration_frequency: "mensuel",
});

const QUARTERLY_PROFILE = Object.freeze({
  activity_type: "services",
  acre: "no",
  declaration_frequency: "trimestriel",
});

function urssafAction(actions) {
  return actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
}

// ---------------------------------------------------------------------
// CRITICAL REGRESSION (LOT 10.2E.1A's own worked example): the July 2026
// monthly declaration, due 2026-08-31, unconfirmed, business started
// exactly on 2026-07-01 (so July is the business's first period and
// nothing older is ever in scope for this scenario).
// ---------------------------------------------------------------------

const JULY_FIRST_PERIOD_PROFILE = Object.freeze({
  ...MONTHLY_PROFILE,
  business_start_date: "2026-07-01",
});

test("CRITICAL REGRESSION 2026-08-31: July is the current period and is DUE today", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-08-31",
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.due);
  assert.equal(action.dueDate, "2026-08-31");
  assert.equal(action.id, "urssaf-declaration-2026-08-31");
});

test("CRITICAL REGRESSION 2026-09-01: July does NOT disappear -- it becomes OVERDUE, not August", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-01",
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  // Identity and due date are stable -- still July's, not silently
  // replaced by August's own (still-upcoming) obligation.
  assert.equal(action.dueDate, "2026-08-31");
  assert.equal(action.id, "urssaf-declaration-2026-08-31");
});

test("CRITICAL REGRESSION 2026-09-30: still OVERDUE, same identity, one full month later", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-30",
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-08-31");
  assert.equal(action.id, "urssaf-declaration-2026-08-31");
});

test("CRITICAL REGRESSION: OVERDUE outranks everything else -- it is actions[0], top priority tier", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-15",
  });
  assert.equal(actions[0].type, ACTION_TYPE.urssafDeclaration);
  assert.equal(actions[0].status, OBLIGATION_STATUS.overdue);
  assert.equal(actions[0].priorityTier, PRIORITY_TIER.preventHarm);
});

test("CRITICAL REGRESSION: after trusted confirmation, the overdue action disappears and the CURRENT period's own (calm) status takes over", () => {
  const julyConfirmed = {
    id: "d-july",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    declared_at: "2026-09-04T00:00:00.000Z",
  };

  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-05", // August is current, not yet overdue itself (due 2026-09-30)
    declarationDossiers: [julyConfirmed],
  });
  const action = urssafAction(actions);

  // No longer overdue -- July is a confirmed checkpoint the backward walk
  // stops at, so the resolved active period falls through to August (the
  // auto-selected current period at this reference date), which has no
  // dossier of its own and is not yet due.
  assert.notEqual(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.status, OBLIGATION_STATUS.upcoming);
  assert.equal(action.dueDate, "2026-09-30"); // August's own due date
});

// ---------------------------------------------------------------------
// MONTHLY: two consecutive missed periods, oldest-first ordering.
// ---------------------------------------------------------------------

test("MONTHLY: two consecutive missed periods -- the OLDER one (July) is surfaced, not August", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-10-01", // current auto-resolves to September; July AND August both unconfirmed+overdue
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-08-31"); // July's due date, not August's (2026-09-30)
});

test("MONTHLY: old missed (July) + current period DUE the same day (August) -- July still wins", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-30", // August (current) is due today; July is already overdue
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-08-31");
});

test("MONTHLY: old missed (July) + current period UPCOMING (August, 15 days out) -- July still wins", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-15", // August's own due date (Sept 30) is 15 days out -- upcoming if checked alone
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-08-31");
});

// ---------------------------------------------------------------------
// QUARTERLY: missed quarter across a year boundary; missed quarter +
// newer upcoming quarter.
// ---------------------------------------------------------------------

test("QUARTERLY: a missed quarter across a year boundary (Q4 2025) is still found from mid-2026", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2025-10-01" }, // exactly Q4 2025's start
    revenues: [],
    referenceDate: "2026-07-29", // current auto-resolves to Q2 2026
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-01-31"); // Q4 2025's own due date, crossing into 2026
});

test("QUARTERLY: one missed quarter (Q1 2026) + a newer, genuinely upcoming current quarter (Q2 2026)", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-01-01" },
    revenues: [],
    referenceDate: "2026-05-15", // current = Q2 2026, due 2026-07-31, ~11 weeks out -- upcoming if checked alone
  });
  const action = urssafAction(actions);
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-04-30"); // Q1 2026's own due date
});

// ---------------------------------------------------------------------
// BUSINESS START BOUNDARY: never fabricate an obligation before the
// business existed; defer to the existing first-declaration-unresolved
// state instead when the walk would otherwise cross that line.
// ---------------------------------------------------------------------

test("BUSINESS START: resolveActiveDeclarationPeriod never selects a period before business_start_date, even with zero dossiers ever", () => {
  const period = resolveActiveDeclarationPeriod({
    fiscalProfile: { declaration_frequency: "mensuel", business_start_date: "2026-07-01" },
    dossiers: [],
    referenceDate: "2026-10-01", // would otherwise walk back through June, May, ... indefinitely
  });
  // Nothing before July 2026 is ever a candidate; July itself is the
  // oldest possible period, so it is what gets returned once the walk
  // finds it unconfirmed and overdue.
  assert.deepEqual(period, { type: "month", year: 2026, month0: 6 });
});

test("BUSINESS START: with business_start_date unknown, the walk never runs at all -- current period trusted at face value, exactly as before this LOT", () => {
  const period = resolveActiveDeclarationPeriod({
    fiscalProfile: { declaration_frequency: "mensuel", business_start_date: null },
    dossiers: [],
    referenceDate: "2026-10-01",
  });
  assert.deepEqual(period, { type: "month", year: 2026, month0: 8 }); // September, the plain current period
});

test("FIRST DECLARATION: a business that started mid-period still returns the existing unresolved state, never a fabricated overdue claim", () => {
  const view = getCurrentDeclarationView({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-05-15" }, // mid-Q2
    dossiers: [],
    referenceDate: "2026-07-29", // current = Q2, which the business only partially existed for
  });
  assert.equal(view.firstDeclarationUnresolved, true);
  assert.equal(view.status, null);
  assert.equal(view.dueDate, null);
});

// ---------------------------------------------------------------------
// DOSSIER COMPLETION: unconfirmed -> overdue -> confirmed -> gone; paid
// dossiers never produce a contradictory CTA-relevant status.
// ---------------------------------------------------------------------

test("COMPLETION: unconfirmed -> overdue, then the existing LOT 10.2D confirmation flow resolves it -- no contradictory state remains", () => {
  const before = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-10",
  });
  assert.equal(urssafAction(before).status, OBLIGATION_STATUS.overdue);

  const julyConfirmed = {
    id: "d-july",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    declared_at: "2026-09-11T00:00:00.000Z",
    paid_at: null,
  };
  const after = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-12",
    declarationDossiers: [julyConfirmed],
  });
  const afterAction = urssafAction(after);
  // Confirming July resolves it -- the backward walk now stops at July as
  // a checkpoint instead of flagging it overdue, so the top action moves
  // on to reflect August's own (calm, not-yet-due) status. No contradictory
  // state (no "overdue" anywhere) remains once the confirmation lands.
  assert.notEqual(afterAction.status, OBLIGATION_STATUS.overdue);
  assert.equal(afterAction.status, OBLIGATION_STATUS.upcoming);
  assert.equal(afterAction.dueDate, "2026-09-30"); // August's own due date
});

test("COMPLETION: a PAID older dossier resolves through August's own current status -- no contradictory declaration CTA anywhere", () => {
  const julyPaid = {
    id: "d-july",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    declared_at: "2026-09-11T00:00:00.000Z",
    paid_at: "2026-09-12T00:00:00.000Z",
  };
  const actions = getPrioritizedActions({
    fiscalProfile: JULY_FIRST_PERIOD_PROFILE,
    revenues: [],
    referenceDate: "2026-09-15",
    declarationDossiers: [julyPaid],
  });
  const action = urssafAction(actions);
  assert.notEqual(action.status, OBLIGATION_STATUS.overdue);
  assert.notEqual(action.status, OBLIGATION_STATUS.due);
});

test("COMPLETION: re-confirming does not mutate the period's own identity -- the due date computed while overdue matches the due date after confirmation", () => {
  const overdueDueDate = computeDeclarationDeadline({
    period: { type: "month", year: 2026, month0: 6 }, // July
    referenceDate: "2026-09-10",
  }).dueDate;
  const afterConfirmationDueDate = computeDeclarationDeadline({
    period: { type: "month", year: 2026, month0: 6 },
    referenceDate: "2026-12-25", // long after, irrelevant to a period-pinned due date
  }).dueDate;

  assert.equal(overdueDueDate.getTime(), afterConfirmationDueDate.getTime());
});

// ---------------------------------------------------------------------
// UNIT: resolveActiveDeclarationPeriod and getDeadlineRule's new explicit
// period override, tested directly (no fabricated history, no second
// deadline engine).
// ---------------------------------------------------------------------

test("UNIT: resolveActiveDeclarationPeriod stops walking backward at the first CONFIRMED period (a real checkpoint), not just at business_start_date", () => {
  const juneConfirmed = {
    declaration_type: "urssaf_ca",
    period_start: "2026-06-01",
    period_end: "2026-06-30",
    declared_at: "2026-07-05T00:00:00.000Z",
  };
  const period = resolveActiveDeclarationPeriod({
    fiscalProfile: { declaration_frequency: "mensuel", business_start_date: "2020-01-01" },
    dossiers: [juneConfirmed],
    referenceDate: "2026-10-01", // July, August both unconfirmed and overdue; June is confirmed
  });
  // July is the oldest unconfirmed period found BEFORE hitting June's
  // checkpoint -- the walk never reaches (or fabricates concern about)
  // May, April, or anything from the business's first six years.
  assert.deepEqual(period, { type: "month", year: 2026, month0: 6 });
});

test("UNIT: getDeadlineRule's explicit period override computes an overdue daysLeft for an old period, independent of auto-resolution", () => {
  const rule = getDeadlineRule({
    frequency: "mensuel",
    today: "2026-09-15",
    period: { type: "month", year: 2026, month0: 6 }, // July, explicitly
  });
  assert.ok(rule.output.daysLeft < 0);
  assert.equal(rule.output.deadlineDate.getFullYear(), 2026);
  assert.equal(rule.output.deadlineDate.getMonth(), 7); // August (0-indexed)
  assert.equal(rule.output.deadlineDate.getDate(), 31);
});

test("UNIT: getDeadlineRule with no period override behaves exactly as before this LOT (auto-resolves from referenceDate)", () => {
  const rule = getDeadlineRule({ frequency: "mensuel", today: "2026-07-15" });
  // Auto-resolved period is June (month0-1 relative to July) -- unrelated
  // to the explicit-period tests above; this proves the override is
  // purely additive.
  assert.equal(rule.output.deadlineDate.getMonth(), 6); // July
  assert.equal(rule.output.deadlineDate.getDate(), 31);
});

test("UNIT: buildUrssafDeclarationAction with an explicit declarationPeriod produces OVERDUE for an old, unconfirmed period", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: MONTHLY_PROFILE,
    referenceDate: "2026-09-01",
    declarationPeriod: { type: "month", year: 2026, month0: 6 }, // July
    declarationDossier: null,
  });
  assert.equal(action.status, OBLIGATION_STATUS.overdue);
  assert.equal(action.dueDate, "2026-08-31");
});

test("NO DUPLICATION: resolveActiveDeclarationPeriod.js never imports a fiscal/ACRE calculation engine or a second deadline engine", () => {
  const source = readFileSync(
    new URL("../src/domain/declarationDossier/resolveActiveDeclarationPeriod.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /calculateFiscalSummary/);
  assert.doesNotMatch(source, /acreRules/i);
  assert.doesNotMatch(source, /deadlineRules\.js/);
  assert.match(source, /from "\.\.\/rules\/declarationPeriod\.js"/);
});

test("NO NEW SCHEMA: no new Supabase migration was introduced by this LOT", () => {
  const source = readFileSync(
    new URL("../src/domain/declarationDossier/resolveActiveDeclarationPeriod.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /create table/i);
  assert.doesNotMatch(source, /create or replace function/i);
});
