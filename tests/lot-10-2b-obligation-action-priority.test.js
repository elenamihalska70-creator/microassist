import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrioritizedActions,
  prioritizeActions,
  createAction,
  buildNoActionRequiredAction,
  ACTION_TYPE,
  SEVERITY,
  OBLIGATION_STATUS,
  PRIORITY_TIER,
} from "../src/domain/obligations/index.js";
import {
  resolveStatus,
  resolveSeverityAndTier,
} from "../src/domain/obligations/buildUrssafDeclarationAction.js";
import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

// NOTE on scope: the declaration deadline itself (deadlineDate/daysLeft)
// comes from the reused, unmodified src/domain/rules/deadlineRules.js. That
// rule recomputes its target deadline relative to `today` every call (last
// day of "next month", or the current quarter's fixed date) -- which means,
// as currently implemented, it can never actually return daysLeft <= 7 or
// negative through a real calendar date: by the time "today" would get
// close to a deadline, the rule has already rolled forward to a later one
// (e.g. once today enters April, a Q1 profile's deadline jumps from the
// imminent Apr30 straight to Jul31). This is a pre-existing property of the
// reused rule, not introduced here, and is out of scope for LOT 10.2B to
// fix (see "protect the canonical fiscal engine" / "do not invent arbitrary
// new legal deadlines"). Overdue/due-soon/due-today status MAPPING is
// therefore verified directly against resolveStatus/resolveSeverityAndTier
// (this module's own logic) below, while integration tests exercise the one
// status that is reachable through real dates today: "upcoming".

test("resolveStatus maps daysLeft onto the obligation lifecycle", () => {
  assert.equal(resolveStatus(null), null);
  assert.equal(resolveStatus(-3), OBLIGATION_STATUS.overdue);
  assert.equal(resolveStatus(0), OBLIGATION_STATUS.due);
  assert.equal(resolveStatus(2), OBLIGATION_STATUS.dueSoon);
  assert.equal(resolveStatus(7), OBLIGATION_STATUS.dueSoon);
  assert.equal(resolveStatus(8), OBLIGATION_STATUS.upcoming);
});

test("resolveSeverityAndTier: overdue is tier 1 (prevent harm)", () => {
  const result = resolveSeverityAndTier(OBLIGATION_STATUS.overdue, -3);
  assert.equal(result.severity, SEVERITY.critical);
  assert.equal(result.priorityTier, PRIORITY_TIER.preventHarm);
});

test("resolveSeverityAndTier: due today is tier 2 (mandatory immediate)", () => {
  const result = resolveSeverityAndTier(OBLIGATION_STATUS.due, 0);
  assert.equal(result.severity, SEVERITY.critical);
  assert.equal(result.priorityTier, PRIORITY_TIER.mandatoryImmediate);
});

test("resolveSeverityAndTier: due-soon within the J-2 window is tier 2 (mandatory immediate)", () => {
  const result = resolveSeverityAndTier(OBLIGATION_STATUS.dueSoon, 2);
  assert.equal(result.severity, SEVERITY.critical);
  assert.equal(result.priorityTier, PRIORITY_TIER.mandatoryImmediate);
});

test("resolveSeverityAndTier: due-soon beyond J-2 is tier 3 (approaching obligation)", () => {
  const result = resolveSeverityAndTier(OBLIGATION_STATUS.dueSoon, 7);
  assert.equal(result.severity, SEVERITY.urgent);
  assert.equal(result.priorityTier, PRIORITY_TIER.approachingObligation);
});

test("resolveSeverityAndTier: upcoming is tier 5 (future preparation)", () => {
  const result = resolveSeverityAndTier(OBLIGATION_STATUS.upcoming, 36);
  assert.equal(result.severity, SEVERITY.upcoming);
  assert.equal(result.priorityTier, PRIORITY_TIER.futurePreparation);
});

// ---------------------------------------------------------------------
// NEW USER
// ---------------------------------------------------------------------

test("NEW USER: missing declaration frequency is a precise blocking action, not a fabricated deadline", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: { activity_type: "services", acre: "no" },
    revenues: [],
    referenceDate: "2026-03-01",
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, ACTION_TYPE.missingInformation);
  assert.equal(actions[0].metadata.missingField, "declaration_frequency");
  assert.equal(actions[0].priorityTier, PRIORITY_TIER.missingInformation);
  assert.equal(actions[0].metadata.blocking, true);
});

test("NEW USER: an unrecognized declaration frequency is also treated as blocking, not silently ignored", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "not_a_real_frequency",
    },
    revenues: [],
    referenceDate: "2026-01-15",
  });

  assert.ok(
    actions.some(
      (action) =>
        action.type === ACTION_TYPE.missingInformation &&
        action.metadata.missingField === "declaration_frequency",
    ),
  );
});

test("NEW USER: missing business start date blocks only when ACRE is enabled", () => {
  const withAcre = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "yes",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
  });
  assert.ok(
    withAcre.some(
      (action) =>
        action.type === ACTION_TYPE.missingInformation &&
        action.metadata.missingField === "business_start_date",
    ),
  );

  const withoutAcre = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
  });
  assert.ok(
    !withoutAcre.some((action) => action.metadata?.missingField === "business_start_date"),
  );
});

