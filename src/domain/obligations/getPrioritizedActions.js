import { buildFiscalSummaryInput } from "../../application/adapters/buildFiscalSummaryInput.js";
import { calculateFiscalSummary } from "../calculations/facade/calculateFiscalSummary.js";
import { buildMissingInformationActions } from "./buildMissingInformationActions.js";
import { buildUrssafDeclarationAction } from "./buildUrssafDeclarationAction.js";
import { buildTvaThresholdAction } from "./buildTvaThresholdAction.js";
import { buildNoActionRequiredAction } from "./buildNoActionRequiredAction.js";
import { prioritizeActions } from "./priority.js";

const EMPTY_PROFILE = Object.freeze({
  activity_type: null,
  acre: null,
  acre_start_date: null,
  business_start_date: null,
  declaration_frequency: null,
});

function normalizeFiscalProfile(fiscalProfile) {
  return { ...EMPTY_PROFILE, ...(fiscalProfile ?? {}) };
}

function tryBuildFiscalSummary(fiscalProfile, revenues, referenceDate) {
  if (!fiscalProfile.activity_type) return null;

  try {
    const input = buildFiscalSummaryInput({
      revenues: revenues ?? [],
      fiscalProfile: {
        activity_type: fiscalProfile.activity_type,
        acre: fiscalProfile.acre,
        acre_start_date: fiscalProfile.acre_start_date,
        business_start_date: fiscalProfile.business_start_date,
      },
      period: {},
      referenceDate: referenceDate ?? null,
    });
    return calculateFiscalSummary(input, { trace: false });
  } catch {
    return null;
  }
}

/**
 * Canonical entry point (LOT 10.2B section 12): assembles every action the
 * user may need to take, ranks them risk-first, and returns plain domain
 * objects -- no React, no presentation copy. UI callers should render from
 * this instead of independently deciding urgency.
 *
 * context: {
 *   fiscalProfile: { activity_type, acre, acre_start_date, business_start_date, declaration_frequency },
 *   revenues: [...],
 *   referenceDate: "YYYY-MM-DD" | Date | undefined,
 *   monthlyRevenue, yearToDateRevenue, monthsWithData: for the VAT projection,
 * }
 */
export function getPrioritizedActions(context = {}) {
  const fiscalProfile = normalizeFiscalProfile(context.fiscalProfile);
  const referenceDate = context.referenceDate ?? null;
  const fiscalSummary = tryBuildFiscalSummary(fiscalProfile, context.revenues, referenceDate);

  const builderContext = {
    fiscalProfile,
    referenceDate,
    fiscalSummary,
    monthlyRevenue: context.monthlyRevenue,
    yearToDateRevenue: context.yearToDateRevenue,
    monthsWithData: context.monthsWithData,
  };

  const missingInformationActions = buildMissingInformationActions(builderContext);
  const blockingFields = new Set(
    missingInformationActions
      .filter((action) => action.metadata.blocking)
      .map((action) => action.metadata.missingField),
  );

  const actions = [...missingInformationActions];

  if (!blockingFields.has("declaration_frequency")) {
    const declarationAction = buildUrssafDeclarationAction(builderContext);
    if (declarationAction) actions.push(declarationAction);
  }

  const tvaAction = buildTvaThresholdAction(builderContext);
  if (tvaAction) actions.push(tvaAction);

  if (actions.length === 0) {
    actions.push(buildNoActionRequiredAction());
  }

  return prioritizeActions(actions);
}
