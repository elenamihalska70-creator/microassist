import { getDeadlineRule } from "../rules/deadlineRules.js";
import { formatLocalDate } from "../calculations/dates.js";
import { createAction } from "./actionObject.js";
import { getOfficialAction } from "./officialActionRegistry.js";
import {
  ACTION_TYPE,
  SEVERITY,
  OBLIGATION_STATUS,
  PRIORITY_TIER,
  DECLARATION_DUE_SOON_WARNING_DAYS,
  DECLARATION_DUE_SOON_CRITICAL_DAYS,
} from "./constants.js";

// Exported so the daysLeft -> status -> severity/tier mapping can be unit
// tested directly with synthetic daysLeft values, independent of whichever
// calendar dates the deadline rule (deadlineRules.js) is exercised with.
export function resolveStatus(daysLeft) {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return OBLIGATION_STATUS.overdue;
  if (daysLeft === 0) return OBLIGATION_STATUS.due;
  if (daysLeft <= DECLARATION_DUE_SOON_WARNING_DAYS) return OBLIGATION_STATUS.dueSoon;
  return OBLIGATION_STATUS.upcoming;
}

export function resolveSeverityAndTier(status, daysLeft) {
  if (status === OBLIGATION_STATUS.overdue) {
    return { severity: SEVERITY.critical, priorityTier: PRIORITY_TIER.preventHarm };
  }

  if (
    status === OBLIGATION_STATUS.due ||
    (status === OBLIGATION_STATUS.dueSoon && daysLeft <= DECLARATION_DUE_SOON_CRITICAL_DAYS)
  ) {
    return { severity: SEVERITY.critical, priorityTier: PRIORITY_TIER.mandatoryImmediate };
  }

  if (status === OBLIGATION_STATUS.dueSoon) {
    return { severity: SEVERITY.urgent, priorityTier: PRIORITY_TIER.approachingObligation };
  }

  return { severity: SEVERITY.upcoming, priorityTier: PRIORITY_TIER.futurePreparation };
}

// LOT 10.2C: was `date.toISOString().slice(0, 10)`, which converts a LOCAL
// midnight Date to UTC before slicing -- shifting the reported calendar day
// backward by one for any timezone ahead of UTC (including France, this
// app's actual market). formatLocalDate reads the Date's own local
// components instead, matching how `deadlineDate` was constructed.
function toIsoDate(date) {
  return formatLocalDate(date);
}

/**
 * Represents the user's URSSAF declaration obligation (LOT 10.2B section 6).
 * Reuses the existing deadline rule (src/domain/rules/deadlineRules.js) and
 * the canonical fiscal engine's output (context.fiscalSummary) rather than
 * recomputing deadline or contribution math.
 *
 * Returns null when the declaration frequency is unknown -- that gap is
 * represented by a missing-information action instead (see
 * buildMissingInformationActions.js), not by a fabricated deadline.
 */
export function buildUrssafDeclarationAction(context = {}) {
  const fiscalProfile = context.fiscalProfile ?? {};
  const frequency = fiscalProfile.declaration_frequency ?? null;
  if (!frequency) return null;

  const deadlineRule = getDeadlineRule({ frequency, today: context.referenceDate });
  const { deadlineDate, daysLeft, periodLabel } = deadlineRule.output;
  const status = resolveStatus(daysLeft);
  if (!status) return null;

  const { severity, priorityTier } = resolveSeverityAndTier(status, daysLeft);
  const summary = context.fiscalSummary?.summary ?? null;
  const amount = summary?.finalContributionAmount ?? null;

  return createAction({
    id: `urssaf-declaration-${toIsoDate(deadlineDate) ?? "unknown"}`,
    type: ACTION_TYPE.urssafDeclaration,
    status,
    severity,
    priorityTier,
    titleKey: `obligation.urssaf_declaration.${status}`,
    period: periodLabel ? { frequency, label: periodLabel } : null,
    dueDate: toIsoDate(deadlineDate),
    amount,
    amountKind: amount === null ? null : "estimated",
    confidence: summary && summary.calculable === false ? "low" : deadlineRule.confidence,
    source: "domain.rules.deadlineRules#getDeadlineRule",
    officialAction: getOfficialAction("urssafDeclaration"),
    reason:
      status === OBLIGATION_STATUS.overdue
        ? `URSSAF declaration deadline passed ${Math.abs(daysLeft)} day(s) ago.`
        : status === OBLIGATION_STATUS.due
          ? "URSSAF declaration is due today."
          : status === OBLIGATION_STATUS.dueSoon
            ? `URSSAF declaration is due in ${daysLeft} day(s).`
            : `Next URSSAF declaration is due in ${daysLeft} day(s).`,
    metadata: { daysLeft, frequency },
  });
}
