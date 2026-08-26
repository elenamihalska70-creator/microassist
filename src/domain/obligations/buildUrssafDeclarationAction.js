import { getDeadlineRule } from "../rules/deadlineRules.js";
import { formatLocalDate } from "../calculations/dates.js";
import { createAction } from "./actionObject.js";
import { getOfficialAction } from "./officialActionRegistry.js";
import {
  ACTION_TYPE,
  SEVERITY,
  OBLIGATION_STATUS,
  PRIORITY_TIER,
  COMPLETION_STATE,
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
 * LOT 10.2D: context.declarationDossier is the dossier row (if any) already
 * matched by the caller (getPrioritizedActions, via
 * domain/declarationDossier/dossierIdentity.js#findDossierForPeriod) to the
 * SAME period this function independently resolves via getDeadlineRule. A
 * dossier with declared_at set means the user has confirmed submission --
 * the period must no longer surface as an active DUE/DUE_SOON/OVERDUE
 * action once that is true (LOT 10.2D section 11); paid_at (a separate,
 * never-implied fact) additionally marks it PAID.
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

  const dossier = context.declarationDossier ?? null;
  const isPaid = Boolean(dossier?.paid_at);
  const isDeclared = isPaid || Boolean(dossier?.declared_at);

  // LOT 10.2D.1 section 8: once a dossier exists, its own persisted
  // due_date (snapshotted at confirmation time, already a "YYYY-MM-DD"
  // string from the date column) is the historical source of truth for
  // THIS period -- preferred over the live-recomputed deadlineDate so a
  // future revision to the deadline rule can never make an already-
  // confirmed period's displayed due date silently diverge from what was
  // actually true when the user confirmed it. A period with no matching
  // dossier (not yet confirmed) has no snapshot to prefer, so the live
  // engine remains authoritative for it, exactly as before.
  const effectiveDueDateIso = dossier?.due_date ?? toIsoDate(deadlineDate);

  const status = isPaid
    ? OBLIGATION_STATUS.paid
    : isDeclared
      ? OBLIGATION_STATUS.declared
      : resolveStatus(daysLeft);
  if (!status) return null;

  const { severity, priorityTier } = isDeclared
    ? { severity: SEVERITY.info, priorityTier: PRIORITY_TIER.informationalGuidance }
    : resolveSeverityAndTier(status, daysLeft);

  const summary = context.fiscalSummary?.summary ?? null;
  const liveAmount = summary?.finalContributionAmount ?? null;
  const amount = isDeclared
    ? (dossier.actual_contributions ?? dossier.estimated_contributions ?? liveAmount)
    : liveAmount;
  const amountKind = isDeclared
    ? (dossier.actual_contributions != null ? "actual" : "estimated")
    : amount === null
      ? null
      : "estimated";

  return createAction({
    id: `urssaf-declaration-${effectiveDueDateIso ?? "unknown"}`,
    type: ACTION_TYPE.urssafDeclaration,
    status,
    severity,
    priorityTier,
    titleKey: `obligation.urssaf_declaration.${status}`,
    period: periodLabel ? { frequency, label: periodLabel } : null,
    dueDate: effectiveDueDateIso,
    amount,
    amountKind,
    confidence: summary && summary.calculable === false ? "low" : deadlineRule.confidence,
    source: "domain.rules.deadlineRules#getDeadlineRule",
    completionState: isDeclared ? COMPLETION_STATE.userConfirmed : undefined,
    officialAction: getOfficialAction("urssafDeclaration"),
    reason:
      isPaid
        ? "Declaration has been confirmed as declared and paid."
        : isDeclared
          ? "Declaration has been confirmed as submitted."
          : status === OBLIGATION_STATUS.overdue
            ? `URSSAF declaration deadline passed ${Math.abs(daysLeft)} day(s) ago.`
            : status === OBLIGATION_STATUS.due
              ? "URSSAF declaration is due today."
              : status === OBLIGATION_STATUS.dueSoon
                ? `URSSAF declaration is due in ${daysLeft} day(s).`
                : `Next URSSAF declaration is due in ${daysLeft} day(s).`,
    metadata: {
      daysLeft,
      frequency,
      declaredAt: dossier?.declared_at ?? null,
      paidAt: dossier?.paid_at ?? null,
      dossierId: dossier?.id ?? null,
    },
  });
}
