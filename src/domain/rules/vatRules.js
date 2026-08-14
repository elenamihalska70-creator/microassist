import { ACTIVITY_TYPES } from "../constants.js";
import { withRuleTrace } from "./ruleSet.js";

export const VAT_THRESHOLDS = Object.freeze({
  [ACTIVITY_TYPES.services]: 36800,
  [ACTIVITY_TYPES.commerce]: 91900,
  [ACTIVITY_TYPES.mixed]: 36800,
});

export const SIMPLE_ASSISTANT_VAT_WARNING_THRESHOLD = 30000;

export const VAT_PROXIMITY_RATIO = 0.8;

export function getAnnualRevenueProjectionRule(context = {}) {
  context = context || {};
  const monthlyRevenue = Number(context.monthlyRevenue ?? context.ca_month ?? 0);
  const yearToDateRevenue = Number(context.yearToDateRevenue ?? context.ca_ytd ?? 0);
  const monthsWithData = Number(context.monthsWithData ?? context.months_with_data ?? 1);

  if (yearToDateRevenue > 0 && monthsWithData > 1) {
    const projectedRevenue = Math.round((yearToDateRevenue / monthsWithData) * 12);

    return withRuleTrace({
      ruleId: "VAT_PROJECTION_YTD_AVERAGE",
      name: "Projection TVA moyenne historique",
      description:
        "Projection annuelle par moyenne mensuelle quand CA YTD et mois de donnees sont suffisants.",
      inputs: ["yearToDateRevenue", "monthsWithData"],
      value: { mode: "moyenne" },
      output: { projectedRevenue, mode: "moyenne" },
      sourceReference: "src/utils/obligations.js#computeObligations",
      reason: "Reproduit le choix de projection actuel.",
      fallback: null,
      warnings: ["Projection technique non sourcee officiellement."],
      confidence: "medium",
    });
  }

  return withRuleTrace({
    ruleId: "VAT_PROJECTION_SINGLE_MONTH_ESTIMATE",
    name: "Projection TVA estimation mensuelle historique",
    description:
      "Projection annuelle par multiplication du CA mensuel par 12.",
    inputs: ["monthlyRevenue"],
    value: { mode: "estimation", multiplier: 12 },
    output: { projectedRevenue: monthlyRevenue * 12, mode: "estimation" },
    sourceReference: "src/utils/obligations.js#computeObligations",
    reason: "Reproduit le fallback de projection actuel.",
    fallback: "single_month_times_12",
    warnings: ["Projection simplifiee non sourcee officiellement."],
    confidence: "medium",
  });
}

export function getVatRule(context = {}) {
  context = context || {};
  const activityType = context.activityType || context.activity_type;
  const monthlyRevenue = Number(context.monthlyRevenue ?? context.ca_month ?? 0);
  const threshold = VAT_THRESHOLDS[activityType] || 0;
  const projectionRule = getAnnualRevenueProjectionRule(context);
  const projectedRevenue = projectionRule.output.projectedRevenue;
  let vatStatus = "ok";

  if (threshold > 0 && monthlyRevenue > 0) {
    const ratio = projectedRevenue / threshold;
    if (ratio >= 1) vatStatus = "exceeded";
    else if (ratio >= VAT_PROXIMITY_RATIO) vatStatus = "soon";
  }

  return withRuleTrace({
    ruleId: threshold > 0 ? `VAT_THRESHOLD_${String(activityType).toUpperCase()}` : "VAT_THRESHOLD_UNKNOWN",
    name: "Seuil TVA historique",
    description:
      "Determine le statut TVA courant a partir des seuils codes dans computeObligations.",
    inputs: ["activityType", "monthlyRevenue", "yearToDateRevenue", "monthsWithData"],
    value: {
      threshold,
      proximityRatio: VAT_PROXIMITY_RATIO,
      projectedRevenue,
      projectionMode: projectionRule.output.mode,
    },
    output: {
      threshold,
      projectedRevenue,
      projectionMode: projectionRule.output.mode,
      vatStatus,
      vatUrgency:
        vatStatus === "exceeded" ? "late" : vatStatus === "soon" ? "soon" : null,
    },
    sourceReference: "src/utils/obligations.js#computeObligations TVA CALCULATIONS",
    reason:
      "Preserve les seuils services, commerce, mixte et la proximite a 80%.",
    fallback: threshold > 0 ? null : "unknown_activity_threshold_zero",
    warnings: [
      "Provenance reglementaire non verifiee dans ce lot.",
      activityType === ACTIVITY_TYPES.mixed
        ? "Seuil mixte simplifie a 36 800 EUR dans le comportement actuel."
        : null,
    ].filter(Boolean),
    confidence: threshold > 0 ? "medium" : "low",
  });
}

export function getSimpleAssistantVatRule(context = {}) {
  context = context || {};
  const monthlyRevenue = Number(context.monthlyRevenue ?? 0);
  let tone = "success";
  let status = "ok";

  if (monthlyRevenue > VAT_THRESHOLDS[ACTIVITY_TYPES.services]) {
    tone = "danger";
    status = "exceeded";
  } else if (monthlyRevenue > SIMPLE_ASSISTANT_VAT_WARNING_THRESHOLD) {
    tone = "warning";
    status = "soon";
  } else if (context.tvaStatus === "unknown") {
    status = "unknown";
  }

  return withRuleTrace({
    ruleId: "VAT_SIMPLE_ASSISTANT_MONTHLY_WARNING",
    name: "Alerte TVA onboarding simple",
    description:
      "Regle TVA complementaire presente dans buildSimpleAssistantGuidance.",
    inputs: ["monthlyRevenue", "tvaStatus"],
    value: {
      exceededAbove: VAT_THRESHOLDS[ACTIVITY_TYPES.services],
      warningAbove: SIMPLE_ASSISTANT_VAT_WARNING_THRESHOLD,
    },
    output: { status, tone },
    sourceReference: "src/App.jsx#buildSimpleAssistantGuidance",
    reason:
      "Documente une regle mensuelle dupliquee et differente de computeObligations sans la corriger.",
    fallback: null,
    warnings: [
      "Duplication App.jsx / obligations.js.",
      "Seuil mensuel 30 000 EUR non verifie officiellement.",
    ],
    confidence: "low",
  });
}
