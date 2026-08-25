import { DECLARATION_FREQUENCIES } from "../constants.js";
import { createAction } from "./actionObject.js";
import { ACTION_TYPE, SEVERITY, PRIORITY_TIER } from "./constants.js";

const KNOWN_DECLARATION_FREQUENCIES = new Set(Object.values(DECLARATION_FREQUENCIES));

// Precise, blocking missing-information actions (LOT 10.2B section 8) --
// replacing vague "profil à compléter" concepts with a named field, why it
// matters, and a severity below a compliance obligation but above generic
// tips (PRIORITY_TIER.missingInformation == 4).
const MISSING_FIELD_DEFINITIONS = Object.freeze([
  {
    field: "activity_type",
    isMissing: (profile) => !profile.activity_type,
    titleKey: "obligation.missing_information.activity_type",
    reason:
      "Activity type is required to compute the applicable contribution rate and VAT threshold.",
  },
  {
    field: "declaration_frequency",
    // Also catches an unrecognized value (not just a missing one) -- an
    // invalid frequency must not silently fall through to a fake calm
    // state, it blocks the deadline computation just as much as absence.
    isMissing: (profile) => !KNOWN_DECLARATION_FREQUENCIES.has(profile.declaration_frequency),
    titleKey: "obligation.missing_information.declaration_frequency",
    reason: "Declaration frequency is required to compute the next URSSAF deadline.",
  },
  {
    field: "business_start_date",
    isMissing: (profile) => profile.acre === "yes" && !profile.business_start_date,
    titleKey: "obligation.missing_information.business_start_date",
    reason:
      "Business start date is required to resolve the applicable ACRE regime when ACRE is enabled.",
  },
]);

export function buildMissingInformationActions(context = {}) {
  const profile = context.fiscalProfile ?? {};

  return MISSING_FIELD_DEFINITIONS.filter((definition) => definition.isMissing(profile)).map(
    (definition) =>
      createAction({
        id: `missing-information-${definition.field}`,
        type: ACTION_TYPE.missingInformation,
        severity: SEVERITY.urgent,
        priorityTier: PRIORITY_TIER.missingInformation,
        titleKey: definition.titleKey,
        source: "domain.obligations.buildMissingInformationActions",
        reason: definition.reason,
        metadata: { missingField: definition.field, blocking: true },
      }),
  );
}
