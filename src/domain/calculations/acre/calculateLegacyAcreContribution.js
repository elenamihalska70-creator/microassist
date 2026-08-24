import { roundEuro } from "../money.js";
import { formatLocalDate, parseLocalDate } from "../dates.js";
import { getAcreRule } from "../../rules/acreRules.js";

const ACRE_DOMAIN = "acre";

function createWarning({
  code,
  severity = "warning",
  field = null,
  sourceId = null,
  details = {},
}) {
  return {
    code,
    severity,
    domain: ACRE_DOMAIN,
    field,
    sourceId,
    details,
  };
}

function warningKey(warning) {
  return JSON.stringify({
    code: warning?.code,
    domain: warning?.domain,
    field: warning?.field ?? null,
    sourceId: warning?.sourceId ?? null,
  });
}

function appendWarning(warnings, warning) {
  const nextKey = warningKey(warning);
  if (!warnings.some((existing) => warningKey(existing) === nextKey)) {
    warnings.push(warning);
  }
}

function createTraceStep(enabled, step, details = {}) {
  return enabled ? { step, ...details } : null;
}

function readNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function hasAcreState(context) {
  return hasOwn(context, "acre") || hasOwn(context, "acre_status");
}

function normalizeAcreState(context) {
  if (hasOwn(context, "acre")) return context.acre;
  return context.acre_status;
}

function normalizeStartDate(context, warnings) {
  const rawStartDate = hasOwn(context, "acreStartDate")
    ? context.acreStartDate
    : context.acre_start_date;

  if (rawStartDate === null || rawStartDate === undefined || rawStartDate === "") {
    return { rawStartDate, startDate: null, startDateForRule: null };
  }

  const startDate = parseLocalDate(rawStartDate);

  if (!startDate) {
    appendWarning(
      warnings,
      createWarning({
        code: "INVALID_ACRE_START_DATE",
        severity: "warning",
        field: "acreStartDate",
      }),
    );
  }

  return {
    rawStartDate,
    startDate,
    startDateForRule: startDate,
  };
}

function normalizeBusinessStartDate(context, warnings) {
  const rawBusinessStartDate = hasOwn(context, "businessStartDate")
    ? context.businessStartDate
    : context.business_start_date;

  if (
    rawBusinessStartDate === null ||
    rawBusinessStartDate === undefined ||
    rawBusinessStartDate === ""
  ) {
    return { rawBusinessStartDate, businessStartDate: null, businessStartDateForRule: null };
  }

  const businessStartDate = parseLocalDate(rawBusinessStartDate);

  if (!businessStartDate) {
    appendWarning(
      warnings,
      createWarning({
        code: "INVALID_BUSINESS_START_DATE",
        severity: "warning",
        field: "businessStartDate",
      }),
    );
  }

  return {
    rawBusinessStartDate,
    businessStartDate,
    businessStartDateForRule: businessStartDate,
  };
}

function normalizeReferenceDate(context, warnings) {
  const rawReferenceDate = context.referenceDate;
  const referenceDate = parseLocalDate(rawReferenceDate);

  if (!referenceDate) {
    appendWarning(
      warnings,
      createWarning({
        code: "INVALID_ACRE_REFERENCE_DATE",
        severity: "error",
        field: "referenceDate",
      }),
    );
  }

  return { rawReferenceDate, referenceDate };
}

function cloneContributionWarnings(standardContributionResult) {
  if (!Array.isArray(standardContributionResult.warnings)) return [];
  return standardContributionResult.warnings.map((warning) => ({ ...warning }));
}

function fallbackResult({
  standardContributionResult,
  acreContext,
  warnings,
  trace,
  referenceDate,
  startDate,
  rule = null,
  acreStatus = "inactive",
  calculable = false,
}) {
  const standardContributionAmount = readNumber(
    standardContributionResult.contributionAmount,
  );
  const standardRate = readNumber(standardContributionResult.rate);

  const finalizeTrace = createTraceStep(trace.length > 0, "acre.result.finalize", {
    acreApplied: false,
    acreContributionAmount: standardContributionAmount,
    savedAmount: 0,
  });
  if (finalizeTrace) trace.push(finalizeTrace);

  return {
    baseAmount: readNumber(standardContributionResult.baseAmount),
    activityType:
      acreContext.activityType ||
      acreContext.activity_type ||
      standardContributionResult.activityType,
    referenceDate: formatLocalDate(referenceDate),
    standardRate,
    standardContributionAmount,
    acreApplied: false,
    acreRate: standardRate,
    reductionRate: rule?.output?.reductionFactor ?? null,
    regime: rule?.output?.regime ?? null,
    acreContributionAmount: standardContributionAmount,
    savedAmount: 0,
    acrePeriod: {
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(rule?.output?.acreEndDate),
    },
    acreStatus,
    acreMonthsLeft: rule?.output?.acreMonthsLeft ?? null,
    ruleId: rule?.ruleId || null,
    rounding: standardContributionResult.rounding || null,
    calculable,
    warnings,
    trace,
  };
}

