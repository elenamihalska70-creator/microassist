import { getContributionRule } from "./contributionRules.js";
import { withRuleTrace } from "./ruleSet.js";

// Owner-verified URSSAF rule (LOT 10.1B): businesses created before this date
// keep the historical 50%-of-normal ACRE rate; businesses created on or after
// this date pay 75% of the normal rate (a 25% exemption). Verified externally
// against official URSSAF documentation, not derived from internal docs.
export const ACRE_REFORM_EFFECTIVE_DATE = "2026-07-01";
export const ACRE_PRE_REFORM_REDUCTION_FACTOR = 0.5;
export const ACRE_POST_REFORM_REDUCTION_FACTOR = 0.25;

function coerceDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(start, end) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function hasOwnBusinessStartDate(context) {
  return (
    Object.hasOwn(context, "businessStartDate") ||
    Object.hasOwn(context, "business_start_date")
  );
}

function rawBusinessStartDate(context) {
  return Object.hasOwn(context, "businessStartDate")
    ? context.businessStartDate
    : context.business_start_date;
}

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

// Compares local calendar components (not raw epoch millis): businessStartDate
// may arrive either as a raw "YYYY-MM-DD" string (parsed here as UTC midnight
// via coerceDate) or as an already-parsed local-midnight Date object (when
// routed through calculateLegacyAcreContribution's own date normalization).
// Comparing epoch millis directly would misclassify the exact cutover date
// in any timezone with a non-zero UTC offset; calendar-component comparison
// is immune to that, matching how the rest of this module (monthsBetween)
// already reasons about dates.
function isOnOrAfterCalendarDate(date, referenceDate) {
  if (date.getFullYear() !== referenceDate.getFullYear()) {
    return date.getFullYear() > referenceDate.getFullYear();
  }
  if (date.getMonth() !== referenceDate.getMonth()) {
    return date.getMonth() > referenceDate.getMonth();
  }
  return date.getDate() >= referenceDate.getDate();
}

function resolveAcreRegime(businessStartDate) {
  const reformDate = coerceDate(ACRE_REFORM_EFFECTIVE_DATE);
  return isOnOrAfterCalendarDate(businessStartDate, reformDate)
    ? "post_reform_2026_07"
    : "pre_reform";
}

// Strict "after" (calendar day granularity) — the mirror of
// isOnOrAfterCalendarDate above, needed to gate expiry inclusively (the
// official end date itself is still an active day; only the day after it
// is expired).
function isStrictlyAfterCalendarDate(date, referenceDate) {
  if (date.getFullYear() !== referenceDate.getFullYear()) {
    return date.getFullYear() > referenceDate.getFullYear();
  }
  if (date.getMonth() !== referenceDate.getMonth()) {
    return date.getMonth() > referenceDate.getMonth();
  }
  return date.getDate() > referenceDate.getDate();
}

// LOT 10.1C: owner-verified against three official URSSAF examples —
// creation 2026-07-01 -> through 2027-06-30; 2026-09-21 -> through
// 2027-06-30; 2026-10-05 -> through 2027-09-30. The reduced-rate window for
// the post-reform cohort is NOT a flat 12 months from any date: it runs
// through the end of the calendar quarter that is three quarters after the
// quarter containing the official business creation date (i.e. through the
// end of the 4th quarter counting the creation quarter as the first). This
// depends only on which calendar quarter the creation date falls in, not on
// acreStartDate at all -- confirmed by the first two examples sharing an
// identical end date despite falling ~11 weeks apart within the same quarter.
function quarterIndexOfMonth(month0) {
  return Math.floor(month0 / 3);
}

function lastDayOfCalendarQuarter(year, quarter0) {
  const lastMonthOfQuarter0 = quarter0 * 3 + 2;
  return new Date(year, lastMonthOfQuarter0 + 1, 0);
}

function computePostReformAcreEndDate(businessStartDate) {
  const year = businessStartDate.getFullYear();
  const creationQuarter0 = quarterIndexOfMonth(businessStartDate.getMonth());
  const absoluteQuarterIndex = year * 4 + creationQuarter0;
  const targetAbsoluteQuarterIndex = absoluteQuarterIndex + 3;
  const targetYear = Math.floor(targetAbsoluteQuarterIndex / 4);
  const targetQuarter0 = targetAbsoluteQuarterIndex - targetYear * 4;
  return lastDayOfCalendarQuarter(targetYear, targetQuarter0);
}

