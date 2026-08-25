// LOT 10.2D: only the URSSAF turnover declaration exists today; other
// values are reserved so a future TVA/CFE dossier does not require a
// schema redesign (see the migration's declaration_type CHECK constraint,
// which currently only allows 'urssaf_ca' -- widening it is additive).
export const DECLARATION_TYPE = Object.freeze({
  urssafCa: "urssaf_ca",
});
