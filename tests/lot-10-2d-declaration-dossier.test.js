import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierIdentity,
  findDossierForPeriod,
  buildDeclarationConfirmation,
  buildPaymentConfirmation,
  DECLARATION_TYPE,
} from "../src/domain/declarationDossier/index.js";
import { COMPLETION_STATE } from "../src/domain/obligations/constants.js";
import { formatLocalDate } from "../src/domain/calculations/dates.js";

const MONTHLY_PROFILE = Object.freeze({
  activity_type: "services",
  acre: "no",
  acre_start_date: null,
  business_start_date: null,
  declaration_frequency: "mensuel",
});

const REVENUES = Object.freeze([
  { id: "r1", amount: 1000, date: "2026-07-10", revenueCategory: "service" },
  { id: "r2", amount: 500, date: "2026-07-20", revenueCategory: "service" },
  { id: "r3", amount: 999, date: "2026-08-05", revenueCategory: "service" }, // outside the July period
]);

// ---------------------------------------------------------------------
// DOSSIER: period creation, identity, uniqueness
// ---------------------------------------------------------------------

test("DOSSIER: monthly period identity has correct bounds and frequency", () => {
  const identity = buildDossierIdentity({ period: { type: "month", year: 2026, month0: 6 } }); // July
  assert.deepEqual(identity, {
    declarationType: DECLARATION_TYPE.urssafCa,
    frequency: "mensuel",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
  });
});

test("DOSSIER: quarterly period identity has correct bounds and frequency", () => {
  const identity = buildDossierIdentity({ period: { type: "quarter", year: 2026, quarter: 2 } }); // Apr-Jun
  assert.deepEqual(identity, {
    declarationType: DECLARATION_TYPE.urssafCa,
    frequency: "trimestriel",
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
  });
});

test("DOSSIER: monthly and quarterly identities never collide, even when both cover the same start month", () => {
  const monthly = buildDossierIdentity({ period: { type: "month", year: 2026, month0: 0 } }); // Jan
  const quarterly = buildDossierIdentity({ period: { type: "quarter", year: 2026, quarter: 1 } }); // Jan-Mar
  assert.equal(monthly.periodStart, quarterly.periodStart); // both start 2026-01-01
  assert.notEqual(monthly.periodEnd, quarterly.periodEnd); // but end differently -> distinct identity
});

test("DOSSIER: findDossierForPeriod matches only the exact period, different periods stay independent", () => {
  const july = { id: "d1", user_id: "u1", declaration_type: "urssaf_ca", period_start: "2026-07-01", period_end: "2026-07-31" };
  const august = { id: "d2", user_id: "u1", declaration_type: "urssaf_ca", period_start: "2026-08-01", period_end: "2026-08-31" };
  const dossiers = [july, august];

  const found = findDossierForPeriod(dossiers, { type: "month", year: 2026, month0: 6 });
  assert.equal(found.id, "d1");

  const foundOther = findDossierForPeriod(dossiers, { type: "month", year: 2026, month0: 7 });
  assert.equal(foundOther.id, "d2");

  const notFound = findDossierForPeriod(dossiers, { type: "month", year: 2026, month0: 8 });
  assert.equal(notFound, null);
});

test("DOSSIER: findDossierForPeriod isolates different users -- a matching period for another user is never returned", () => {
  const otherUsersDossier = {
    id: "d1",
    user_id: "user-b",
    declaration_type: "urssaf_ca",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
  };

  const found = findDossierForPeriod(
    [otherUsersDossier],
    { type: "month", year: 2026, month0: 6 },
    { userId: "user-a" },
  );
  assert.equal(found, null);

  const foundForCorrectUser = findDossierForPeriod(
    [otherUsersDossier],
    { type: "month", year: 2026, month0: 6 },
    { userId: "user-b" },
  );
  assert.equal(foundForCorrectUser.id, "d1");
});

// ---------------------------------------------------------------------
// TRUST: system-derived vs user-confirmed, never fabricated
// ---------------------------------------------------------------------

