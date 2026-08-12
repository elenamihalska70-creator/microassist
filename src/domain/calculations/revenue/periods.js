import {
  compareLocalDates,
  daysInMonth,
  formatLocalDate,
} from "../dates.js";
import { calculateRevenueTotal } from "./calculateRevenueTotal.js";
import { filterRevenues } from "./filterRevenues.js";

function createRevenueWarning(code, field, details = {}, sourceId = null) {
  return {
    code,
    severity: "warning",
    domain: "revenue",
    field,
    sourceId,
    details,
  };
}

function createTraceEntry(step, operation, metadata, valueAfter = null) {
  return {
    step,
    domain: "revenue",
    inputRef: null,
    operation,
    valueBefore: null,
    valueAfter,
    ruleId: null,
    metadata,
  };
}

function normalizeYear(year) {
  if (typeof year === "string" && !/^\d{4}$/.test(year)) {
    return null;
  }

  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1 || numericYear > 9999) {
    return null;
  }

  return numericYear;
}

function formatYear(year) {
  return String(year).padStart(4, "0");
}

function formatMonthKey(year, month) {
  return `${formatYear(year)}-${String(month).padStart(2, "0")}`;
}

function buildMonthPeriod(year, month) {
  const endDay = daysInMonth(year, month);
  const monthKey = formatMonthKey(year, month);

  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(endDay).padStart(2, "0")}`,
  };
}

function buildYearPeriod(year) {
  return {
    startDate: `${formatYear(year)}-01-01`,
    endDate: `${formatYear(year)}-12-31`,
  };
}

function buildQuarterPeriod(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = daysInMonth(year, endMonth);

  return {
    startDate: `${formatMonthKey(year, startMonth)}-01`,
    endDate: `${formatMonthKey(year, endMonth)}-${String(endDay).padStart(2, "0")}`,
  };
}

function validatePeriod(period = {}) {
  const source = period && typeof period === "object" ? period : {};
  const startDate = formatLocalDate(source.startDate);
  const endDate = formatLocalDate(source.endDate);
  const warnings = [];

  if (!startDate) {
    warnings.push(
      createRevenueWarning(
        "INVALID_REVENUE_PERIOD_START_DATE",
        "period.startDate",
        { reason: "invalid_local_date" },
      ),
    );
  }

  if (!endDate) {
    warnings.push(
      createRevenueWarning(
        "INVALID_REVENUE_PERIOD_END_DATE",
        "period.endDate",
        { reason: "invalid_local_date" },
      ),
    );
  }

  if (startDate && endDate && compareLocalDates(startDate, endDate) > 0) {
    warnings.push(
      createRevenueWarning(
        "INVALID_REVENUE_PERIOD_ORDER",
        "period",
        { reason: "start_after_end" },
      ),
    );
  }

  return {
    period: { startDate, endDate },
    valid: warnings.length === 0,
    warnings,
  };
}

function filterOptionsWithoutPeriod(options) {
  const { period: _period, ...rest } = options;
  return rest;
}

function emptyPeriodResult(period, revenues, warnings, trace) {
  return {
    total: 0,
    count: 0,
    includedCount: 0,
    excludedCount: Array.isArray(revenues) ? revenues.length : 0,
    period,
    valid: false,
    warnings,
    trace,
  };
}

function filterRevenuesForYear(revenues, year, options = {}) {
  const period = buildYearPeriod(year);

  return filterRevenues(revenues, {
    ...filterOptionsWithoutPeriod(options),
    excludeInvalid: true,
    period: {
      from: period.startDate,
      to: period.endDate,
    },
    requireDate: true,
  });
}

export function calculateRevenueForPeriod(revenues = [], period = {}, options = {}) {
  const validation = validatePeriod(period);
  const traceEntries = options.trace
    ? [
        createTraceEntry("revenue.period.validate", "validate", {
          period: validation.period,
          valid: validation.valid,
        }),
      ]
    : [];

  if (!validation.valid) {
    return emptyPeriodResult(
      validation.period,
      revenues,
      validation.warnings,
      traceEntries,
    );
  }

  const result = calculateRevenueTotal(revenues, {
    ...options,
    excludeInvalid: options.excludeInvalid ?? true,
    period: {
      from: validation.period.startDate,
      to: validation.period.endDate,
    },
    requireDate: true,
  });

  return {
    total: result.total,
    count: result.includedCount,
    includedCount: result.includedCount,
    excludedCount: result.excludedCount,
    period: validation.period,
    valid: true,
    warnings: [...validation.warnings, ...result.warnings],
    trace: options.trace
      ? [
          ...traceEntries,
          ...result.trace,
          createTraceEntry(
            "revenue.period.total",
            "sum",
            {
              period: validation.period,
              includedCount: result.includedCount,
              excludedCount: result.excludedCount,
            },
            result.total,
          ),
        ]
      : [],
  };
}

export function calculateMonthlyRevenueTotals(revenues = [], year, options = {}) {
  const normalizedYear = normalizeYear(year);

  if (normalizedYear === null) {
    return {
      year: null,
      months: [],
      total: 0,
      includedCount: 0,
      excludedCount: Array.isArray(revenues) ? revenues.length : 0,
      valid: false,
      warnings: [
        createRevenueWarning(
          "INVALID_REVENUE_YEAR",
          "year",
          { reason: "invalid_calendar_year" },
        ),
      ],
      trace: options.trace
        ? [createTraceEntry("revenue.monthly.validate", "validate", { valid: false })]
        : [],
    };
  }

  const filtered = filterRevenuesForYear(revenues, normalizedYear, options);
  const monthlyGroups = new Map();

  for (let month = 1; month <= 12; month += 1) {
    monthlyGroups.set(month, []);
  }

  for (const revenue of filtered.revenues) {
    const month = Number(revenue.date.slice(5, 7));
    monthlyGroups.get(month).push(revenue);
  }

  const months = Array.from(monthlyGroups, ([month, group]) => {
    const period = buildMonthPeriod(normalizedYear, month);
    const total = calculateRevenueTotal(group, {
      ...filterOptionsWithoutPeriod(options),
      excludeInvalid: true,
    });

    return {
      month,
      monthKey: formatMonthKey(normalizedYear, month),
      period,
      total: total.total,
      count: total.includedCount,
      includedCount: total.includedCount,
      excludedCount: total.excludedCount,
    };
  });

  const total = calculateRevenueTotal(filtered.revenues, {
    ...filterOptionsWithoutPeriod(options),
    excludeInvalid: true,
  }).total;

  return {
    year: normalizedYear,
    months,
    total,
    includedCount: filtered.includedCount,
    excludedCount: filtered.excludedCount,
    valid: true,
    warnings: filtered.warnings,
    trace: options.trace
      ? [
          ...filtered.trace,
          createTraceEntry(
            "revenue.monthly.aggregate",
            "group",
            {
              year: normalizedYear,
              groupCount: months.length,
              includedCount: filtered.includedCount,
              excludedCount: filtered.excludedCount,
            },
            total,
          ),
        ]
      : [],
  };
}

export function calculateQuarterlyRevenueTotals(revenues = [], year, options = {}) {
  const normalizedYear = normalizeYear(year);

  if (normalizedYear === null) {
    return {
      year: null,
      quarters: [],
      total: 0,
      includedCount: 0,
      excludedCount: Array.isArray(revenues) ? revenues.length : 0,
      valid: false,
      warnings: [
        createRevenueWarning(
          "INVALID_REVENUE_YEAR",
          "year",
          { reason: "invalid_calendar_year" },
        ),
      ],
      trace: options.trace
        ? [createTraceEntry("revenue.quarterly.validate", "validate", { valid: false })]
        : [],
    };
  }

  const filtered = filterRevenuesForYear(revenues, normalizedYear, options);
  const quarterlyGroups = new Map([
    [1, []],
    [2, []],
    [3, []],
    [4, []],
  ]);

  for (const revenue of filtered.revenues) {
    const month = Number(revenue.date.slice(5, 7));
    const quarter = Math.floor((month - 1) / 3) + 1;
    quarterlyGroups.get(quarter).push(revenue);
  }

  const quarters = Array.from(quarterlyGroups, ([quarter, group]) => {
    const period = buildQuarterPeriod(normalizedYear, quarter);
    const total = calculateRevenueTotal(group, {
      ...filterOptionsWithoutPeriod(options),
      excludeInvalid: true,
    });

    return {
      quarter,
      quarterKey: `${formatYear(normalizedYear)}-Q${quarter}`,
      period,
      total: total.total,
      count: total.includedCount,
      includedCount: total.includedCount,
      excludedCount: total.excludedCount,
    };
  });

  const total = calculateRevenueTotal(filtered.revenues, {
    ...filterOptionsWithoutPeriod(options),
    excludeInvalid: true,
  }).total;

  return {
    year: normalizedYear,
    quarters,
    total,
    includedCount: filtered.includedCount,
    excludedCount: filtered.excludedCount,
    valid: true,
    warnings: filtered.warnings,
    trace: options.trace
      ? [
          ...filtered.trace,
          createTraceEntry(
            "revenue.quarterly.aggregate",
            "group",
            {
              year: normalizedYear,
              groupCount: quarters.length,
              includedCount: filtered.includedCount,
              excludedCount: filtered.excludedCount,
            },
            total,
          ),
        ]
      : [],
  };
}

export function calculateAnnualRevenueTotal(revenues = [], year, options = {}) {
  const normalizedYear = normalizeYear(year);

  if (normalizedYear === null) {
    return {
      year: null,
      total: 0,
      count: 0,
      includedCount: 0,
      excludedCount: Array.isArray(revenues) ? revenues.length : 0,
      period: { startDate: null, endDate: null },
      valid: false,
      warnings: [
        createRevenueWarning(
          "INVALID_REVENUE_YEAR",
          "year",
          { reason: "invalid_calendar_year" },
        ),
      ],
      trace: options.trace
        ? [createTraceEntry("revenue.annual.validate", "validate", { valid: false })]
        : [],
    };
  }

  const result = calculateRevenueForPeriod(
    revenues,
    buildYearPeriod(normalizedYear),
    options,
  );

  return {
    ...result,
    year: normalizedYear,
  };
}
