import { ACCESS_MATRIX, getAccessProfile } from "../../config/accessMatrix.js";
import { PRICING_LIMITS } from "../../config/pricing.js";
import { withRuleTrace } from "./ruleSet.js";

const DAY_MS = 1000 * 60 * 60 * 24;

function coerceDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTrialDaysLeftRule(context = {}) {
  context = context || {};
  const trialEndDate = coerceDate(context.trialEndsAt || context.trial_ends_at);
  const today = coerceDate(context.today) || new Date();
  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - today.getTime()) / DAY_MS))
    : null;

  return withRuleTrace({
    ruleId: "PREMIUM_TRIAL_DAYS_LEFT",
    name: "Jours restants essai",
    description: "Reproduit getTrialDaysLeft avec date injectee.",
    inputs: ["trialEndsAt", "today"],
    value: { dayMs: DAY_MS },
    output: { daysLeft, isExpired: daysLeft !== null && daysLeft <= 0 },
    sourceReference: "src/App.jsx#getTrialDaysLeft,#isTrialExpired",
    reason: "Preserve les seuils de fin d'essai existants.",
    fallback: trialEndDate ? null : "missing_or_invalid_trial_end",
    warnings: ["Date courante injectee pour garder l'API pure."],
    confidence: "medium",
  });
}

export function getPremiumRule(context = {}) {
  context = context || {};
  const accessProfile = getAccessProfile({
    isGuest: context.isGuest,
    isPremiumUser: context.isPremiumUser,
    isFounder: context.isFounder,
    isEarlyFullAccess: context.isEarlyFullAccess,
    billingUiState: context.billingUiState,
  });
  const matrixEntry = ACCESS_MATRIX[accessProfile];
  const pricingPlan = context.pricingPlan || accessProfile;

  return withRuleTrace({
    ruleId: "PREMIUM_ACCESS_MATRIX_CURRENT",
    name: "Matrice acces premium courante",
    description:
      "Expose la selection de profil d'acces et les limites pricing actuelles.",
    inputs: [
      "isGuest",
      "isPremiumUser",
      "isFounder",
      "isEarlyFullAccess",
      "billingUiState",
      "pricingPlan",
    ],
    value: {
      accessProfile,
      features: matrixEntry?.features || {},
      pricingLimits: PRICING_LIMITS[pricingPlan] || null,
    },
    output: {
      accessProfile,
      features: matrixEntry?.features || {},
      pricingLimits: PRICING_LIMITS[pricingPlan] || null,
    },
    sourceReference: "src/config/accessMatrix.js, src/config/pricing.js",
    reason: "Preserve l'offre produit et les fallbacks d'acces existants.",
    fallback: matrixEntry ? null : "unknown_access_profile",
    warnings: ["Offre produit non modifiee dans LOT 3."],
    confidence: "medium",
  });
}

export function getPremiumTriggerRule(context = {}) {
  context = context || {};
  const trialDaysLeft = context.trialDaysLeft;
  const daysBeforeDeadline = context.daysBeforeDeadline;
  let trigger = null;

  if (context.isPremium) trigger = null;
  else if (trialDaysLeft !== null && trialDaysLeft <= 7 && trialDaysLeft > 0) {
    trigger = "trial_ending";
  } else if (daysBeforeDeadline !== null && daysBeforeDeadline <= 7) {
    trigger = "deadline_soon";
  } else if (Number(context.revenuesCount || 0) >= 3) {
    trigger = "engaged_user";
  } else if (Number(context.lastActivityDays || 0) >= 7) {
    trigger = "inactive_user";
  }

  return withRuleTrace({
    ruleId: "PREMIUM_TRIGGER_CURRENT",
    name: "Declencheur premium courant",
    description: "Reproduit getPremiumTrigger.",
    inputs: [
      "revenuesCount",
      "trialDaysLeft",
      "daysBeforeDeadline",
      "isPremium",
      "lastActivityDays",
    ],
    value: {
      trialEndingDays: 7,
      deadlineSoonDays: 7,
      engagedRevenuesCount: 3,
      inactiveActivityDays: 7,
    },
    output: { trigger },
    sourceReference: "src/App.jsx#getPremiumTrigger",
    reason: "Preserve les triggers premium existants sans modifier l'UX.",
    fallback: trigger ? null : "no_trigger",
    warnings: ["Regle produit, non reglementaire."],
    confidence: "medium",
  });
}
