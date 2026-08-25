import { formatLocalDate, parseLocalDate, compareLocalDates } from "../calculations/dates.js";
import {
  resolveCurrentDeclarationPeriod,
  getNextDeclarationPeriod,
  computeDeclarationDeadline,
  getDeclarationPeriodBounds,
} from "../rules/declarationPeriod.js";
import { resolveDossierStatus } from "./resolveDossierStatus.js";
import { findDossierForPeriod } from "./dossierIdentity.js";

/**
 * Clean, React-free application/domain API (LOT 10.2D section 12) for a
 * future UI (Aujourd'hui, Calendrier, Mes déclarations) to ask about
 * declaration state -- current, upcoming, last confirmed, full history.
 * Operates entirely over an already-fetched `dossiers` array; never
 * queries Supabase itself.
 */

/**
 * The period currently relevant to declare, its stable due date, and its
 * effective lifecycle status (including DECLARED/PAID when a matching,
 * user-confirmed dossier exists).
 */
export function getCurrentDeclarationView({ fiscalProfile, dossiers, referenceDate } = {}) {
  const frequency = fiscalProfile?.declaration_frequency ?? null;
  const period = resolveCurrentDeclarationPeriod({ frequency, referenceDate });
  if (!period) return null;

  // LOT 10.2D section 13: the auto-selected "current" period is always
  // "last calendar month/quarter relative to today", with no awareness of
  // when the business actually started. For a business that started
  // DURING or AFTER this period, confidently claiming it due/overdue would
  // be wrong -- the real first-declaration timeline is different and,
  // per LOT 10.2C's research, still not reliably verified against a
  // primary source. Rather than invent that rule, this returns an
  // explicit "unresolved" signal instead of a fabricated due/overdue claim.
  const businessStartDate = parseLocalDate(fiscalProfile?.business_start_date);
  if (businessStartDate) {
    const bounds = getDeclarationPeriodBounds(period);
    if (bounds && compareLocalDates(businessStartDate, bounds.start) > 0) {
      return {
        period,
        dueDate: null,
        daysLeft: null,
        status: null,
        dossier: null,
        firstDeclarationUnresolved: true,
      };
    }
  }

  const dossier = findDossierForPeriod(dossiers, period);
  const deadline = computeDeclarationDeadline({ period, referenceDate });

  return {
    period,
    dueDate: deadline?.dueDate ? formatLocalDate(deadline.dueDate) : null,
    daysLeft: deadline?.daysLeft ?? null,
    status: resolveDossierStatus({
      dueDate: deadline?.dueDate ?? null,
      referenceDate,
      declaredAt: dossier?.declared_at ?? null,
      paidAt: dossier?.paid_at ?? null,
    }),
    dossier: dossier ?? null,
    firstDeclarationUnresolved: false,
  };
}

/**
 * The period after the current one -- purely a calendar step forward, not
 * conditioned on whether the current period has been declared yet.
 */
export function getUpcomingDeclarationView({ fiscalProfile, referenceDate } = {}) {
  const frequency = fiscalProfile?.declaration_frequency ?? null;
  const currentPeriod = resolveCurrentDeclarationPeriod({ frequency, referenceDate });
  const period = getNextDeclarationPeriod(currentPeriod);
  if (!period) return null;

  const deadline = computeDeclarationDeadline({ period, referenceDate });

  return {
    period,
    dueDate: deadline?.dueDate ? formatLocalDate(deadline.dueDate) : null,
  };
}

/**
 * The single most recently confirmed declaration, by declared_at -- null
 * if the user has never confirmed one. Never infers confirmation from a
 * passed deadline; only an actual declared_at counts.
 */
export function getLastConfirmedDeclaration(dossiers) {
  if (!Array.isArray(dossiers)) return null;

  const confirmed = dossiers.filter((dossier) => dossier?.declared_at);
  if (confirmed.length === 0) return null;

  return confirmed.reduce((latest, current) =>
    new Date(current.declared_at).getTime() > new Date(latest.declared_at).getTime()
      ? current
      : latest,
  );
}

/**
 * All confirmed declarations, most recent period first. Only rows with a
 * real declared_at are ever included -- a generated/unconfirmed dossier
 * row (if one ever exists) must never appear as "history".
 */
export function getDeclarationHistory(dossiers) {
  if (!Array.isArray(dossiers)) return [];

  return [...dossiers]
    .filter((dossier) => dossier?.declared_at)
    .sort((a, b) => {
      if (a.period_start < b.period_start) return 1;
      if (a.period_start > b.period_start) return -1;
      return 0;
    });
}
