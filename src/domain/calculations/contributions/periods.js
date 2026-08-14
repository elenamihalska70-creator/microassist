import {
  compareLocalDates,
  daysInMonth,
  isValidLocalDateString,
} from "../dates.js";
import {
  aggregateContributionEntries,
  appendWarning,
  createTraceStep,
  createWarning,
} from "./calculateContributionTotal.js";

function isValidYear(year) {
  const numericYear = Number(year);

  return Number.isInteger(numericYear) && numericYear >= 1 && numericYear <= 9999;
}

function normalizeYear(year) {
  return isValidYear(year) ? Number(year) : null;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function createPeriod(startDate, endDate) {
  return { startDate, endDate };
}

function monthPeriod(year, month) {
  return createPeriod(
    `${year}-${pad(month)}-01`,
    `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  );
}

function validatePeriod(period) {
  const warnings = [];

  if (!period || typeof period !== "object" || Array.isArray(period)) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_PERIOD",
        severity: "error",
        field: "period",
      }),
    );

    return { valid: false, warnings };
  }

  const { startDate, endDate } = period;
  const hasValidStart = isValidLocalDateString(startDate);
  const hasValidEnd = isValidLocalDateString(endDate);

  if (!hasValidStart) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_PERIOD_START_DATE",
        severity: "error",
        field: "startDate",
      }),
    );
  }

  if (!hasValidEnd) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_PERIOD_END_DATE",
        severity: "error",
        field: "endDate",
      }),
    );
  }

  if (hasValidStart && hasValidEnd && compareLocalDates(startDate, endDate) > 0) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_PERIOD_ORDER",
        severity: "error",
        field: "period",
      }),
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

function entryDate(entry) {
  return entry?.date ?? entry?.revenueDate ?? null;
}

function filterEntriesForPeriod(entries, period) {
  const included = [];
  const warnings = [];

  for (const entry of entries) {
    const sourceId = entry?.sourceId ?? null;
    const date = entryDate(entry);

    if (!isValidLocalDateString(date)) {
      appendWarning(
        warnings,
        createWarning({
          code: "INVALID_CONTRIBUTION_DATE",
          severity: "warning",
          field: "date",
          sourceId,
        }),
      );
      appendWarning(
        warnings,
        createWarning({
          code: "CONTRIBUTION_ENTRY_EXCLUDED",
          severity: "warning",
          field: "entry",
          sourceId,
          details: { reason: "invalid_date" },
        }),
      );
      continue;
    }

    if (
      compareLocalDates(date, period.startDate) >= 0 &&
      compareLocalDates(date, period.endDate) <= 0
    ) {
      included.push(entry);
    }
  }

  return { entries: included, warnings };
}

function emptyPeriodResult(entries, period, warnings, trace) {
  return {
    period,
    totalBaseAmount: 0,
    totalContributionAmount: 0,
    count: entries.length,
    includedCount: 0,
    excludedCount: entries.length,
    valid: false,
    warnings,
    trace,
  };
}

export function calculateContributionsForPeriod(entries, period, options = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const normalizedPeriod = period
    ? createPeriod(period.startDate, period.endDate)
    : createPeriod(null, null);
  const validation = validatePeriod(period);
  const trace = [];

  if (!validation.valid) {
    const traceStep = createTraceStep(options.trace === true, "contributions.period.validate", {
      period: normalizedPeriod,
      valid: false,
      count: entries.length,
    });
    if (traceStep) trace.push(traceStep);

    return emptyPeriodResult(entries, normalizedPeriod, validation.warnings, trace);
  }

  const filtered = filterEntriesForPeriod(entries, normalizedPeriod);
  const aggregate = aggregateContributionEntries(filtered.entries, options);
  const warnings = [...filtered.warnings];

  for (const warning of aggregate.warnings) {
    appendWarning(warnings, warning);
  }

  const traceStep = createTraceStep(options.trace === true, "contributions.period.aggregate", {
    period: normalizedPeriod,
    count: entries.length,
    includedCount: aggregate.includedCount,
    excludedCount: entries.length - aggregate.includedCount,
    totalBaseAmount: aggregate.totalBaseAmount,
    totalContributionAmount: aggregate.totalContributionAmount,
  });
  if (traceStep) trace.push(traceStep);

  return {
    period: normalizedPeriod,
    totalBaseAmount: aggregate.totalBaseAmount,
    totalContributionAmount: aggregate.totalContributionAmount,
    count: entries.length,
    includedCount: aggregate.includedCount,
    excludedCount: entries.length - aggregate.includedCount,
    valid: true,
    warnings,
    trace,
  };
}

export function calculateMonthlyContributionTotals(entries, year, options = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const normalizedYear = normalizeYear(year);
  const trace = [];

  if (normalizedYear === null) {
    const warnings = [
      createWarning({
        code: "INVALID_CONTRIBUTION_YEAR",
        severity: "error",
        field: "year",
      }),
    ];

    return {
      year: null,
      months: [],
      totalBaseAmount: 0,
      totalContributionAmount: 0,
      includedCount: 0,
      excludedCount: entries.length,
      valid: false,
      warnings,
      trace,
    };
  }

  const months = [];
  const warnings = [];

  for (let month = 1; month <= 12; month += 1) {
    const period = monthPeriod(normalizedYear, month);
    const result = calculateContributionsForPeriod(entries, period, options);

    for (const warning of result.warnings) {
      appendWarning(warnings, warning);
    }

    months.push({
      month,
      monthKey: `${normalizedYear}-${pad(month)}`,
      period,
      baseAmount: result.totalBaseAmount,
      contributionAmount: result.totalContributionAmount,
      count: result.includedCount,
      includedCount: result.includedCount,
      excludedCount: result.excludedCount,
    });
  }

  const totalBaseAmount = months.reduce((sum, month) => sum + month.baseAmount, 0);
  const totalContributionAmount = months.reduce(
    (sum, month) => sum + month.contributionAmount,
    0,
  );
  const includedCount = months.reduce((sum, month) => sum + month.includedCount, 0);

  const traceStep = createTraceStep(options.trace === true, "contributions.monthly.aggregate", {
    year: normalizedYear,
    includedCount,
    excludedCount: entries.length - includedCount,
    totalBaseAmount,
    totalContributionAmount,
  });
  if (traceStep) trace.push(traceStep);

  return {
    year: normalizedYear,
    months,
    totalBaseAmount,
    totalContributionAmount,
    includedCount,
    excludedCount: entries.length - includedCount,
    valid: true,
    warnings,
    trace,
  };
}

export function calculateQuarterlyContributionTotals(entries, year, options = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const normalizedYear = normalizeYear(year);
  const trace = [];

  if (normalizedYear === null) {
    return {
      year: null,
      quarters: [],
      totalBaseAmount: 0,
      totalContributionAmount: 0,
      includedCount: 0,
      excludedCount: entries.length,
      valid: false,
      warnings: [
        createWarning({
          code: "INVALID_CONTRIBUTION_YEAR",
          severity: "error",
          field: "year",
        }),
      ],
      trace,
    };
  }

  const quarterPeriods = [
    createPeriod(`${normalizedYear}-01-01`, `${normalizedYear}-03-31`),
    createPeriod(`${normalizedYear}-04-01`, `${normalizedYear}-06-30`),
    createPeriod(`${normalizedYear}-07-01`, `${normalizedYear}-09-30`),
    createPeriod(`${normalizedYear}-10-01`, `${normalizedYear}-12-31`),
  ];
  const quarters = [];
  const warnings = [];

  for (let index = 0; index < quarterPeriods.length; index += 1) {
    const quarter = index + 1;
    const result = calculateContributionsForPeriod(entries, quarterPeriods[index], options);

    for (const warning of result.warnings) {
      appendWarning(warnings, warning);
    }

    quarters.push({
      quarter,
      quarterKey: `${normalizedYear}-Q${quarter}`,
      period: quarterPeriods[index],
      baseAmount: result.totalBaseAmount,
      contributionAmount: result.totalContributionAmount,
      count: result.includedCount,
      includedCount: result.includedCount,
      excludedCount: result.excludedCount,
    });
  }

  const totalBaseAmount = quarters.reduce((sum, quarter) => sum + quarter.baseAmount, 0);
  const totalContributionAmount = quarters.reduce(
    (sum, quarter) => sum + quarter.contributionAmount,
    0,
  );
  const includedCount = quarters.reduce((sum, quarter) => sum + quarter.includedCount, 0);

  const traceStep = createTraceStep(options.trace === true, "contributions.quarterly.aggregate", {
    year: normalizedYear,
    includedCount,
    excludedCount: entries.length - includedCount,
    totalBaseAmount,
    totalContributionAmount,
  });
  if (traceStep) trace.push(traceStep);

  return {
    year: normalizedYear,
    quarters,
    totalBaseAmount,
    totalContributionAmount,
    includedCount,
    excludedCount: entries.length - includedCount,
    valid: true,
    warnings,
    trace,
  };
}

export function calculateAnnualContributionTotal(entries, year, options = {}) {
  const normalizedYear = normalizeYear(year);

  if (normalizedYear === null) {
    if (!Array.isArray(entries)) {
      throw new TypeError("entries must be an array");
    }

    return {
      year: null,
      period: createPeriod(null, null),
      totalBaseAmount: 0,
      totalContributionAmount: 0,
      count: entries.length,
      includedCount: 0,
      excludedCount: entries.length,
      valid: false,
      warnings: [
        createWarning({
          code: "INVALID_CONTRIBUTION_YEAR",
          severity: "error",
          field: "year",
        }),
      ],
      trace: [],
    };
  }

  const period = createPeriod(`${normalizedYear}-01-01`, `${normalizedYear}-12-31`);
  const result = calculateContributionsForPeriod(entries, period, options);

  return {
    year: normalizedYear,
    period,
    totalBaseAmount: result.totalBaseAmount,
    totalContributionAmount: result.totalContributionAmount,
    count: result.count,
    includedCount: result.includedCount,
    excludedCount: result.excludedCount,
    valid: result.valid,
    warnings: result.warnings,
    trace: result.trace,
  };
}
