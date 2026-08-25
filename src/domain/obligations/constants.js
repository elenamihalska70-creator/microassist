export const SEVERITY = Object.freeze({
  critical: "critical",
  urgent: "urgent",
  upcoming: "upcoming",
  info: "info",
});

// Obligation lifecycle. `completed` is defined for future use once the
// database can persist a declared/paid state (LOT 10.2B section 5) -- no
// builder in this module emits it yet, since doing so would fake persistence
// that does not exist.
export const OBLIGATION_STATUS = Object.freeze({
  upcoming: "upcoming",
  ready: "ready",
  dueSoon: "due_soon",
  due: "due",
  overdue: "overdue",
  completed: "completed",
});

// Who/what asserted the current status of an action. Every builder in this
// module produces systemDerived only today; userConfirmed/externallyVerified
// are reserved for when a persisted declared/paid state exists.
export const COMPLETION_STATE = Object.freeze({
  systemDerived: "system_derived",
  userConfirmed: "user_confirmed",
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
