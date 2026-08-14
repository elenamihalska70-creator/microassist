import { sumMoney } from "../money.js";
import { filterRevenues } from "./filterRevenues.js";

export function calculateRevenueTotal(revenues = [], options = {}) {
  const filtered = filterRevenues(revenues, {
    ...options,
    excludeInvalid: options.excludeInvalid ?? true,
  });
  const total = sumMoney(
    filtered.revenues.map((revenue) => revenue.amount),
    { allowDecimalComma: true },
  );

  return {
    total,
    includedCount: filtered.includedCount,
    excludedCount: filtered.excludedCount,
    warnings: filtered.warnings,
    trace: filtered.trace,
  };
}
