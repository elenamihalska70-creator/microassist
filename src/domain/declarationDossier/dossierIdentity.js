import { DECLARATION_FREQUENCIES } from "../constants.js";
import { getDeclarationPeriodBounds } from "../rules/declarationPeriod.js";
import { formatLocalDate } from "../calculations/dates.js";
import { DECLARATION_TYPE } from "./constants.js";

/**
 * Pure: the stable identity a declaration dossier belongs to (LOT 10.2D
 * section 6) -- matches the database's unique constraint exactly
 * (user_id, declaration_type, period_start, period_end), so the same
 * period can never collide with a different one, and monthly/quarterly
 * periods (different span lengths) never collide with each other.
 */
export function buildDossierIdentity({ period, declarationType = DECLARATION_TYPE.urssafCa } = {}) {
  const bounds = getDeclarationPeriodBounds(period);
  if (!bounds) return null;

  return {
    declarationType,
    frequency: period.type === "month" ? DECLARATION_FREQUENCIES.monthly : DECLARATION_FREQUENCIES.quarterly,
    periodStart: formatLocalDate(bounds.start),
    periodEnd: formatLocalDate(bounds.end),
  };
}

/**
 * Pure: finds the dossier row (if any) matching an explicit period's
 * identity within an already-fetched array of dossiers. Does not query
 * Supabase -- callers fetch dossiers once and pass them in.
 *
 * `userId`, when provided, is a defense-in-depth check on top of the
 * caller's own fetch already being scoped to one user (repository layer)
 * and the database's own RLS (the real security boundary): this domain
 * function never assumes an array it's handed is correctly scoped, so a
 * mixed-user array can never leak another user's dossier into a match.
 */
export function findDossierForPeriod(
  dossiers,
  period,
  { declarationType = DECLARATION_TYPE.urssafCa, userId = null } = {},
) {
  const identity = buildDossierIdentity({ period, declarationType });
  if (!identity || !Array.isArray(dossiers)) return null;

  return (
    dossiers.find(
      (dossier) =>
        dossier?.declaration_type === identity.declarationType &&
        dossier?.period_start === identity.periodStart &&
        dossier?.period_end === identity.periodEnd &&
        (userId === null || dossier?.user_id === userId),
    ) ?? null
  );
}
