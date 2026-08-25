import { COMPLETION_STATE } from "./constants.js";

const REQUIRED_FIELDS = Object.freeze([
  "id",
  "type",
  "severity",
  "priorityTier",
  "titleKey",
  "source",
  "reason",
]);

function assertPresent(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`createAction is missing required field "${field}"`);
  }
}

/**
 * Canonical shape for every obligation/action produced by this module.
 * Domain-only: no JSX, CSS classes, modal state, or presentation copy.
 */
export function createAction(input = {}) {
  for (const field of REQUIRED_FIELDS) {
    assertPresent(input[field], field);
  }

  if (
    !Number.isInteger(input.priorityTier) ||
    input.priorityTier < 1 ||
    input.priorityTier > 8
  ) {
    throw new TypeError(
      "createAction priorityTier must be an integer between 1 and 8",
    );
  }

  return {
    id: input.id,
    type: input.type,
    status: input.status ?? null,
    severity: input.severity,
    priorityTier: input.priorityTier,
    titleKey: input.titleKey,
    period: input.period ?? null,
    dueDate: input.dueDate ?? null,
    amount: input.amount ?? null,
    amountKind: input.amountKind ?? null,
    confidence: input.confidence ?? null,
    source: input.source,
    completionState: input.completionState ?? COMPLETION_STATE.systemDerived,
    officialAction: input.officialAction ?? null,
    reason: input.reason,
    metadata: input.metadata ?? {},
  };
}
