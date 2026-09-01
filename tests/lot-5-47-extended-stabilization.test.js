import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

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

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

test("LOT 5.47 locks the approved tenth fiscalSummaryVisibleSlice occurrence", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), 13);
  assert.equal(
    occurrences(code, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/g),
    1,
  );
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /effectiveRate:\s*weeklyRecapEffectiveRate/);
  assert.match(weekly, /legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.doesNotMatch(
    weekly,
    /computed\?\.rate \|\| getEstimatedRate\(dashboardAnswers\.activity_type\)/,
  );
});

test("LOT 5.47 keeps weekly formula, date, invoice and reminder logic intact", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /const today = parseIsoDate\(getTodayIsoDate\(\)\);/);
  assert.match(weekly, /const weekStart = new Date\(today\);/);
  assert.match(weekly, /weekStart\.setHours\(0, 0, 0, 0\);/);
  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);
  assert.match(weekly, /const weeklyInvoicesCreated = visibleInvoices\.filter\(\(invoice\) => \{/);
  assert.match(weekly, /const reminderCount = activeReminderItems\.length;/);
});
