export function resolveWeeklyEstimatedRate({
  effectiveRate,
  legacyFallbackRate,
} = {}) {
  return effectiveRate || legacyFallbackRate;
}
