import { compareLocalDates } from "../dates.js";
import { normalizeRevenue } from "./normalizeRevenue.js";

function createFilterWarning(code, field, details = {}, sourceId = null) {
  return {
    code,
    severity: "warning",
    domain: "revenue",
    field,
    sourceId,
    details,
  };
}

function isRevenueInvalid(revenue, options) {
  if (revenue.amount === null) return true;
  if (options.requireDate && revenue.date === null) return true;
  if (!options.includeNegative && revenue.amount < 0) return true;
  if (!options.includeZero && revenue.amount === 0) return true;
  return false;
}

function isInPeriod(revenue, period) {
  if (!period) return true;
  if (!revenue.date) return false;

  const { from = null, to = null } = period;
  if (from && compareLocalDates(revenue.date, from) < 0) return false;
  if (to && compareLocalDates(revenue.date, to) > 0) return false;
  return true;
}

export function filterRevenues(revenues = [], options = {}) {
  if (!Array.isArray(revenues)) {
    throw new TypeError("revenues must be an array");
  }

  const {
    category = null,
    excludeInvalid = false,
    includeNegative = true,
    includeZero = true,
    period = null,
    requireDate = Boolean(period),
    trace = false,
  } = options;
  const warnings = [];
  const traceEntries = [];
  const filtered = [];

  for (const source of revenues) {
    const revenue = normalizeRevenue(source, options);
    warnings.push(...revenue.warnings);

    const invalid = isRevenueInvalid(revenue, {
      includeNegative,
      includeZero,
      requireDate,
    });
    const categoryMismatch = category !== null && revenue.revenueCategory !== category;
    const periodMismatch = !isInPeriod(revenue, period);
    const shouldExclude =
      (excludeInvalid && invalid) || categoryMismatch || periodMismatch;

    if (excludeInvalid && invalid) {
      warnings.push(
        createFilterWarning(
          "REVENUE_EXCLUDED_AS_INVALID",
          null,
          {
            amount: revenue.amount === null ? "invalid" : "valid",
            date: revenue.date === null ? "invalid" : "valid",
          },
          revenue.id,
        ),
      );
    }

    if (trace) {
      traceEntries.push({
        step: shouldExclude ? "revenue.filter.exclude" : "revenue.filter.include",
        domain: "revenue",
        inputRef: revenue.id,
        operation: "filter",
        valueBefore: revenue.amount,
        valueAfter: shouldExclude ? null : revenue.amount,
        ruleId: null,
        metadata: {
          categoryMismatch,
          periodMismatch,
          invalid,
        },
      });
    }

    if (!shouldExclude) {
      filtered.push(revenue);
    }
  }

  return {
    revenues: filtered,
    includedCount: filtered.length,
    excludedCount: revenues.length - filtered.length,
    warnings,
    trace: trace ? traceEntries : [],
  };
}
