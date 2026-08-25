import { ACTION_TYPE } from "../../domain/obligations/constants.js";

export const ACTION_PRIORITY_PARITY_MATCH = "MATCH";
export const ACTION_PRIORITY_PARITY_MISMATCH = "MISMATCH";

// Unlike runtimeParityEvidence.js's fields (which should always MATCH),
// "premiumOutranksCompliance" is expected to legitimately MISMATCH: legacy
// lets fiscal urgency trigger a Premium modal (App.jsx getPremiumTriggerContext,
// wired at the useEffect that calls openPremiumModal), the canonical model
// structurally cannot (LOT 10.2B section 9). A MISMATCH on that field alone
// documents the intended divergence rather than a defect.
export const ACTION_PRIORITY_PARITY_FIELDS = Object.freeze([
  "declarationStatus",
  "tvaStatus",
  "premiumOutranksCompliance",
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
    status: evidence.status,
    comparedFields: [...evidence.comparedFields],
    checks: evidence.checks.map(copyCheck),
    legacyActionSnapshot: { ...evidence.legacyActionSnapshot },
    canonicalActionSnapshot: { ...evidence.canonicalActionSnapshot },
  };
}

// Normalizes computeObligations/deadlineRules' legacy urgency vocabulary
// ("late" | "soon" | null) onto the same due_soon/overdue/upcoming_or_unknown
// vocabulary used for the canonical snapshot below, so Object.is equality is
// meaningful rather than trivially always-false.
function normalizeLegacyDeclarationStatus(urgency) {
  if (urgency === "late") return "overdue";
  if (urgency === "soon") return "due_soon";
  return "upcoming_or_unknown";
}

export function buildLegacyActionPrioritySnapshot({ computed, premiumTriggerContext } = {}) {
  return {
    declarationStatus: normalizeLegacyDeclarationStatus(computed?.urgency ?? null),
    tvaStatus: computed?.tvaStatus ?? "ok",
    premiumOutranksCompliance:
      premiumTriggerContext?.triggerType === "tva_exceeded" ||
      premiumTriggerContext?.triggerType === "declaration_urgent",
  };
}

// Collapses the canonical model's finer-grained OBLIGATION_STATUS onto
// legacy's 3-bucket urgency vocabulary (see normalizeLegacyDeclarationStatus
// above) so the comparison is meaningful rather than trivially mismatching:
// legacy has no distinct "upcoming" state, only late/soon/neither.
function normalizeCanonicalDeclarationStatus(status) {
  if (status === "overdue") return "overdue";
  if (status === "due" || status === "due_soon") return "due_soon";
  return "upcoming_or_unknown";
}

export function buildCanonicalActionPrioritySnapshot(prioritizedActions = []) {
  const topAction = prioritizedActions[0] ?? null;
  const declarationAction =
    prioritizedActions.find((action) => action.type === ACTION_TYPE.urssafDeclaration) ?? null;
  const tvaAction =
    prioritizedActions.find((action) => action.type === ACTION_TYPE.tvaThreshold) ?? null;

  return {
    declarationStatus: normalizeCanonicalDeclarationStatus(declarationAction?.status ?? null),
    tvaStatus: tvaAction ? tvaAction.metadata.vatStatus : "ok",
    premiumOutranksCompliance:
      topAction?.type === ACTION_TYPE.premiumEngagement && topAction.priorityTier <= 3,
  };
}

export function createActionPriorityParityCheck(name, legacyValue, shadowValue) {
  return {
    name,
    legacyValue,
    shadowValue,
    status: Object.is(legacyValue, shadowValue)
      ? ACTION_PRIORITY_PARITY_MATCH
      : ACTION_PRIORITY_PARITY_MISMATCH,
  };
}

export function createActionPriorityParityReport(legacyActionSnapshot, canonicalActionSnapshot) {
  assertPlainObject(
    legacyActionSnapshot,
    "createActionPriorityParityReport expects a legacy snapshot",
  );
  assertPlainObject(
    canonicalActionSnapshot,
    "createActionPriorityParityReport expects a canonical snapshot",
  );

  const checks = ACTION_PRIORITY_PARITY_FIELDS.map((field) =>
    createActionPriorityParityCheck(
      field,
      legacyActionSnapshot[field],
      canonicalActionSnapshot[field],
    ),
  );

  return {
    status: checks.every((check) => check.status === ACTION_PRIORITY_PARITY_MATCH)
      ? ACTION_PRIORITY_PARITY_MATCH
      : ACTION_PRIORITY_PARITY_MISMATCH,
    checks,
  };
}

export function createActionPriorityParityEvidence({
  scenarioId,
  legacyActionSnapshot,
  canonicalActionSnapshot,
  observedAt = null,
}) {
  assertString(scenarioId, "createActionPriorityParityEvidence expects a scenario id");
  assertPlainObject(
    legacyActionSnapshot,
    "createActionPriorityParityEvidence expects a legacy snapshot",
  );
  assertPlainObject(
    canonicalActionSnapshot,
    "createActionPriorityParityEvidence expects a canonical snapshot",
  );

  if (observedAt !== null && typeof observedAt !== "string") {
    throw new TypeError("createActionPriorityParityEvidence observedAt must be explicit text");
  }

  const report = createActionPriorityParityReport(legacyActionSnapshot, canonicalActionSnapshot);

  return {
    schemaVersion: 1,
    scenarioId,
    observedAt,
    status: report.status,
    comparedFields: [...ACTION_PRIORITY_PARITY_FIELDS],
    checks: report.checks.map(copyCheck),
    legacyActionSnapshot: { ...legacyActionSnapshot },
    canonicalActionSnapshot: { ...canonicalActionSnapshot },
  };
}

export function createActionPriorityParityEvidenceStore({
  enabled = false,
  capacity = STORE_DEFAULT_CAPACITY,
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new TypeError(
      "createActionPriorityParityEvidenceStore capacity must be a positive integer",
    );
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

      assertPlainObject(evidence, "record expects an action priority parity evidence object");
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
