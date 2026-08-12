import { INVOICE_STATUSES } from "../constants.js";
import { withRuleTrace } from "./ruleSet.js";

export const INVOICE_RULE_STATUSES = Object.freeze([
  INVOICE_STATUSES.draft,
  INVOICE_STATUSES.unpaid,
  INVOICE_STATUSES.paid,
]);

export const INVOICE_VAT_RATES = Object.freeze({
  exempt: 0,
  later: 0,
  standard: 20,
});

export function getInvoiceRule(context = {}) {
  context = context || {};
  const status = context.status || context.invoice?.status || INVOICE_STATUSES.draft;
  const vatMode = context.vatMode || context.invoice?.vatMode || context.invoice?.vat_mode || "exempt";
  const isKnownStatus = INVOICE_RULE_STATUSES.includes(status);
  const vatRate = INVOICE_VAT_RATES[vatMode] ?? 0;
  const invoice = context.invoice || {};

  return withRuleTrace({
    ruleId: "INVOICE_CURRENT_STATUS_AND_VAT",
    name: "Regles facture courantes",
    description:
      "Expose les statuts facture et la logique TVA explicites dans InvoiceGenerator/facturx.",
    inputs: ["status", "vatMode", "invoice"],
    value: {
      statuses: INVOICE_RULE_STATUSES,
      vatRates: INVOICE_VAT_RATES,
      paymentStatusPaidValue: "paid",
      localOnlyFlag: true,
      facturxDraftStatus: "facturx_ready_draft",
      transmissionStatus: "not_transmitted",
    },
    output: {
      isKnownStatus,
      paymentStatus: status === INVOICE_STATUSES.paid ? "paid" : "unpaid",
      vatRate,
      isLocalOnly: invoice.localOnly === true,
      isFacturXDraft: invoice.formatStatus === "facturx_ready_draft",
      createsRevenueAutomatically: false,
    },
    sourceReference:
      "src/components/InvoiceGenerator.jsx, src/utils/facturx.js, src/App.jsx#getInvoicePaymentStatus",
    reason:
      "Preserve la separation facture/encaissement et la TVA 20% seulement en mode standard.",
    fallback: isKnownStatus ? null : "unknown_invoice_status",
    warnings: [
      "Factur-X est un brouillon non valide par schema officiel dans le code actuel.",
      "La facture payee ne cree pas automatiquement un revenu.",
    ],
    confidence: "medium",
  });
}
