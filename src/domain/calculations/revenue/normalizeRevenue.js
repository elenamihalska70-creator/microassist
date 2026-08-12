import { formatLocalDate } from "../dates.js";
import { parseMoneyValue } from "../money.js";

const REVENUE_WARNING_SEVERITY = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

function createRevenueWarning(code, field, details = {}, sourceId = null) {
  return {
    code,
    severity: REVENUE_WARNING_SEVERITY.warning,
    domain: "revenue",
    field,
    sourceId,
    details,
  };
}

function normalizeRevenueCategory(source) {
  const rawCategory = source.revenueCategory ?? source.revenue_category ?? "";
  return typeof rawCategory === "string" ? rawCategory : String(rawCategory || "");
}

export function normalizeRevenue(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const id = source.id ?? null;
  const warnings = [];
  const amount = parseMoneyValue(source.amount, {
    allowDecimalComma: options.allowDecimalComma ?? true,
  });
  const date = formatLocalDate(source.date ?? source.revenue_date);

  if (amount === null) {
    warnings.push(
      createRevenueWarning(
        "INVALID_REVENUE_AMOUNT",
        "amount",
        { reason: "not_finite" },
        id,
      ),
    );
  }

  if (date === null && (source.date ?? source.revenue_date) !== undefined) {
    warnings.push(
      createRevenueWarning(
        "INVALID_REVENUE_DATE",
        "date",
        { reason: "invalid_local_date" },
        id,
      ),
    );
  }

  return {
    ...source,
    id,
    userId: source.userId ?? source.user_id ?? null,
    amount,
    date,
    revenueCategory: normalizeRevenueCategory(source),
    client: source.client ?? "",
    invoice: source.invoice ?? source.invoice_id ?? "",
    note: source.note ?? "",
    createdAt: source.createdAt ?? source.created_at ?? null,
    warnings,
  };
}
