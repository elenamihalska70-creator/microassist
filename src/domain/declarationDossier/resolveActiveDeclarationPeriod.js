import { parseLocalDate, compareLocalDates } from "../calculations/dates.js";
import {
  resolveCurrentDeclarationPeriod,
  getPreviousDeclarationPeriod,
  computeDeclarationDeadline,
  getDeclarationPeriodBounds,
} from "../rules/declarationPeriod.js";
import { findDossierForPeriod } from "./dossierIdentity.js";

// Safety valve only, never a business rule: bounds how many periods a
// corrupt/absurd business_start_date could make this walk backward
// through (60 monthly periods = 5 years; 60 quarterly periods = 15
// years). The real, meaningful stop condition is always the
// business_start_date boundary check inside the loop below.
const MAX_LOOKBACK_PERIODS = 60;

/**
 * LOT 10.2E.1A: an unconfirmed declaration obligation must never
 * disappear merely because resolveCurrentDeclarationPeriod() advances to
 * a fresh period once a window closes (LOT 10.2C's own documented
 * limitation -- see that module's docstring). This walks backward from
 * the period immediately before the auto-selected "current" one, and
 * returns the OLDEST period, within the CONTIGUOUS unconfirmed gap right
 * before the current period, that is still past its own deadline with no
 * confirming dossier -- the highest-risk unresolved obligation, per LOT
 * 10.2E.1A section 6. Falls back to the plain current period when
 * nothing older qualifies (the overwhelmingly common case), so this is a
 * pure, additive extension of the existing auto-resolution, not a
 * replacement for it.
 *
 * The walk stops -- and does not fabricate further history -- at the
 * first of three boundaries, whichever comes first:
 *   1. A period whose bounds start before business_start_date (never a
 *      fabricated obligation for a period before the business existed).
 *      When business_start_date is unknown entirely, this does not walk
 *      backward at all: without it, there is no safe way to know a
 *      historical period was ever a real obligation, so the current
 *      period is trusted at face value exactly as before this LOT.
 *   2. A period that IS confirmed (has a dossier with declared_at) -- a
 *      real checkpoint. A gap in dossier history before a known-good
 *      confirmation could mean many things (predating this feature,
 *      filed through another channel, etc.); this deliberately does not
 *      speculate about a period with zero evidence either way, matching
 *      section 5's "a missing dossier means we don't know, not that it
 *      wasn't done."
 *   3. The MAX_LOOKBACK_PERIODS safety valve (see above).
 *
 * Reuses the existing period engine (declarationPeriod.js) and dossier
 * matching (dossierIdentity.js) entirely -- no second deadline engine,
 * no new schema, no persisted state of its own.
 */
export function resolveActiveDeclarationPeriod({
  fiscalProfile,
  dossiers,
  referenceDate,
  userId = null,
} = {}) {
  const frequency = fiscalProfile?.declaration_frequency ?? null;
  const currentPeriod = resolveCurrentDeclarationPeriod({ frequency, referenceDate });
  if (!currentPeriod) return null;

  const businessStartDate = parseLocalDate(fiscalProfile?.business_start_date);
  if (!businessStartDate) return currentPeriod;

  // Walk backward starting from the period BEFORE current -- the current
  // period's own confirmation status is irrelevant to whether an OLDER
  // period was missed, and is handled separately by the caller's normal
  // dossier lookup either way.
  let candidate = getPreviousDeclarationPeriod(currentPeriod);
  let oldestUnresolvedOverdue = null;

  for (let step = 0; step < MAX_LOOKBACK_PERIODS && candidate; step += 1) {
    const bounds = getDeclarationPeriodBounds(candidate);
    if (!bounds || compareLocalDates(businessStartDate, bounds.start) > 0) {
      // This period (and everything earlier) predates the business, or
      // straddles its start -- never a fabricated obligation. Stop.
      break;
    }

    const dossier = findDossierForPeriod(dossiers, candidate, { userId });
    if (dossier?.declared_at) {
      // Reached a period we KNOW was actively confirmed -- this is a real
      // checkpoint. MicroAssist has no positive or negative signal about
      // anything earlier than it (a gap in dossier history before this
      // point could mean many things -- pre-dating this feature, filed
      // through another channel, etc.), so it stops claiming awareness
      // here rather than speculating about a period with zero evidence
      // either way.
      break;
    }

    const deadline = computeDeclarationDeadline({ period: candidate, referenceDate });
    if (deadline && deadline.daysLeft < 0) {
      oldestUnresolvedOverdue = candidate;
    }

    candidate = getPreviousDeclarationPeriod(candidate);
  }

  return oldestUnresolvedOverdue ?? currentPeriod;
}
