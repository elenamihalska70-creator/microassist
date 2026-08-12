import {
  ACRE_VALUES,
  ACTIVITY_TYPES,
  DECLARATION_FREQUENCIES,
  REVENUE_CATEGORIES,
  TVA_MODES,
  TVA_STATUSES,
} from "../constants.js";
import { isKnownValue, isPlainObject, normalizeDateOnly } from "../validation.js";

export function pickKnown(value, allowedValues, fallback = null) {
  return isKnownValue(value, allowedValues) ? value : fallback;
}

export function normalizeObject(value) {
  return isPlainObject(value) ? value : {};
}

export function normalizeActivityType(value) {
  return pickKnown(value, ACTIVITY_TYPES, null);
}

export function normalizeRevenueCategory(value) {
  return pickKnown(value, REVENUE_CATEGORIES, REVENUE_CATEGORIES.unset);
}

export function normalizeDeclarationFrequency(value) {
  return pickKnown(value, DECLARATION_FREQUENCIES, null);
}

export function normalizeAcreValue(value) {
  return pickKnown(value, ACRE_VALUES, null);
}

export function normalizeTvaStatus(value) {
  if (value === "tva" || value === "assujetti") return TVA_STATUSES.active;
  return pickKnown(value, TVA_STATUSES, TVA_STATUSES.unknown);
}

export function normalizeTvaMode(value) {
  return pickKnown(value, TVA_MODES, null);
}

export function normalizeDateValue(value) {
  return normalizeDateOnly(value);
}