export function getAcreRule(context = {}) {
  context = context || {};
  const acre = context.acre;
  const activityType = context.activityType || context.activity_type;
  const startDate = coerceDate(context.acreStartDate || context.acre_start_date);
  const today = coerceDate(context.today) || new Date();
  const baseContributionRule = getContributionRule({ activityType });
  const baseRate = baseContributionRule.value;
  let acreActive = false;
  let effectiveRate = baseRate;
  let acreMonthsLeft = null;
  let acreEndDate = null;
  let acreStatus = "inactive";
  let fallback = null;
  let regime = null;
  let reductionFactor = null;

  const businessStartDateProvided =
    hasOwnBusinessStartDate(context) && !isBlank(rawBusinessStartDate(context));
  const businessStartDate = businessStartDateProvided
    ? coerceDate(rawBusinessStartDate(context))
    : null;
  const businessStartDateInvalid = businessStartDateProvided && !businessStartDate;

  if (acre === "yes" && baseRate > 0) {
    if (!businessStartDateProvided) {
      acreStatus = "regime_unknown";
      fallback = "acre_regime_unknown_missing_business_start_date";
    } else if (businessStartDateInvalid) {
      acreStatus = "regime_unknown";
      fallback = "acre_regime_unknown_invalid_business_start_date";
    } else {
      regime = resolveAcreRegime(businessStartDate);
      reductionFactor =
        regime === "post_reform_2026_07"
          ? ACRE_POST_REFORM_REDUCTION_FACTOR
          : ACRE_PRE_REFORM_REDUCTION_FACTOR;
      acreActive = true;
      effectiveRate = baseRate * (1 - reductionFactor);
      acreStatus = "active";

      if (regime === "post_reform_2026_07") {
        // Duration for this cohort depends only on businessStartDate (the
        // official creation date), never on acreStartDate -- see LOT 10.1C.
        const endDate = computePostReformAcreEndDate(businessStartDate);
        acreEndDate = endDate;
        acreMonthsLeft = Math.max(0, monthsBetween(today, endDate));

        if (isStrictlyAfterCalendarDate(today, endDate)) {
          acreActive = false;
          effectiveRate = baseRate;
          acreStatus = "expired";
        }
      } else if (startDate) {
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 12);
        acreMonthsLeft = Math.max(0, 12 - monthsBetween(startDate, today));
        acreEndDate = endDate;

        if (acreMonthsLeft <= 0) {
          acreActive = false;
          effectiveRate = baseRate;
          acreStatus = "expired";
        }
      } else {
        fallback = "acre_active_without_start_date";
      }
    }
  } else if (acre === "unknown") {
    fallback = "acre_unknown_no_rate_reduction";
  }

  return withRuleTrace({
    ruleId: "ACRE_DATE_AWARE_2026_07_REFORM_V2",
    name: "ACRE avec reforme datee du 1er juillet 2026",
    description:
      "Applique 50% (avant reforme, 12 mois depuis acreStartDate) ou 75% (a partir du 1er juillet 2026, jusqu'a la fin du trimestre civil trois trimestres apres celui de businessStartDate) du taux normal selon la date de creation officielle de l'activite, quand ACRE vaut yes.",
    inputs: ["acre", "acreStartDate", "businessStartDate", "activityType", "today"],
    value: {
      reformEffectiveDate: ACRE_REFORM_EFFECTIVE_DATE,
      preReformReductionFactor: ACRE_PRE_REFORM_REDUCTION_FACTOR,
      postReformReductionFactor: ACRE_POST_REFORM_REDUCTION_FACTOR,
      preReformDurationMonths: 12,
      postReformDurationRule: "end_of_third_calendar_quarter_after_creation_quarter",
      activeThresholdMonthsLeft: 0,
    },
    output: {
      acreActive,
      acreMonthsLeft,
      acreEndDate,
      acreStatus,
      baseRate,
      effectiveRate,
      regime,
      reductionFactor,
    },
    sourceReference:
      "src/utils/obligations.js#computeObligations ACRE LOGIC ; owner-verified URSSAF rule (LOT 10.1B section 1, LOT 10.1C section 1)",
    reason:
      "Preserve la duree de 12 mois depuis acreStartDate pour la cohorte pre-reforme ; applique la duree par trimestre civil verifiee par le proprietaire (LOT 10.1C) pour la cohorte post-reforme, basee uniquement sur businessStartDate. N'invente jamais un regime quand businessStartDate est absente ou invalide.",
    fallback,
    warnings: [
      acreStatus === "regime_unknown"
        ? "Regime ACRE non resolu : businessStartDate manquante ou invalide, taux plein applique par prudence."
        : null,
    ].filter(Boolean),
    confidence: acreStatus === "regime_unknown" ? "low" : "medium",
  });
}
