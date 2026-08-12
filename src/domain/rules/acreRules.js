import { getContributionRule } from "./contributionRules.js";
import { withRuleTrace } from "./ruleSet.js";

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

  if (acre === "yes" && baseRate > 0) {
    acreActive = true;
    effectiveRate = baseRate / 2;
    acreStatus = "active";

    if (startDate) {
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
  } else if (acre === "unknown") {
    fallback = "acre_unknown_no_rate_reduction";
  }

  return withRuleTrace({
    ruleId: "ACRE_CURRENT_12_MONTHS_HALF_RATE",
    name: "ACRE historique courante",
    description:
      "Applique la reduction actuelle baseRate / 2 pendant 12 mois quand ACRE vaut yes.",
    inputs: ["acre", "acreStartDate", "activityType", "today"],
    value: {
      reductionFactor: 0.5,
      durationMonths: 12,
      activeThresholdMonthsLeft: 0,
    },
    output: {
      acreActive,
      acreMonthsLeft,
      acreEndDate,
      acreStatus,
      baseRate,
      effectiveRate,
    },
    sourceReference: "src/utils/obligations.js#computeObligations ACRE LOGIC",
    reason:
      "Preserve la logique existante, y compris la duree simplifiee de 12 mois et la division par deux.",
    fallback,
    warnings: [
      "Provenance reglementaire non verifiee dans ce lot.",
      "La Product Vision documente une evolution ACRE future a ne pas appliquer ici.",
    ],
    confidence: "medium",
  });
}
