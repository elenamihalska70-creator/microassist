import {
  CURRENCY_CODES,
  DATA_SOURCES,
  DEADLINE_RELIABILITY,
  DEADLINE_TYPES,
} from "../constants.js";
import { normalizeNonNegativeAmount } from "../validation.js";
import { normalizeDateValue, normalizeObject, pickKnown } from "./shared.js";

/**
 * Existing sources:
 * - `computeObligations` output in `src/utils/obligations.js`.
 * - App.jsx dashboard reads `deadlineDate`, `deadlineLabel`,
 *   `nextDeclarationLabel`, `estimatedAmount`, `treasuryRecommended`,
 *   `tvaStatus`, `acreStatus` and related fields.
 */

export function normalizeDeadline(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || null,
    type: pickKnown(source.type || source.deadline_type, DEADLINE_TYPES, null),
    date: normalizeDateValue(source.date || source.deadline_date),
    label: source.label || source.deadlineLabel || source.deadline_label || null,
    reliability: pickKnown(
      source.reliability,
      DEADLINE_RELIABILITY,
      source.date ? DEADLINE_RELIABILITY.estimated : DEADLINE_RELIABILITY.unknown,
    ),
    status: source.status || source.urgency || null,
    action: source.action || null,
    source: source.source || DATA_SOURCES.computed,
  };
}

export function normalizeObligation(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    nextDeclarationLabel:
      source.nextDeclarationLabel || source.next_declaration || null,
    deadlineLabel: source.deadlineLabel || source.deadline || null,
    deadlineDate: source.deadlineDate || null,
    reminders: source.reminders || null,
    source: source.source || DATA_SOURCES.computed,
  };
}

export function normalizeCalculationResult(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    estimatedAmount: normalizeNonNegativeAmount(source.estimatedAmount, 0),
    rate: source.rate ?? null,
    baseRate: source.baseRate ?? null,
    currencyCode: source.currencyCode || CURRENCY_CODES.euro,
    amountEstimatedLabel: source.amountEstimatedLabel || null,
    treasuryRecommended: normalizeNonNegativeAmount(
      source.treasuryRecommended,
      0,
    ),
    treasuryLabel: source.treasuryLabel || null,
    annualCharges: normalizeNonNegativeAmount(source.annualCharges, 0),
    annualNet: normalizeNonNegativeAmount(source.annualNet, 0),
    tvaStatus: source.tvaStatus || null,
    tvaThreshold: normalizeNonNegativeAmount(source.tvaThreshold, 0),
    acreStatus: source.acreStatus || null,
    acreActive: Boolean(source.acreActive ?? false),
    deadlineLabel: source.deadlineLabel || null,
    deadlineDate: source.deadlineDate || null,
    source: source.source || DATA_SOURCES.computed,
  };
}
