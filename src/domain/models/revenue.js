import { DATA_SOURCES, REVENUE_CATEGORIES } from "../constants.js";
import {
  isKnownValue,
  normalizeNonNegativeAmount,
  validateDateOnly,
  validateNonNegativeAmount,
} from "../validation.js";
import {
  normalizeDateValue,
  normalizeObject,
  normalizeRevenueCategory,
} from "./shared.js";

/**
 * @typedef {string} RevenueId
 *
 * Existing sources:
 * - Supabase `revenues`: id, user_id, amount, revenue_date, revenue_category,
 *   client, invoice, note, created_at.
 * - localStorage `revenues_guest`: id, amount, date, revenue_category, client,
 *   invoice, note.
 */

export function normalizeRevenue(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || null,
    userId: source.userId || source.user_id || null,
    amount: normalizeNonNegativeAmount(source.amount, 0),
    date: normalizeDateValue(source.date || source.revenue_date),
    revenueCategory: normalizeRevenueCategory(
      source.revenueCategory || source.revenue_category,
    ),
    client: source.client || "",
    invoice: source.invoice || source.invoice_id || "",
    note: source.note || "",
    createdAt: source.createdAt || source.created_at || null,
    updatedAt: source.updatedAt || source.updated_at || null,
    source: source.source || DATA_SOURCES.localStorage,
  };
}

export function validateRevenue(revenue) {
  const normalized = normalizeRevenue(revenue);
  const rawCategory = revenue?.revenueCategory ?? revenue?.revenue_category;
  const errors = [
    ...validateNonNegativeAmount(revenue?.amount, "amount").errors,
  ];

  if (!normalized.date) {
    errors.push(...validateDateOnly(revenue?.date || revenue?.revenue_date, "date").errors);
  }

  if (
    rawCategory !== undefined &&
    !isKnownValue(rawCategory, REVENUE_CATEGORIES)
  ) {
    errors.push("revenueCategory is not allowed");
  }

  return { valid: errors.length === 0, errors, value: normalized };
}

export const normalizeSupabaseRevenue = normalizeRevenue;
export const normalizeLocalRevenue = normalizeRevenue;