function resolveRule(resolveAcreRule, context) {
  const rule = resolveAcreRule(context);
  if (rule === null || rule === undefined) return null;
  if (typeof rule !== "object" || Array.isArray(rule)) {
    throw new TypeError("resolveAcreRule must return a rule object");
  }
  return rule;
}

function isValidRate(rate) {
  return Number.isFinite(rate) && rate >= 0;
}

function addStatusWarnings(warnings, acre, rule) {
  if (acre === undefined || acre === null || acre === "") {
    appendWarning(
      warnings,
      createWarning({
        code: "MISSING_ACRE_CONTEXT",
        severity: "warning",
        field: "acre",
      }),
    );
    return;
  }

  if (acre === "unknown") {
    appendWarning(
      warnings,
      createWarning({
        code: "UNKNOWN_ACRE_ELIGIBILITY",
        severity: "info",
        field: "acre",
        sourceId: rule?.ruleId || null,
      }),
    );
    return;
  }

  if (acre === "to_request" || acre === "requested") {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_STATUS_NOT_CONFIRMED",
        severity: "warning",
        field: "acre",
        sourceId: rule?.ruleId || null,
      }),
    );
    return;
  }

  if (acre !== "yes") {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_NOT_ACTIVE",
        severity: "info",
        field: "acre",
        sourceId: rule?.ruleId || null,
      }),
    );
  }
}

