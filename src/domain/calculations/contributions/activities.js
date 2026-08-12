import {
  aggregateContributionEntries,
  appendWarning,
  createTraceStep,
} from "./calculateContributionTotal.js";

function activityKey(activityType) {
  return activityType ?? "";
}

export function calculateContributionTotalsByActivity(entries, options = {}) {
  if (!Array.isArray(entries)) {
    throw new TypeError("entries must be an array");
  }

  const groupsByActivity = new Map();

  for (const entry of entries) {
    const key = activityKey(entry?.activityType);

    if (!groupsByActivity.has(key)) {
      groupsByActivity.set(key, {
        activityType: key,
        entries: [],
      });
    }

    groupsByActivity.get(key).entries.push(entry);
  }

  const groups = [];
  const warnings = [];

  for (const group of groupsByActivity.values()) {
    const aggregate = aggregateContributionEntries(group.entries, options);

    for (const warning of aggregate.warnings) {
      appendWarning(warnings, warning);
    }

    groups.push({
      activityType: group.activityType,
      totalBaseAmount: aggregate.totalBaseAmount,
      totalContributionAmount: aggregate.totalContributionAmount,
      count: group.entries.length,
      includedCount: aggregate.includedCount,
      excludedCount: aggregate.excludedCount,
    });
  }

  const totalBaseAmount = groups.reduce((sum, group) => sum + group.totalBaseAmount, 0);
  const totalContributionAmount = groups.reduce(
    (sum, group) => sum + group.totalContributionAmount,
    0,
  );
  const includedCount = groups.reduce((sum, group) => sum + group.includedCount, 0);
  const trace = [];
  const traceStep = createTraceStep(options.trace === true, "contributions.activity.aggregate", {
    groupCount: groups.length,
    count: entries.length,
    includedCount,
    excludedCount: entries.length - includedCount,
    totalBaseAmount,
    totalContributionAmount,
  });

  if (traceStep) trace.push(traceStep);

  return {
    groups,
    totalBaseAmount,
    totalContributionAmount,
    count: entries.length,
    includedCount,
    excludedCount: entries.length - includedCount,
    warnings,
    trace,
  };
}
