import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

function sourceWithoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function occurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function smartAlertsBlock() {
  return extractBlock("const smartAlerts = useMemo", "  const smartPriorities = useMemo");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.64 stabilizes the reserve-low Shadow baseline contract", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), 13);
  assert.equal(
    occurrences(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g),
    1,
  );
  assert.equal(occurrences(app, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g), 1);
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.match(smartAlerts, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartAlerts, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartAlerts, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal/);
  assert.equal(occurrences(smartAlerts, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 0);
  assert.doesNotMatch(smartAlerts, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
});