export function calculateLegacyAcreContribution(
  standardContributionResult,
  acreContext = {},
  options = {},
) {
  if (
    !standardContributionResult ||
    typeof standardContributionResult !== "object" ||
    Array.isArray(standardContributionResult)
  ) {
    throw new TypeError(
      "calculateLegacyAcreContribution expects a standard contribution result object",
    );
  }

  if (!acreContext || typeof acreContext !== "object" || Array.isArray(acreContext)) {
    throw new TypeError("calculateLegacyAcreContribution acreContext must be an object");
  }

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("calculateLegacyAcreContribution options must be an object");
  }

  const { trace: traceEnabled = false, resolveAcreRule = getAcreRule } = options;

  if (typeof resolveAcreRule !== "function") {
    throw new TypeError("resolveAcreRule must be a function");
  }

  const warnings = cloneContributionWarnings(standardContributionResult);
  const trace = [];
  const acre = normalizeAcreState(acreContext);
  const activityType =
    acreContext.activityType ||
    acreContext.activity_type ||
    standardContributionResult.activityType;
  const standardContributionAmount = readNumber(
    standardContributionResult.contributionAmount,
  );
  const standardRate = readNumber(standardContributionResult.rate);
  const baseAmount = readNumber(standardContributionResult.baseAmount);

  const { referenceDate } = normalizeReferenceDate(acreContext, warnings);
  const { startDate, startDateForRule } = normalizeStartDate(acreContext, warnings);
  const { businessStartDate, businessStartDateForRule } = normalizeBusinessStartDate(
    acreContext,
    warnings,
  );

  const inputTrace = createTraceStep(traceEnabled, "acre.input.normalize", {
    acre,
    activityType,
    referenceDate: formatLocalDate(referenceDate),
    acreStartDate: formatLocalDate(startDate),
    businessStartDate: formatLocalDate(businessStartDate),
  });
  if (inputTrace) trace.push(inputTrace);

  const standardTrace = createTraceStep(traceEnabled, "acre.standard.read", {
    baseAmount,
    standardRate,
    standardContributionAmount,
    standardCalculable: standardContributionResult.calculable,
  });
  if (standardTrace) trace.push(standardTrace);

  if (!hasAcreState(acreContext)) {
    addStatusWarnings(warnings, acre, null);
  }

  if (!referenceDate) {
    return fallbackResult({
      standardContributionResult,
      acreContext,
      warnings,
      trace,
      referenceDate,
      startDate,
    });
  }

  const rule = resolveRule(resolveAcreRule, {
    acre,
    acreStartDate: startDateForRule,
    businessStartDate: businessStartDateForRule,
    activityType,
    today: referenceDate,
  });

  const ruleTrace = createTraceStep(traceEnabled, "acre.rule.resolve", {
    ruleId: rule?.ruleId || null,
    fallback: rule?.fallback || null,
  });
  if (ruleTrace) trace.push(ruleTrace);

  if (!rule) {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_RULE_NOT_FOUND",
        severity: "error",
        field: "acre",
      }),
    );
    return fallbackResult({
      standardContributionResult,
      acreContext,
      warnings,
      trace,
      referenceDate,
      startDate,
    });
  }

  const effectiveRate = Number(rule.output?.effectiveRate);

  if (!isValidRate(effectiveRate)) {
    appendWarning(
      warnings,
      createWarning({
        code: "INVALID_ACRE_RATE",
        severity: "error",
        field: "acreRate",
        sourceId: rule.ruleId || null,
      }),
    );
    return fallbackResult({
      standardContributionResult,
      acreContext,
      warnings,
      trace,
      referenceDate,
      startDate,
      rule,
      acreStatus: rule.output?.acreStatus || "inactive",
    });
  }

  addStatusWarnings(warnings, acre, rule);

  if (standardContributionResult.calculable === false) {
    appendWarning(
      warnings,
      createWarning({
        code: "STANDARD_CONTRIBUTION_NOT_CALCULABLE",
        severity: "error",
        field: "standardContributionResult",
        sourceId: standardContributionResult.ruleId || null,
      }),
    );
  }

  const acreApplied =
    standardContributionResult.calculable !== false && rule.output?.acreActive === true;

  if (!acreApplied && rule.output?.acreStatus === "expired") {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_PERIOD_EXPIRED",
        severity: "info",
        field: "acreStartDate",
        sourceId: rule.ruleId || null,
      }),
    );
  } else if (!acreApplied && rule.output?.acreStatus === "regime_unknown") {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_REGIME_UNKNOWN_BUSINESS_START_DATE_REQUIRED",
        severity: "warning",
        field: "businessStartDate",
        sourceId: rule.ruleId || null,
      }),
    );
  } else if (!acreApplied && acre === "yes") {
    appendWarning(
      warnings,
      createWarning({
        code: "ACRE_NOT_ACTIVE",
        severity: "info",
        field: "acre",
        sourceId: rule.ruleId || null,
      }),
    );
  }

  const periodTrace = createTraceStep(traceEnabled, "acre.period.evaluate", {
    acreStatus: rule.output?.acreStatus || "inactive",
    acreMonthsLeft: rule.output?.acreMonthsLeft ?? null,
    acreEndDate: formatLocalDate(rule.output?.acreEndDate),
  });
  if (periodTrace) trace.push(periodTrace);

  if (!acreApplied) {
    return fallbackResult({
      standardContributionResult,
      acreContext,
      warnings,
      trace,
      referenceDate,
      startDate,
      rule,
      acreStatus: rule.output?.acreStatus || "inactive",
      calculable: standardContributionResult.calculable !== false,
    });
  }

  const rawAcreContributionAmount = baseAmount * effectiveRate;
  const amountTrace = createTraceStep(traceEnabled, "acre.amount.calculate", {
    baseAmount,
    effectiveRate,
    rawAcreContributionAmount,
  });
  if (amountTrace) trace.push(amountTrace);

  const acreContributionAmount = roundEuro(rawAcreContributionAmount);
  const savedAmount = standardContributionAmount - acreContributionAmount;

  const roundTrace = createTraceStep(traceEnabled, "acre.amount.round", {
    acreContributionAmount,
    savedAmount,
    rounding: standardContributionResult.rounding || null,
  });
  if (roundTrace) trace.push(roundTrace);

  const finalizeTrace = createTraceStep(traceEnabled, "acre.result.finalize", {
    acreApplied,
    acreContributionAmount,
    savedAmount,
  });
  if (finalizeTrace) trace.push(finalizeTrace);

  return {
    baseAmount,
    activityType,
    referenceDate: formatLocalDate(referenceDate),
    standardRate,
    standardContributionAmount,
    acreApplied,
    acreRate: effectiveRate,
    reductionRate: rule.output?.reductionFactor ?? null,
    regime: rule.output?.regime ?? null,
    acreContributionAmount,
    savedAmount,
    acrePeriod: {
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(rule.output?.acreEndDate),
    },
    acreStatus: rule.output?.acreStatus || "inactive",
    acreMonthsLeft: rule.output?.acreMonthsLeft ?? null,
    ruleId: rule.ruleId || null,
    rounding: standardContributionResult.rounding || null,
    calculable: true,
    warnings,
    trace,
  };
}
