import { createAction } from "./actionObject.js";
import { ACTION_TYPE, SEVERITY, PRIORITY_TIER } from "./constants.js";

/**
 * The calm/clear state (LOT 10.2B section 11): returned only when no
 * obligation, missing information, or threshold currently requires action --
 * the canonical model must never manufacture urgency to fill this slot.
 */
export function buildNoActionRequiredAction() {
  return createAction({
    id: "no-action-required",
    type: ACTION_TYPE.noActionRequired,
    severity: SEVERITY.info,
    priorityTier: PRIORITY_TIER.informationalGuidance,
    titleKey: "obligation.no_action_required",
    source: "domain.obligations.buildNoActionRequiredAction",
    reason: "No obligation, missing information, or threshold currently requires action.",
    metadata: {},
  });
}