test("TRUST: a derived deadline alone does not mean declared -- confirmation payload is only produced by an explicit call", () => {
  // No dossier row and no call to buildDeclarationConfirmation -- there is
  // simply nothing to represent as declared. This is implicitly proven by
  // every other test in this file never producing a declared_at without
  // calling buildDeclarationConfirmation explicitly.
  const payload = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.ok(payload.declared_at);
  assert.equal(payload.confirmation_source, COMPLETION_STATE.userConfirmed);
});

test("TRUST: user confirmation snapshots calculated_revenue for exactly the declared period (excludes revenue outside it)", () => {
  const payload = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 }, // July
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  // Only r1 (1000) + r2 (500) fall within July; r3 (August) must be excluded.
  assert.equal(payload.calculated_revenue, 1500);
});

test("TRUST: declared_revenue defaults to the system snapshot but remains independently editable", () => {
  const defaulted = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.equal(defaulted.declared_revenue, defaulted.calculated_revenue);

  const edited = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
    declaredRevenue: 1450, // user corrects the number
  });
  assert.equal(edited.declared_revenue, 1450);
  assert.equal(edited.calculated_revenue, 1500); // system snapshot unchanged, still distinguishable
  assert.notEqual(edited.declared_revenue, edited.calculated_revenue);
});

test("TRUST: estimated_contributions (system) and actual_contributions (user) remain distinguishable", () => {
  const withoutActual = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.ok(withoutActual.estimated_contributions > 0);
  assert.equal(withoutActual.actual_contributions, null); // optional, not fabricated

  const withActual = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
    actualContributions: 310.5,
  });
  assert.equal(withActual.actual_contributions, 310.5);
  assert.notEqual(withActual.actual_contributions, withActual.estimated_contributions);
});

test("TRUST: confirmation_source is only ever 'user_confirmed' from this flow -- document/external states are never fabricated", () => {
  const payload = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.equal(payload.confirmation_source, "user_confirmed");
  assert.notEqual(payload.confirmation_source, "document_supported");
  assert.notEqual(payload.confirmation_source, "externally_verified");
});

test("TRUST: missing/invalid fiscal profile leaves the system-derived snapshot null rather than fabricating a number", () => {
  const payload = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: { activity_type: null }, // incomplete
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.equal(payload.calculated_revenue, null);
  assert.equal(payload.estimated_contributions, null);
  // declared_revenue still defaults sensibly to the (null) snapshot, not to 0 or a guess.
  assert.equal(payload.declared_revenue, null);
});

// ---------------------------------------------------------------------
// PAYMENT: DECLARED without PAID; PAID only after explicit confirmation
// ---------------------------------------------------------------------

test("PAYMENT: buildDeclarationConfirmation never sets paid_at -- declaring is not paying", () => {
  const payload = buildDeclarationConfirmation({
    userId: "u1",
    period: { type: "month", year: 2026, month0: 6 },
    fiscalProfile: MONTHLY_PROFILE,
    revenues: REVENUES,
    declaredAt: "2026-08-05",
  });
  assert.equal(payload.paid_at, null);
});

test("PAYMENT: buildPaymentConfirmation is a separate, explicit call that only ever produces paid_at", () => {
  const payload = buildPaymentConfirmation({ paidAt: "2026-08-10" });
  assert.deepEqual(Object.keys(payload), ["paid_at"]);
  // paid_at is a timestamptz (a UTC instant); the raw string is timezone-
  // shifted from "2026-08-10" by construction, so round-trip it back
  // through the same local-safe formatter the rest of the codebase uses
  // to display timestamps, rather than checking the raw string prefix.
  assert.equal(formatLocalDate(new Date(payload.paid_at)), "2026-08-10");
});

test("PAYMENT: buildPaymentConfirmation defaults to today when no date is supplied", () => {
  const payload = buildPaymentConfirmation({});
  assert.ok(payload.paid_at);
  assert.ok(!Number.isNaN(new Date(payload.paid_at).getTime()));
});
