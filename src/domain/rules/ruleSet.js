export const CURRENT_RULE_SET_ID = "microassist-current-baseline";

export const CURRENT_RULE_SET_VERSION = "2026-07-29-lot3-baseline";

export const CURRENT_RULE_SET_STATUS = "technical_baseline_unverified";

export const CURRENT_RULE_SET = Object.freeze({
  ruleSetId: CURRENT_RULE_SET_ID,
  version: CURRENT_RULE_SET_VERSION,
  effectiveFrom: "2026-07-29",
  effectiveTo: null,
  status: CURRENT_RULE_SET_STATUS,
  sourceReference:
    "Extraction technique depuis src/App.jsx, src/utils/obligations.js, src/utils/facturx.js, src/config et migrations Supabase.",
  notes:
    "Baseline historique des comportements existants. Les valeurs ne sont pas presentees comme juridiquement verifiees.",
});

export function withRuleTrace(rule) {
  return {
    ...rule,
    ruleSetId: CURRENT_RULE_SET.ruleSetId,
    version: CURRENT_RULE_SET.version,
    effectiveFrom: CURRENT_RULE_SET.effectiveFrom,
    effectiveTo: CURRENT_RULE_SET.effectiveTo,
    status: CURRENT_RULE_SET.status,
  };
}

export function getApplicableRuleSet() {
  return CURRENT_RULE_SET;
}
