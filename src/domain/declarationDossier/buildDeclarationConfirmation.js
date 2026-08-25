import { buildFiscalSummaryInput } from "../../application/adapters/buildFiscalSummaryInput.js";
import { calculateFiscalSummary } from "../calculations/facade/calculateFiscalSummary.js";
import { parseLocalDate, formatLocalDate } from "../calculations/dates.js";
import { computeDeclarationDeadline } from "../rules/declarationPeriod.js";
import { COMPLETION_STATE } from "../obligations/constants.js";
import { DECLARATION_TYPE } from "./constants.js";
import { buildDossierIdentity } from "./dossierIdentity.js";

function snapshotFiscalSummary({ fiscalProfile, revenues, periodStart, periodEnd }) {
  if (!fiscalProfile?.activity_type) {
    return { calculatedRevenue: null, estimatedContributions: null };
  }

  try {
    const input = buildFiscalSummaryInput({
      revenues: revenues ?? [],
      fiscalProfile: {
        activity_type: fiscalProfile.activity_type,
        acre: fiscalProfile.acre,
        acre_start_date: fiscalProfile.acre_start_date,
        business_start_date: fiscalProfile.business_start_date,
      },
      period: { startDate: periodStart, endDate: periodEnd },
      // Evaluated as of the period being declared (its own last day), not
      // the (possibly much later) day the user confirms -- an ACRE window
      // that lapsed after the period closed must not retroactively change
      // what this period's own snapshot shows.
      referenceDate: periodEnd,
    });
    const summary = calculateFiscalSummary(input, { trace: false });
    return {
      calculatedRevenue: summary.revenue.total,
      estimatedContributions: summary.summary.finalContributionAmount,
    };
  } catch {
    // Missing/invalid profile data: leave the system-derived snapshot null
    // rather than fabricating a number.
    return { calculatedRevenue: null, estimatedContributions: null };
  }
}

/**
 * Pure: builds the full row payload for confirming a declaration (LOT
 * 10.2D section 9) -- "J'ai fait ma déclaration". Never writes to
 * Supabase itself (see src/application/adapters/declarationDossier.js for
 * the thin I/O wrapper); returns a plain object ready to insert/upsert.
 *
 * Distinguishes system-derived values (calculated_revenue,
 * estimated_contributions -- a snapshot of the canonical fiscal engine for
 * exactly this period, frozen at confirmation time) from user-confirmed
 * ones (declared_revenue, actual_contributions, declared_at) -- the latter
 * are prefilled from the former only as a convenience default, never
 * silently overwritten by them.
 */
export function buildDeclarationConfirmation({
  userId,
  period,
  fiscalProfile,
  revenues,
  declaredAt,
  declaredRevenue,
  actualContributions,
  notes,
} = {}) {
  if (!userId) throw new TypeError("buildDeclarationConfirmation requires userId");

  const identity = buildDossierIdentity({ period, declarationType: DECLARATION_TYPE.urssafCa });
  if (!identity) throw new TypeError("buildDeclarationConfirmation requires a valid period");

  const deadline = computeDeclarationDeadline({ period, referenceDate: declaredAt });
  if (!deadline?.dueDate) {
    throw new TypeError("buildDeclarationConfirmation could not resolve a due date for this period");
  }

  const declaredAtDate = parseLocalDate(declaredAt) ?? new Date();
  const { calculatedRevenue, estimatedContributions } = snapshotFiscalSummary({
    fiscalProfile,
    revenues,
    periodStart: identity.periodStart,
    periodEnd: identity.periodEnd,
  });

  return {
    user_id: userId,
    declaration_type: identity.declarationType,
    frequency: identity.frequency,
    period_start: identity.periodStart,
    period_end: identity.periodEnd,
    due_date: formatLocalDate(deadline.dueDate),

    calculated_revenue: calculatedRevenue,
    estimated_contributions: estimatedContributions,

    declared_revenue: declaredRevenue ?? calculatedRevenue,
    actual_contributions: actualContributions ?? null,

    declared_at: declaredAtDate.toISOString(),
    confirmation_source: COMPLETION_STATE.userConfirmed,
    paid_at: null,

    notes: notes ?? null,
  };
}

/**
 * Pure: builds the payload for confirming PAYMENT on an already-declared
 * dossier (LOT 10.2D section 10). Deliberately separate from
 * buildDeclarationConfirmation -- payment is never inferred from
 * declaration, only from an explicit, separate user confirmation.
 */
export function buildPaymentConfirmation({ paidAt } = {}) {
  const paidAtDate = parseLocalDate(paidAt) ?? new Date();
  return { paid_at: paidAtDate.toISOString() };
}
