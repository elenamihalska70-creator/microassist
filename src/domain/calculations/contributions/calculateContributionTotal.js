import { calculateStandardContribution } from "./calculateStandardContribution.js";

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

function appendWarning(warnings, warning, fallbackSourceId = null) {
  const normalized = {
    ...warning,
    sourceId: warning.sourceId ?? fallbackSourceId,
    details: warning.details || {},
  };
  const key = JSON.stringify(normalized);

  if (!warnings.some((existing) => JSON.stringify(existing) === key)) {
    warnings.push(normalized);
  }
}

function createTraceStep(enabled, step, details = {}) {
  return enabled ? { step, ...details } : null;
}

function contributionOptions(options) {
  const calculationOptions = { ...options };
  delete calculationOptions.trace;

  return calculationOptions;
}

function excludedContribution(entry, sourceId, reason) {
  return {
    entry,
    sourceId,
    result: null,
    included: false,
    reason,
  };
}

export function calculateEntryContribution(entry, options = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    const sourceId = entry?.sourceId ?? null;

    return excludedContribution(entry, sourceId, "invalid_entry");
  }

  const sourceId = entry.sourceId ?? null;
  const result = calculateStandardContribution(
    {
      baseAmount: entry.baseAmount,
      activityType: entry.activityType,
    },
    contributionOptions(options),
  );

  return {
    entry,
    sourceId,
    result,
    included: result.calculable,
    reason: result.calculable ? null : "not_calculable",
  };
}

export function aggregateContributionEntries(entries, options = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const warnings = [];
  const contributions = [];
  let totalBaseAmount = 0;
  let totalContributionAmount = 0;
  let includedCount = 0;

  for (const entry of entries) {
    const contribution = calculateEntryContribution(entry, options);
    contributions.push(contribution);

    if (!contribution.result) {
      appendWarning(
        warnings,
        createWarning({
          code: "CONTRIBUTION_ENTRY_EXCLUDED",
          severity: "error",
          field: "entry",
          sourceId: contribution.sourceId,
          details: { reason: contribution.reason },
        }),
      );
      continue;
    }

    for (const warning of contribution.result.warnings) {
      appendWarning(warnings, warning, contribution.sourceId);
    }

    if (!contribution.included) {
      appendWarning(
        warnings,
        createWarning({
          code: "CONTRIBUTION_ENTRY_EXCLUDED",
          severity: "warning",
          field: "entry",
          sourceId: contribution.sourceId,
          details: { reason: contribution.reason },
        }),
      );
      continue;
    }

    includedCount += 1;
    totalBaseAmount += contribution.result.baseAmount;
    totalContributionAmount += contribution.result.contributionAmount;
  }

  return {
    totalBaseAmount,
    totalContributionAmount,
    count: entries.length,
    includedCount,
    excludedCount: entries.length - includedCount,
    warnings,
    contributions,
  };
}

export function calculateContributionTotal(entries, options = {}) {
  const aggregate = aggregateContributionEntries(entries, options);
  const trace = [];
  const traceStep = createTraceStep(options.trace === true, "contributions.total.aggregate", {
    count: aggregate.count,
    includedCount: aggregate.includedCount,
    excludedCount: aggregate.excludedCount,
    totalBaseAmount: aggregate.totalBaseAmount,
    totalContributionAmount: aggregate.totalContributionAmount,
  });

  if (traceStep) trace.push(traceStep);

  return {
    totalBaseAmount: aggregate.totalBaseAmount,
    totalContributionAmount: aggregate.totalContributionAmount,
    count: aggregate.count,
    includedCount: aggregate.includedCount,
    excludedCount: aggregate.excludedCount,
    warnings: aggregate.warnings,
    trace,
  };
}

export { createWarning, createTraceStep, appendWarning };
