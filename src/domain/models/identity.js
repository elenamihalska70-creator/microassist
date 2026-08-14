import {
  DATA_SOURCES,
  PREMIUM_ACCESS_STATES,
  PREMIUM_PLANS,
} from "../constants.js";
import {
  isKnownValue,
  normalizeNonNegativeAmount,
  normalizeTimestamp,
} from "../validation.js";
import {
  ACTIVITY_TYPES,
  DECLARATION_FREQUENCIES,
} from "../constants.js";
import {
  normalizeActivityType,
  normalizeDateValue,
  normalizeDeclarationFrequency,
  normalizeObject,
  normalizeTvaMode,
  normalizeTvaStatus,
  pickKnown,
  normalizeAcreValue,
} from "./shared.js";

/**
 * @typedef {string} UserId
 * @typedef {string} ProfileId
 *
 * Existing sources:
 * - Supabase Auth user/session.
 * - Supabase `profiles`.
 * - Supabase `fiscal_profiles`.
 * - localStorage `microassist_profile_v1` and `microassist_v1.answers`.
 */

export function createUserAccount(input = {}) {
  const source = normalizeObject(input);
  const id = source.id || source.user_id || source.userId || null;

  return {
    ...source,
    id,
    userId: source.userId || source.user_id || id,
    email: source.email || null,
    fullName: source.fullName || source.full_name || source.display_name || null,
    createdAt: source.createdAt || source.created_at || null,
    updatedAt: source.updatedAt || source.updated_at || null,
    source: source.source || DATA_SOURCES.supabase,
  };
}

export function normalizeSubscription(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || null,
    userId: source.userId || source.user_id || null,
    plan: pickKnown(source.plan, PREMIUM_PLANS, PREMIUM_PLANS.free),
    status: source.status || source.subscription_status || null,
    isPremium: Boolean(source.isPremium ?? source.is_premium ?? false),
    accessState: pickKnown(
      source.accessState || source.access_state,
      PREMIUM_ACCESS_STATES,
      null,
    ),
    trialStartedAt:
      normalizeTimestamp(source.trialStartedAt || source.trial_started_at) || null,
    trialEndsAt: normalizeTimestamp(source.trialEndsAt || source.trial_ends_at) || null,
    stripeCustomerId: source.stripeCustomerId || source.stripe_customer_id || null,
    stripeSubscriptionId:
      source.stripeSubscriptionId || source.stripe_subscription_id || null,
    source: source.source || DATA_SOURCES.supabase,
  };
}

export function normalizeFiscalProfile(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || source.user_id || source.userId || null,
    userId: source.userId || source.user_id || source.id || null,
    businessStatus:
      source.businessStatus || source.business_status || source.status || null,
    activityType: normalizeActivityType(source.activityType || source.activity_type),
    declarationFrequency: normalizeDeclarationFrequency(
      source.declarationFrequency || source.declaration_frequency,
    ),
    acre: normalizeAcreValue(source.acre),
    acreStartDate: normalizeDateValue(source.acreStartDate || source.acre_start_date),
    businessStartDate: normalizeDateValue(
      source.businessStartDate || source.business_start_date,
    ),
    tvaStatus: normalizeTvaStatus(source.tvaStatus || source.tva_status),
    tvaMode: normalizeTvaMode(source.tvaMode || source.tva_mode),
    monthlyRevenue: normalizeNonNegativeAmount(
      source.monthlyRevenue ?? source.monthly_revenue,
      null,
    ),
    starterMonthlyRevenue: normalizeNonNegativeAmount(
      source.starterMonthlyRevenue ?? source.starter_monthly_revenue,
      null,
    ),
    dataQuality: source.dataQuality || source.data_quality || null,
    updatedAt: source.updatedAt || source.updated_at || null,
    source: source.source || DATA_SOURCES.supabase,
  };
}

export function normalizeBusinessProfile(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || source.profileId || source.profile_id || null,
    userId: source.userId || source.user_id || null,
    legalName: source.legalName || source.legal_name || source.full_name || null,
    displayName: source.displayName || source.display_name || null,
    siren: source.siren || null,
    siret: source.siret || null,
    address: source.address || null,
    billingIdentity: source.billingIdentity || source.billing_identity || null,
    activityType: normalizeActivityType(source.activityType || source.activity_type),
    businessStartDate: normalizeDateValue(
      source.businessStartDate || source.business_start_date,
    ),
    source: source.source || DATA_SOURCES.supabase,
  };
}

export function validateFiscalProfile(profile) {
  const normalized = normalizeFiscalProfile(profile);
  const rawActivityType = profile?.activityType ?? profile?.activity_type;
  const rawDeclarationFrequency =
    profile?.declarationFrequency ?? profile?.declaration_frequency;
  const errors = [];

  if (
    rawActivityType !== undefined &&
    !isKnownValue(rawActivityType, ACTIVITY_TYPES)
  ) {
    errors.push("activityType is not allowed");
  }

  if (
    rawDeclarationFrequency !== undefined &&
    !isKnownValue(rawDeclarationFrequency, DECLARATION_FREQUENCIES)
  ) {
    errors.push("declarationFrequency is not allowed");
  }

  if (
    normalized.acreStartDate === null &&
    (profile?.acreStartDate || profile?.acre_start_date)
  ) {
    errors.push("acreStartDate must use YYYY-MM-DD");
  }

  return { valid: errors.length === 0, errors, value: normalized };
}

export const normalizeSupabaseFiscalProfile = normalizeFiscalProfile;
export const normalizeLocalFiscalProfile = normalizeFiscalProfile;