test("NEW USER: no revenue does not manufacture urgency -- declaration still resolves calmly at zero", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.ok(declarationAction);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.upcoming);
  assert.equal(declarationAction.severity, SEVERITY.upcoming);
  assert.equal(declarationAction.amount, 0);
});

// ---------------------------------------------------------------------
// NORMAL ACTIVE USER
// ---------------------------------------------------------------------

test("NORMAL ACTIVE USER: declaration upcoming carries a real due date and the official action destination", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [{ id: "r1", amount: 1000, date: "2026-01-10", revenueCategory: "service" }],
    referenceDate: "2026-01-15",
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.ok(declarationAction);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.upcoming);
  assert.equal(declarationAction.priorityTier, PRIORITY_TIER.futurePreparation);
  assert.ok(declarationAction.dueDate);
  assert.equal(declarationAction.officialAction.url, "https://www.autoentrepreneur.urssaf.fr/");
  assert.equal(declarationAction.officialAction.provider, "urssaf");
});

// ---------------------------------------------------------------------
// ACRE USER
// ---------------------------------------------------------------------

test("ACRE USER: declaration amount matches the canonical fiscal engine's ACRE-aware output exactly", () => {
  const fiscalProfile = {
    activity_type: "services",
    acre: "yes",
    acre_start_date: "2025-06-01",
    business_start_date: "2025-06-01", // pre-reform: before 2026-07-01
    declaration_frequency: "trimestriel",
  };
  const revenues = [{ id: "r1", amount: 2000, date: "2026-01-10", revenueCategory: "service" }];
  const referenceDate = "2026-01-15";

  const actions = getPrioritizedActions({ fiscalProfile, revenues, referenceDate });
  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);

  const expectedSummary = calculateFiscalSummary(
    buildFiscalSummaryInput({
      revenues,
      fiscalProfile: {
        activity_type: fiscalProfile.activity_type,
        acre: fiscalProfile.acre,
        acre_start_date: fiscalProfile.acre_start_date,
        business_start_date: fiscalProfile.business_start_date,
      },
      period: {},
      referenceDate,
    }),
  );

  assert.ok(declarationAction);
  assert.equal(declarationAction.amount, expectedSummary.summary.finalContributionAmount);
  assert.ok(declarationAction.amount < expectedSummary.summary.standardContributionAmount);
});

// ---------------------------------------------------------------------
// TVA
// ---------------------------------------------------------------------

test("TVA: below threshold produces no TVA action", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
    monthlyRevenue: 1000,
  });

  assert.ok(!actions.some((action) => action.type === ACTION_TYPE.tvaThreshold));
});

test("TVA: near threshold produces an approaching-obligation action (tier 3)", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
    monthlyRevenue: 2600,
  });

  const tvaAction = actions.find((action) => action.type === ACTION_TYPE.tvaThreshold);
  assert.ok(tvaAction);
  assert.equal(tvaAction.metadata.vatStatus, "soon");
  assert.equal(tvaAction.priorityTier, PRIORITY_TIER.approachingObligation);
  assert.equal(tvaAction.severity, SEVERITY.urgent);
});

test("TVA: exceeded threshold is tier 1 (prevent harm) and ranks first", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: "2026-01-15",
    monthlyRevenue: 4000,
  });

  const tvaAction = actions.find((action) => action.type === ACTION_TYPE.tvaThreshold);
  assert.ok(tvaAction);
  assert.equal(tvaAction.metadata.vatStatus, "exceeded");
  assert.equal(tvaAction.priorityTier, PRIORITY_TIER.preventHarm);
  assert.equal(actions[0].id, tvaAction.id);
});

// ---------------------------------------------------------------------
// MULTIPLE ACTIONS -- ranking guarantees
// ---------------------------------------------------------------------

function fixtureAction(overrides) {
  return createAction({ source: "test", reason: "test fixture", ...overrides });
}

test("MULTIPLE ACTIONS: an overdue declaration outranks a profile-completion (missing information) action", () => {
  const overdue = fixtureAction({
    id: "urssaf-declaration-overdue",
    type: ACTION_TYPE.urssafDeclaration,
    status: OBLIGATION_STATUS.overdue,
    severity: SEVERITY.critical,
    priorityTier: PRIORITY_TIER.preventHarm,
    titleKey: "obligation.urssaf_declaration.overdue",
  });
  const missingInfo = fixtureAction({
    id: "missing-information-business_start_date",
    type: ACTION_TYPE.missingInformation,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.missingInformation,
    titleKey: "obligation.missing_information.business_start_date",
  });

  const ranked = prioritizeActions([missingInfo, overdue]);
  assert.equal(ranked[0].id, overdue.id);
});

