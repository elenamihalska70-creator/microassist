import { getVatRule } from "../rules/vatRules.js";
import { createAction } from "./actionObject.js";
import { ACTION_TYPE, SEVERITY, PRIORITY_TIER } from "./constants.js";

/**
 * Represents the TVA (VAT) threshold obligation, reusing the existing
 * vatRules.js threshold/proximity logic rather than duplicating it.
 * Returns null when revenue is comfortably below the threshold (vatStatus
 * "ok") -- there is nothing actionable to surface.
 */
export function buildTvaThresholdAction(context = {}) {
  const fiscalProfile = context.fiscalProfile ?? {};
  const vatRule = getVatRule({
    activityType: fiscalProfile.activity_type,
    monthlyRevenue: context.monthlyRevenue,
    yearToDateRevenue: context.yearToDateRevenue,
    monthsWithData: context.monthsWithData,
  });
  const { vatStatus, threshold, projectedRevenue } = vatRule.output;

  if (vatStatus !== "exceeded" && vatStatus !== "soon") {
    return null;
  }

  const isExceeded = vatStatus === "exceeded";

  return createAction({
    id: `tva-threshold-${vatStatus}`,
    type: ACTION_TYPE.tvaThreshold,
    severity: isExceeded ? SEVERITY.critical : SEVERITY.urgent,
    priorityTier: isExceeded ? PRIORITY_TIER.preventHarm : PRIORITY_TIER.approachingObligation,
    titleKey: `obligation.tva_threshold.${vatStatus}`,
    source: "domain.rules.vatRules#getVatRule",
    confidence: vatRule.confidence,
    reason: isExceeded
      ? `Projected revenue (${projectedRevenue} EUR) has exceeded the VAT threshold (${threshold} EUR).`
      : `Projected revenue (${projectedRevenue} EUR) is approaching the VAT threshold (${threshold} EUR).`,
    metadata: { vatStatus, threshold, projectedRevenue },
  });
}
