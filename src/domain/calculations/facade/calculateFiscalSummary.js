import {
  calculateAnnualRevenueTotal,
  calculateRevenueForPeriod,
  calculateRevenueTotal,
  calculateRevenueTotalsByCategory,
} from "../revenue/index.js";
import { calculateStandardContribution } from "../contributions/index.js";
import { calculateLegacyAcreContribution } from "../acre/index.js";

const INPUT_FIELDS = Object.freeze([
  "revenues",
  "fiscalProfile",
  "period",
  "referenceDate",
]);
const OPTION_FIELDS = Object.freeze([
  "trace",
  "calculateRevenueTotal",
  "calculateRevenueForPeriod",
  "calculateAnnualRevenueTotal",
  "calculateRevenueTotalsByCategory",
  "calculateStandardContribution",
  "calculateLegacyAcreContribution",
]);
const PROFILE_ACTIVITY_FIELD = "activityType";

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function assertKnownFields(value, allowedFields, message) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      throw new TypeError(message);
    }
  }
}

function assertRequiredFields(value, requiredFields, message) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      throw new TypeError(message);
    }
  }
}

function warningKey(warning) {
  return JSON.stringify({
    domain: warning?.domain,
    code: warning?.code,
    field: warning?.field ?? null,
    sourceId: warning?.sourceId ?? null,
  });
}

function collectWarnings(...results) {
  const warnings = [];

  for (const result of results) {
    if (!Array.isArray(result?.warnings)) continue;

    for (const warning of result.warnings) {
      const key = warningKey(warning);
      if (!warnings.some((existing) => warningKey(existing) === key)) {
        warnings.push({ ...warning });
      }
    }
  }

  return warnings;
}

function collectTrace(...results) {
  const trace = [];

  for (const result of results) {
    if (!Array.isArray(result?.trace)) continue;
    trace.push(...result.trace.map((entry) => ({ ...entry })));
  }

  return trace;
}

function hasPeriodBounds(period) {
  return Boolean(period?.startDate || period?.endDate);
}

function hasAnnualPeriod(period) {
  return period?.year !== undefined;
}

function resolveRevenueResult(revenues, period, trace, calculators) {
  if (hasPeriodBounds(period)) {
    return calculators.calculateRevenueForPeriod(revenues, period, { trace });
  }

  if (hasAnnualPeriod(period)) {
    return calculators.calculateAnnualRevenueTotal(revenues, period.year, { trace });
  }

  return calculators.calculateRevenueTotal(revenues, { trace });
}

function resolveBreakdowns(revenues, trace, calculators) {
  const categories = calculators.calculateRevenueTotalsByCategory(revenues, { trace });

  return {
    categories,
  };
}

function buildFinalContribution(acreContribution) {
  return {
    contributionAmount: acreContribution.acreContributionAmount,
    rate: acreContribution.acreRate,
    calculable: acreContribution.calculable,
    rounding: acreContribution.rounding,
    source: "legacy_acre",
  };
}

export function calculateFiscalSummary(input, options = {}) {
  assertObject(input, "calculateFiscalSummary expects an input object");
  assertObject(options, "calculateFiscalSummary options must be an object");
  assertKnownFields(input, INPUT_FIELDS, "calculateFiscalSummary input contains unknown fields");
  assertRequiredFields(input, INPUT_FIELDS, "calculateFiscalSummary input is missing required fields");
  assertKnownFields(
    options,
    OPTION_FIELDS,
    "calculateFiscalSummary options contain unknown fields",
  );

  const {
    trace = false,
    calculateRevenueTotal: calculateRevenueTotalFn = calculateRevenueTotal,
    calculateRevenueForPeriod:
      calculateRevenueForPeriodFn = calculateRevenueForPeriod,
    calculateAnnualRevenueTotal:
      calculateAnnualRevenueTotalFn = calculateAnnualRevenueTotal,
    calculateRevenueTotalsByCategory:
      calculateRevenueTotalsByCategoryFn = calculateRevenueTotalsByCategory,
    calculateStandardContribution:
      calculateStandardContributionFn = calculateStandardContribution,
    calculateLegacyAcreContribution:
      calculateLegacyAcreContributionFn = calculateLegacyAcreContribution,
  } = options;

  const calculators = {
    calculateRevenueTotal: calculateRevenueTotalFn,
    calculateRevenueForPeriod: calculateRevenueForPeriodFn,
    calculateAnnualRevenueTotal: calculateAnnualRevenueTotalFn,
    calculateRevenueTotalsByCategory: calculateRevenueTotalsByCategoryFn,
    calculateStandardContribution: calculateStandardContributionFn,
    calculateLegacyAcreContribution: calculateLegacyAcreContributionFn,
  };

  for (const [name, calculator] of Object.entries(calculators)) {
    if (typeof calculator !== "function") {
      throw new TypeError(`${name} must be a function`);
    }
  }

  const revenues = input.revenues;
  const fiscalProfile = input.fiscalProfile;
  const period = input.period;
  const revenueResult = resolveRevenueResult(revenues, period, trace, calculators);
  const breakdowns = resolveBreakdowns(revenues, trace, calculators);
  const standardContribution = calculators.calculateStandardContribution(
    {
      baseAmount: revenueResult.total,
      [PROFILE_ACTIVITY_FIELD]: fiscalProfile[PROFILE_ACTIVITY_FIELD],
    },
    { trace },
  );
  const acreContribution = calculators.calculateLegacyAcreContribution(
    standardContribution,
    {
      acre: fiscalProfile.acre,
      acreStartDate: fiscalProfile.acreStartDate,
      businessStartDate: fiscalProfile.businessStartDate,
      [PROFILE_ACTIVITY_FIELD]: fiscalProfile[PROFILE_ACTIVITY_FIELD],
      referenceDate: input.referenceDate,
    },
    { trace },
  );
  const finalContribution = buildFinalContribution(
    acreContribution,
  );

  return {
    revenue: {
      total: revenueResult.total,
      period: revenueResult.period ?? null,
      breakdowns,
    },
    contributions: {
      standard: standardContribution,
      final: finalContribution,
      acre: acreContribution,
    },
    summary: {
      baseAmount: acreContribution.baseAmount,
      standardContributionAmount:
        acreContribution.standardContributionAmount,
      finalContributionAmount: acreContribution.acreContributionAmount,
      savedAmount: acreContribution.savedAmount,
      effectiveRate: acreContribution.acreRate,
      calculable: acreContribution.calculable,
    },
    warnings: collectWarnings(
      revenueResult,
      breakdowns.categories,
      standardContribution,
      acreContribution,
    ),
    trace: trace
      ? collectTrace(
          revenueResult,
          breakdowns.categories,
          standardContribution,
          acreContribution,
        )
      : [],
  };
}
