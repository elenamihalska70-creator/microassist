export const SEVERITY = Object.freeze({
  critical: "critical",
  urgent: "urgent",
  upcoming: "upcoming",
  info: "info",
});

// Obligation lifecycle. `declared` and `paid` are deliberately distinct,
// non-equivalent terminal states (LOT 10.2D section 5): a user confirming
// they declared does not imply payment, and neither transitions
// automatically -- both require an explicit user-confirmed fact
// (declaration_dossiers.declared_at / paid_at) from the declaration
// dossier system (src/domain/declarationDossier/).
export const OBLIGATION_STATUS = Object.freeze({
  upcoming: "upcoming",
  ready: "ready",
  dueSoon: "due_soon",
  due: "due",
  overdue: "overdue",
  declared: "declared",
  paid: "paid",
});

// Who/what asserted the current status of an action, and the trust level of
// a given fact. documentSupported/externallyVerified are reserved for a
// future Document Vault / official-API sync -- LOT 10.2D's own confirmation
// flow only ever produces userConfirmed; an uploaded document must never be
// labeled externallyVerified, and an estimate must never be labeled paid.
export const COMPLETION_STATE = Object.freeze({
  systemDerived: "system_derived",
  userConfirmed: "user_confirmed",
  documentSupported: "document_supported",
  externallyVerified: "externally_verified",
});

export const ACTION_TYPE = Object.freeze({
  urssafDeclaration: "urssaf_declaration",
  missingInformation: "missing_information",
  tvaThreshold: "tva_threshold",
  informationalGuidance: "informational_guidance",
  educationalTip: "educational_tip",
  genericReminder: "generic_reminder",
  premiumEngagement: "premium_engagement",
  noActionRequired: "no_action_required",
});

// Risk-first ranking ladder (LOT 10.2B section 4). Lower number == higher
// priority. An action at a lower tier number must never be outranked by an
// action at a higher tier number, regardless of either action's severity,
// due date, or type.
export const PRIORITY_TIER = Object.freeze({
  preventHarm: 1,
  mandatoryImmediate: 2,
  approachingObligation: 3,
  missingInformation: 4,
  futurePreparation: 5,
  informationalGuidance: 6,
  optimizationEducation: 7,
  engagementPremium: 8,
});

// Centralized declaration urgency thresholds -- both values already exist,
// duplicated, elsewhere in the codebase; this module reuses them instead of
// inventing new ones or duplicating them a third time.
//
// - DECLARATION_DUE_SOON_WARNING_DAYS mirrors deadlineRules.js's existing
//   `soonThresholdDays` (7), itself a trace of computeObligations' urgency
//   rule in src/utils/obligations.js.
// - DECLARATION_DUE_SOON_CRITICAL_DAYS mirrors the "declaration is imminent"
//   threshold independently duplicated in src/App.jsx by both
//   buildSmartPriorities ("Déclaration urgente", high level) and
//   getPremiumTriggerContext ("declaration_urgent", diffDays <= 2).
export const DECLARATION_DUE_SOON_WARNING_DAYS = 7;
export const DECLARATION_DUE_SOON_CRITICAL_DAYS = 2;

// Deterministic tie-break order, used only when two actions share the same
// priorityTier and the same (or absent) dueDate.
export const ACTION_TYPE_TIEBREAK_ORDER = Object.freeze([
  ACTION_TYPE.urssafDeclaration,
  ACTION_TYPE.tvaThreshold,
  ACTION_TYPE.missingInformation,
  ACTION_TYPE.genericReminder,
  ACTION_TYPE.informationalGuidance,
  ACTION_TYPE.educationalTip,
  ACTION_TYPE.premiumEngagement,
  ACTION_TYPE.noActionRequired,
]);
