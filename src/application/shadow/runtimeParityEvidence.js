export const SHADOW_PARITY_MATCH = "MATCH";
export const SHADOW_PARITY_MISMATCH = "MISMATCH";

export const SHADOW_PARITY_FIELDS = Object.freeze([
  "revenue.total",
  "summary.baseAmount",
  "summary.finalContributionAmount",
  "summary.effectiveRate",
  "acre.status",
]);

const STORE_DEFAULT_CAPACITY = 25;

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function assertString(value, message) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(message);
  }
}

function copyRevenueEntry(entry) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return { ...entry };
  }

  return entry;
}

function copyShadowInput(input) {
  if (!input) return null;

  return {
    revenues: Array.isArray(input.revenues)
      ? input.revenues.map(copyRevenueEntry)
      : [],
    fiscalProfile:
      input.fiscalProfile && typeof input.fiscalProfile === "object"
        ? {
            activityType: input.fiscalProfile.activityType,
            acre: input.fiscalProfile.acre,
            acreStartDate: input.fiscalProfile.acreStartDate,
            businessStartDate: input.fiscalProfile.businessStartDate,
          }
        : null,
    period:
      input.period && typeof input.period === "object"
        ? { ...input.period }
        : null,
    referenceDate: input.referenceDate,
  };
}

function copyLegacySnapshot(snapshot) {
  return {
    revenueTotal: snapshot.revenueTotal,
    estimatedAmount: snapshot.estimatedAmount,
    rate: snapshot.rate,
    acreStatus: snapshot.acreStatus,
  };
}

function copyShadowSnapshot(shadowResult) {
  return {
    revenueTotal: shadowResult?.revenue?.total,
    baseAmount: shadowResult?.summary?.baseAmount,
    finalContributionAmount: shadowResult?.summary?.finalContributionAmount,
    effectiveRate: shadowResult?.summary?.effectiveRate,
    acreStatus: shadowResult?.contributions?.acre?.acreStatus,
  };
}

function copyCheck(check) {
  return {
    name: check.name,
    legacyValue: check.legacyValue,
    shadowValue: check.shadowValue,
    status: check.status,
  };
}

function copyEvidence(evidence) {
  return {
    schemaVersion: evidence.schemaVersion,
    scenarioId: evidence.scenarioId,
    observedAt: evidence.observedAt,
    referenceDate: evidence.referenceDate,
    status: evidence.status,
    comparedFields: [...evidence.comparedFields],
    checks: evidence.checks.map(copyCheck),
    legacySnapshot: { ...evidence.legacySnapshot },
    shadowSnapshot: { ...evidence.shadowSnapshot },
    reproduction: {
      shadowInput: copyShadowInput(evidence.reproduction.shadowInput),
    },
  };
}

export function createShadowParityCheck(name, legacyValue, shadowValue) {
  return {
    name,
    legacyValue,
    shadowValue,
    status: Object.is(legacyValue, shadowValue)
      ? SHADOW_PARITY_MATCH
      : SHADOW_PARITY_MISMATCH,
  };
}

export function createShadowParityReport(legacySnapshot, shadowResult) {
  assertPlainObject(legacySnapshot, "createShadowParityReport expects a legacy snapshot");

  const checks = [
    createShadowParityCheck(
      "revenue.total",
      legacySnapshot.revenueTotal,
      shadowResult?.revenue?.total,
    ),
    createShadowParityCheck(
      "summary.baseAmount",
      legacySnapshot.revenueTotal,
      shadowResult?.summary?.baseAmount,
    ),
    createShadowParityCheck(
      "summary.finalContributionAmount",
      legacySnapshot.estimatedAmount,
      shadowResult?.summary?.finalContributionAmount,
    ),
    createShadowParityCheck(
      "summary.effectiveRate",
      legacySnapshot.rate,
      shadowResult?.summary?.effectiveRate,
    ),
    createShadowParityCheck(
      "acre.status",
      legacySnapshot.acreStatus,
      shadowResult?.contributions?.acre?.acreStatus,
    ),
  ];

  return {
    status: checks.every((check) => check.status === SHADOW_PARITY_MATCH)
      ? SHADOW_PARITY_MATCH
      : SHADOW_PARITY_MISMATCH,
    checks,
  };
}

export function createRuntimeParityEvidence({
  scenarioId,
  legacySnapshot,
  shadowResult,
  shadowInput,
  observedAt = null,
}) {
  assertString(scenarioId, "createRuntimeParityEvidence expects a scenario id");
  assertPlainObject(legacySnapshot, "createRuntimeParityEvidence expects a legacy snapshot");

  if (observedAt !== null && typeof observedAt !== "string") {
    throw new TypeError("createRuntimeParityEvidence observedAt must be explicit text");
  }

  const report = createShadowParityReport(legacySnapshot, shadowResult);
  const copiedShadowInput = copyShadowInput(shadowInput);

  return {
    schemaVersion: 1,
    scenarioId,
    observedAt,
    referenceDate: copiedShadowInput?.referenceDate ?? null,
    status: report.status,
    comparedFields: [...SHADOW_PARITY_FIELDS],
    checks: report.checks.map(copyCheck),
    legacySnapshot: copyLegacySnapshot(legacySnapshot),
    shadowSnapshot: copyShadowSnapshot(shadowResult),
    reproduction: {
      shadowInput: copiedShadowInput,
    },
  };
}

export function createRuntimeParityEvidenceStore({
  enabled = false,
  capacity = STORE_DEFAULT_CAPACITY,
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new TypeError("createRuntimeParityEvidenceStore capacity must be a positive integer");
  }

  let active = enabled === true;
  let entries = [];

  return {
    isEnabled() {
      return active;
    },
    configureEnabled(nextEnabled) {
      active = nextEnabled === true;
      return active;
    },
    record(evidence) {
      if (!active) {
        return {
          accepted: false,
          evidence: null,
          entries: entries.map(copyEvidence),
        };
      }

      assertPlainObject(evidence, "record expects a runtime parity evidence object");
      const copiedEvidence = copyEvidence(evidence);
      entries = [...entries, copiedEvidence].slice(-capacity);

      return {
        accepted: true,
        evidence: copyEvidence(copiedEvidence),
        entries: entries.map(copyEvidence),
      };
    },
    read() {
      return entries.map(copyEvidence);
    },
    clear() {
      entries = [];
      return entries;
    },
  };
}
