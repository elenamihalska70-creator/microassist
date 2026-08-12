import { roundEuro } from "../money.js";
import { getContributionRule } from "../../rules/contributionRules.js";

const ROUNDING_POLICY = "nearest_euro_math_round";
const CONTRIBUTION_DOMAIN = "contributions";

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
    domain: CONTRIBUTION_DOMAIN,
    field,
    sourceId,
    details,
  };
}

function createTraceStep(enabled, step, details = {}) {
  return enabled ? { step, ...details } : null;
}

function normalizeBaseAmount(baseAmount) {
  if (baseAmount === null || baseAmount === undefined) return null;
  if (typeof baseAmount === "string" && baseAmount.trim() === "") return null;

  const normalized = Number(baseAmount);
  return Number.isFinite(normalized) ? normalized : null;
}

function resolveRule(resolveContributionRule, activityType) {
  const rule = resolveContributionRule({ activityType });

  if (rule === null || rule === undefined) return null;
  if (typeof rule !== "object" || Array.isArray(rule)) {
    throw new TypeError("resolveContributionRule must return a rule object");
  }

  return rule;
}

function getRuleRate(rule) {
  return rule?.output?.rate ?? rule?.value;
}

function isValidRate(rate) {
  return Number.isFinite(rate) && rate >= 0;
}

function ruleWarnings(rule) {
  if (!Array.isArray(rule?.warnings)) return [];

  return rule.warnings.map((_, index) =>
    createWarning({
      code: "CONTRIBUTION_RULE_WARNING",
      severity: "info",
      field: "activityType",
      sourceId: rule.ruleId || null,
      details: { index },
    }),
  );
}

export function calculateStandardContribution(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("calculateStandardContribution expects an input object");
  }

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("calculateStandardContribution options must be an object");
  }

  const {
    trace: traceEnabled = false,
    resolveContributionRule = getContributionRule,
    allowNegativeBase = false,
  } = options;

  if (typeof resolveContributionRule !== "function") {
    throw new TypeError("resolveContributionRule must be a function");
  }

  const { baseAmount: rawBaseAmount, activityType } = input;
  const warnings = [];
  const trace = [];
  const baseAmount = normalizeBaseAmount(rawBaseAmount);

  const inputTrace = createTraceStep(traceEnabled, "contributions.input.normalize", {
    baseAmount,
    activityType,
  });
  if (inputTrace) trace.push(inputTrace);

  if (baseAmount === null) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_BASE",
        severity: "error",
        field: "baseAmount",
      }),
    );
  } else if (baseAmount < 0 && !allowNegativeBase) {
    warnings.push(
      createWarning({
        code: "NEGATIVE_CONTRIBUTION_BASE",
        severity: "warning",
        field: "baseAmount",
      }),
    );
  }

  if (!activityType) {
    warnings.push(
      createWarning({
        code: "MISSING_ACTIVITY_TYPE",
        severity: "warning",
        field: "activityType",
      }),
    );
  }

  const rule = resolveRule(resolveContributionRule, activityType);

  const ruleTrace = createTraceStep(traceEnabled, "contributions.rule.resolve", {
    ruleId: rule?.ruleId || null,
    fallback: rule?.fallback || null,
  });
  if (ruleTrace) trace.push(ruleTrace);

  if (!rule) {
    warnings.push(
      createWarning({
        code: "CONTRIBUTION_RULE_NOT_FOUND",
        severity: "error",
        field: "activityType",
      }),
    );
  }

  if (rule?.fallback === "unknown_activity_rate_zero") {
    warnings.push(
      createWarning({
        code: "UNKNOWN_ACTIVITY_TYPE",
        severity: "warning",
        field: "activityType",
        sourceId: rule.ruleId,
      }),
    );
  }

  warnings.push(...ruleWarnings(rule));

  const rawRate = getRuleRate(rule);
  const rate = Number(rawRate);

  if (rule && !isValidRate(rate)) {
    warnings.push(
      createWarning({
        code: "INVALID_CONTRIBUTION_RATE",
        severity: "error",
        field: "rate",
        sourceId: rule.ruleId || null,
      }),
    );
  }

  const calculable =
    baseAmount !== null &&
    (allowNegativeBase || baseAmount >= 0) &&
    !!rule &&
    !rule.fallback &&
    isValidRate(rate);

  const rawContributionAmount = calculable ? baseAmount * rate : 0;
  const contributionAmount = calculable ? roundEuro(rawContributionAmount) : 0;

  const multiplyTrace = createTraceStep(traceEnabled, "contributions.amount.multiply", {
    baseAmount,
    rate: isValidRate(rate) ? rate : null,
    rawContributionAmount,
  });
  if (multiplyTrace) trace.push(multiplyTrace);

  const roundTrace = createTraceStep(traceEnabled, "contributions.amount.round", {
    contributionAmount,
    rounding: ROUNDING_POLICY,
  });
  if (roundTrace) trace.push(roundTrace);

  return {
    baseAmount: baseAmount ?? 0,
    activityType,
    rate: isValidRate(rate) ? rate : 0,
    contributionAmount,
    ruleId: rule?.ruleId || null,
    rounding: ROUNDING_POLICY,
    calculable,
    fallback: rule?.fallback || null,
    warnings,
    trace,
  };
}
