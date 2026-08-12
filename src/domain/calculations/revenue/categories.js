import { calculateRevenueTotal } from "./calculateRevenueTotal.js";
import { filterRevenues } from "./filterRevenues.js";

const KNOWN_HISTORICAL_REVENUE_CATEGORIES = Object.freeze([
  "service",
  "services",
  "vente",
  "commerce",
  "mixed",
  "mixte",
  "other",
]);

function createRevenueWarning(code, field, details = {}, sourceId = null) {
  return {
    code,
    severity: "warning",
    domain: "revenue",
    field,
    sourceId,
    details,
  };
}

function createTraceEntry(step, operation, metadata, valueAfter = null) {
  return {
    step,
    domain: "revenue",
    inputRef: null,
    operation,
    valueBefore: null,
    valueAfter,
    ruleId: null,
    metadata,
  };
}

function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function getMappedCategory(category, mapping) {
  if (!mapping || typeof mapping !== "object") return category;
  if (!hasOwnValue(mapping, category)) return category;

  const mapped = mapping[category];
  return typeof mapped === "string" ? mapped : String(mapped ?? "");
}

function getCategoryKey(category) {
  return category === "" ? "__missing__" : category;
}

function isKnownHistoricalCategory(category) {
  return KNOWN_HISTORICAL_REVENUE_CATEGORIES.includes(category);
}

export function calculateRevenueTotalsByCategory(revenues = [], options = {}) {
  const {
    categoryMapping = null,
    trace = false,
  } = options;
  const filtered = filterRevenues(revenues, {
    ...options,
    excludeInvalid: options.excludeInvalid ?? true,
  });
  const groupsByKey = new Map();
  const warnings = [...filtered.warnings];
  const emittedCategoryWarnings = new Set();

  for (const revenue of filtered.revenues) {
    const originalCategory = revenue.revenueCategory;
    const mappedCategory = getMappedCategory(originalCategory, categoryMapping);
    const categoryKey = getCategoryKey(mappedCategory);

    if (!groupsByKey.has(categoryKey)) {
      groupsByKey.set(categoryKey, {
        categoryKey,
        category: mappedCategory === "" ? null : mappedCategory,
        originalCategories: [],
        revenues: [],
      });
    }

    const group = groupsByKey.get(categoryKey);
    if (!group.originalCategories.includes(originalCategory)) {
      group.originalCategories.push(originalCategory);
    }
    group.revenues.push(revenue);

    if (originalCategory === "" && !emittedCategoryWarnings.has("missing")) {
      warnings.push(
        createRevenueWarning(
          "MISSING_REVENUE_CATEGORY",
          "revenueCategory",
          {
            categoryKey,
            count: 1,
          },
        ),
      );
      emittedCategoryWarnings.add("missing");
    }

    if (
      originalCategory !== "" &&
      !isKnownHistoricalCategory(originalCategory) &&
      !emittedCategoryWarnings.has(`unknown:${originalCategory}`)
    ) {
      warnings.push(
        createRevenueWarning(
          "UNKNOWN_REVENUE_CATEGORY",
          "revenueCategory",
          {
            categoryKey: originalCategory,
          },
        ),
      );
      emittedCategoryWarnings.add(`unknown:${originalCategory}`);
    }
  }

  const groups = Array.from(groupsByKey.values()).map((group) => {
    const total = calculateRevenueTotal(group.revenues, {
      ...options,
      excludeInvalid: true,
    });

    return {
      categoryKey: group.categoryKey,
      category: group.category,
      originalCategories: group.originalCategories,
      total: total.total,
      count: total.includedCount,
      includedCount: total.includedCount,
      excludedCount: total.excludedCount,
    };
  });
  const total = calculateRevenueTotal(filtered.revenues, {
    ...options,
    excludeInvalid: true,
  }).total;

  return {
    groups,
    total,
    includedCount: filtered.includedCount,
    excludedCount: filtered.excludedCount,
    warnings,
    trace: trace
      ? [
          ...filtered.trace,
          createTraceEntry(
            "revenue.category.aggregate",
            "group",
            {
              groupCount: groups.length,
              includedCount: filtered.includedCount,
              excludedCount: filtered.excludedCount,
            },
            total,
          ),
        ]
      : [],
  };
}
