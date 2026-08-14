import { DATA_SOURCES, INVOICE_STATUSES } from "../constants.js";
import {
  isKnownValue,
  normalizeNonNegativeAmount,
  normalizeTimestamp,
  validateIdentifier,
  validateKnownValue,
} from "../validation.js";
import {
  normalizeDateValue,
  normalizeObject,
  normalizeTvaMode,
} from "./shared.js";

/**
 * @typedef {string} InvoiceId
 * @typedef {string} ClientId
 *
 * Existing sources:
 * - Supabase `invoices`: invoice_number, client_name, amount, invoice_date,
 *   due_date, status, paid_at, is_compliant.
 * - localStorage `guest_invoices`: legacy invoice shape and Factur-X draft
 *   shape from `createFacturXReadyInvoiceDraft`.
 */

function normalizeInvoiceStatus(value, paidAt = null) {
  if (isKnownValue(value, INVOICE_STATUSES)) return value;
  return paidAt ? INVOICE_STATUSES.paid : INVOICE_STATUSES.unpaid;
}

export function normalizeClient(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || source.clientId || source.client_id || null,
    name: source.name || source.client_name || "",
    email: source.email || source.client_email || "",
    address: source.address || source.client_address || "",
    siret: source.siret || source.client_siret || "",
    source: source.source || DATA_SOURCES.uiDraft,
  };
}

export function normalizeInvoiceItem(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    description: source.description || "",
    quantity: normalizeNonNegativeAmount(source.quantity, 0),
    unitPrice: normalizeNonNegativeAmount(source.unitPrice ?? source.unit_price, 0),
    vatRate: normalizeNonNegativeAmount(source.vatRate ?? source.vat_rate, 0),
    totalHT: normalizeNonNegativeAmount(source.totalHT ?? source.total_ht, 0),
    totalTVA: normalizeNonNegativeAmount(source.totalTVA ?? source.total_tva, 0),
    totalTTC: normalizeNonNegativeAmount(source.totalTTC ?? source.total_ttc, 0),
  };
}

export function normalizeInvoice(input = {}) {
  const source = normalizeObject(input);
  const paidAt = source.paidAt || source.paid_at || null;
  const buyer = normalizeClient(source.buyer || {
    name: source.client_name,
    email: source.client_email,
    address: source.client_address,
  });
  const lines = Array.isArray(source.lines)
    ? source.lines.map((line) => normalizeInvoiceItem(line))
    : [];

  return {
    ...source,
    id: source.id || null,
    userId: source.userId || source.user_id || null,
    invoiceNumber:
      source.invoiceNumber || source.invoice_number || source.number || null,
    issueDate: normalizeDateValue(source.issueDate || source.invoice_date),
    dueDate: normalizeDateValue(source.dueDate || source.due_date),
    status: normalizeInvoiceStatus(source.status, paidAt),
    paidAt: normalizeTimestamp(paidAt),
    client: buyer,
    seller: source.seller || null,
    lines,
    amount: normalizeNonNegativeAmount(source.amount, 0),
    totals: source.totals || null,
    vatMode: normalizeTvaMode(source.vatMode || source.vat_mode),
    vatExemptionReason:
      source.vatExemptionReason || source.vat_exemption_reason || null,
    isCompliant: source.isCompliant ?? source.is_compliant ?? null,
    localOnly: Boolean(source.localOnly || source.local_only || false),
    formatStatus: source.formatStatus || source.format_status || null,
    transmissionStatus:
      source.transmissionStatus || source.transmission_status || null,
    createdAt: source.createdAt || source.created_at || null,
    updatedAt: source.updatedAt || source.updated_at || null,
    source: source.source || DATA_SOURCES.localStorage,
  };
}

export function validateInvoice(invoice) {
  const normalized = normalizeInvoice(invoice);
  const errors = [];

  if (!normalized.invoiceNumber) {
    errors.push(...validateIdentifier(normalized.invoiceNumber, "invoiceNumber").errors);
  }

  if (normalized.issueDate === null) {
    errors.push("issueDate must use YYYY-MM-DD");
  }

  if (
    invoice?.status !== undefined &&
    !isKnownValue(invoice.status, INVOICE_STATUSES)
  ) {
    errors.push(...validateKnownValue(invoice.status, INVOICE_STATUSES, "status").errors);
  }

  if (!Array.isArray(normalized.lines)) {
    errors.push("lines must be an array");
  }

  return { valid: errors.length === 0, errors, value: normalized };
}

export const normalizeSupabaseInvoice = normalizeInvoice;
export const normalizeLocalInvoice = normalizeInvoice;