test("MULTIPLE ACTIONS: an urgent (J-2) declaration outranks an educational tip", () => {
  const declaration = fixtureAction({
    id: "urssaf-declaration-j2",
    type: ACTION_TYPE.urssafDeclaration,
    status: OBLIGATION_STATUS.dueSoon,
    severity: SEVERITY.critical,
    priorityTier: PRIORITY_TIER.mandatoryImmediate,
    titleKey: "obligation.urssaf_declaration.due_soon",
  });
  const tip = fixtureAction({
    id: "educational-tip-1",
    type: ACTION_TYPE.educationalTip,
    severity: SEVERITY.info,
    priorityTier: PRIORITY_TIER.optimizationEducation,
    titleKey: "tip.generic",
  });

  const ranked = prioritizeActions([tip, declaration]);
  assert.equal(ranked[0].id, declaration.id);
});

test("MULTIPLE ACTIONS: an urgent declaration outranks a Premium engagement trigger", () => {
  const declaration = fixtureAction({
    id: "urssaf-declaration-approaching",
    type: ACTION_TYPE.urssafDeclaration,
    status: OBLIGATION_STATUS.dueSoon,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.approachingObligation,
    titleKey: "obligation.urssaf_declaration.due_soon",
  });
  const premium = fixtureAction({
    id: "premium-engagement-1",
    type: ACTION_TYPE.premiumEngagement,
    severity: SEVERITY.info,
    priorityTier: PRIORITY_TIER.engagementPremium,
    titleKey: "premium.engaged_user",
  });

  const ranked = prioritizeActions([premium, declaration]);
  assert.equal(ranked[0].id, declaration.id);
  assert.notEqual(ranked[0].type, ACTION_TYPE.premiumEngagement);
});

test("MULTIPLE ACTIONS: a due-soon declaration outranks a generic reminder", () => {
  const declaration = fixtureAction({
    id: "urssaf-declaration-soon",
    type: ACTION_TYPE.urssafDeclaration,
    status: OBLIGATION_STATUS.dueSoon,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.approachingObligation,
    titleKey: "obligation.urssaf_declaration.due_soon",
  });
  const reminder = fixtureAction({
    id: "generic-reminder-1",
    type: ACTION_TYPE.genericReminder,
    severity: SEVERITY.info,
    priorityTier: PRIORITY_TIER.informationalGuidance,
    titleKey: "reminder.generic",
  });

  const ranked = prioritizeActions([reminder, declaration]);
  assert.equal(ranked[0].id, declaration.id);
});

test("MULTIPLE ACTIONS: blocking missing information outranks educational content", () => {
  const missingInfo = fixtureAction({
    id: "missing-information-declaration_frequency",
    type: ACTION_TYPE.missingInformation,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.missingInformation,
    titleKey: "obligation.missing_information.declaration_frequency",
  });
  const tip = fixtureAction({
    id: "educational-tip-2",
    type: ACTION_TYPE.educationalTip,
    severity: SEVERITY.info,
    priorityTier: PRIORITY_TIER.optimizationEducation,
    titleKey: "tip.generic",
  });

  const ranked = prioritizeActions([tip, missingInfo]);
  assert.equal(ranked[0].id, missingInfo.id);
});

test("MULTIPLE ACTIONS: ranking is deterministic when tier and due date are equal", () => {
  const tva = fixtureAction({
    id: "tva-threshold-soon",
    type: ACTION_TYPE.tvaThreshold,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.approachingObligation,
    titleKey: "obligation.tva_threshold.soon",
  });
  const declaration = fixtureAction({
    id: "urssaf-declaration-2026-04-30",
    type: ACTION_TYPE.urssafDeclaration,
    status: OBLIGATION_STATUS.dueSoon,
    severity: SEVERITY.urgent,
    priorityTier: PRIORITY_TIER.approachingObligation,
    titleKey: "obligation.urssaf_declaration.due_soon",
  });

  const rankedOnce = prioritizeActions([tva, declaration]);
  const rankedAgain = prioritizeActions([declaration, tva]);

  assert.deepEqual(
    rankedOnce.map((action) => action.id),
    rankedAgain.map((action) => action.id),
  );
  // urssafDeclaration precedes tvaThreshold in ACTION_TYPE_TIEBREAK_ORDER.
  assert.equal(rankedOnce[0].id, declaration.id);
});

// ---------------------------------------------------------------------
// NO ACTION REQUIRED
// ---------------------------------------------------------------------

test("NO ACTION REQUIRED: the calm-state builder never manufactures urgency", () => {
  const action = buildNoActionRequiredAction();
  assert.equal(action.type, ACTION_TYPE.noActionRequired);
  assert.equal(action.severity, SEVERITY.info);
  assert.equal(action.priorityTier, PRIORITY_TIER.informationalGuidance);
});

test("NO ACTION REQUIRED: a fully-configured, healthy profile's top action is calm, not critical or urgent", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [{ id: "r1", amount: 500, date: "2026-01-10", revenueCategory: "service" }],
    referenceDate: "2026-01-15",
    monthlyRevenue: 500,
  });

  assert.ok(actions.length > 0);
  assert.notEqual(actions[0].severity, SEVERITY.critical);
  assert.notEqual(actions[0].severity, SEVERITY.urgent);
});
