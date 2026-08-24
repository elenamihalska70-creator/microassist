import { ACTIVITY_TYPES } from "../constants.js";
import { withRuleTrace } from "./ruleSet.js";

export const CONTRIBUTION_RATES = Object.freeze({
  [ACTIVITY_TYPES.services]: 0.22,
  [ACTIVITY_TYPES.commerce]: 0.123,
  [ACTIVITY_TYPES.mixed]: 0.18,
});

export function getContributionRule(context = {}) {
  context = context || {};
  const activityType = context.activityType || context.activity_type;
  const hasKnownActivity = Object.hasOwn(CONTRIBUTION_RATES, activityType);
  const rate = hasKnownActivity ? CONTRIBUTION_RATES[activityType] : 0;

  return withRuleTrace({
    ruleId: hasKnownActivity
      ? `CONTRIBUTION_RATE_${String(activityType).toUpperCase()}`
      : "CONTRIBUTION_RATE_UNKNOWN_FALLBACK",
    name: hasKnownActivity
      ? `Taux de cotisations ${activityType}`
      : "Fallback taux de cotisations inconnu",
    description:
      "Taux simplifie actuellement utilise par computeObligations.",
    inputs: ["activityType"],
    value: rate,
    output: { rate },
    sourceReference: "src/utils/obligations.js#getRate",
    reason:
      "Preserve exactement la table de taux actuelle et son fallback a 0.",
    fallback: hasKnownActivity ? null : "unknown_activity_rate_zero",
    warnings: [
      "Provenance reglementaire non verifiee dans ce lot.",
      activityType === ACTIVITY_TYPES.mixed
        ? "Activite mixte simplifiee a un taux global historique."
        : null,
    ].filter(Boolean),
    confidence: hasKnownActivity ? "medium" : "low",
  });
}

export function getRevenueContributionRule(context = {}) {
  context = context || {};
  const category = context.category || context.revenueCategory;

  if (category === "vente") {
    return getContributionRule({ activityType: ACTIVITY_TYPES.commerce });
  }

  if (category === "service") {
    return getContributionRule({ activityType: ACTIVITY_TYPES.services });
  }

  return getContributionRule(context);
}
