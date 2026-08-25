import { differenceInCalendarDays } from "../calculations/dates.js";
import { resolveStatus } from "../obligations/buildUrssafDeclarationAction.js";
import { OBLIGATION_STATUS } from "../obligations/constants.js";

/**
 * Pure: the effective lifecycle status of a declaration period, combining a
 * (possibly absent) dossier row's durable, user-confirmed facts with the
 * period's own stable due date (LOT 10.2D section 5).
 *
 * PAID and DECLARED are never derived from the deadline -- only from
 * paidAt/declaredAt actually being set. A dossier with neither set falls
 * back to the exact same daysLeft -> status mapping the canonical
 * obligation model already uses (reused, not duplicated), so an
 * unconfirmed period can still reach UPCOMING/DUE_SOON/DUE/OVERDUE.
 */
export function resolveDossierStatus({ dueDate, referenceDate, declaredAt, paidAt } = {}) {
  if (paidAt) return OBLIGATION_STATUS.paid;
  if (declaredAt) return OBLIGATION_STATUS.declared;

  if (!dueDate) return null;

  const daysLeft = differenceInCalendarDays(referenceDate ?? new Date(), dueDate);
  return resolveStatus(daysLeft);
}
