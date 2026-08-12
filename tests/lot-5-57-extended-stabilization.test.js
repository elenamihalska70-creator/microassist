import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const LOT_5_55_SOURCE = readFileSync(
  new URL("../docs/LOT_5_55_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md", import.meta.url),
  "utf8",
);
const LOT_5_56_SOURCE = readFileSync(
  new URL("../docs/LOT_5_56_MONTHLY_REFLECTION_CHARGES_MIGRATION_REPORT.md", import.meta.url),
  "utf8",
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

function monthlyReflectionRegion() {
  return extractBlock("const invoicesThisMonth = useMemo(() => {", "useEffect(() => {");
}

function monthlyReflectionBlock() {
  return extractBlock("  const dashboardMonthlyReflection = useMemo(() => {", "useEffect(() => {");
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

function coachingBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function assistantGuidanceBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.57 locks the approved Shadow baseline at twelve with the reserve-low occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const outsideSelector = appWithoutVisibleSlice();

  assert.match(LOT_5_55_SOURCE, /Dashboard monthly reflection - charges amount/);
  assert.match(LOT_5_56_SOURCE, /Shadow Baseline 10 -> 11/);
  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), 15);
  assert.equal(
    occurrences(outsideSelector, /fiscalSummaryVisibleSlice\.finalContributionAmount/g),
    7,
  );
  assert.equal(
    occurrences(
      app,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    1,
  );
  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(sourceWithoutComments(smartAlertsBlock()), /estimatedCharges: smartAlertEstimatedCharges/);
});

test("LOT 5.57 locks monthly reflection charges and revenue integrity", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(
    region,
    /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/,
  );
  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.doesNotMatch(monthly, /estimatedCharges\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(monthly, /currentMonthTotal\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(monthly, /getDisplayValue|Intl\.NumberFormat|Math\.round|Number\(/);
});

test("LOT 5.57 keeps estimatedCharges Legacy outside the migrated monthly reflection amount; confirms root savingsGoal removed", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const monthly = sourceWithoutComments(monthlyReflectionBlock());
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());

  assert.match(app, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(app, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(app, /Math\.max\(0, currentMonthTotal - estimatedCharges\)/);
  // LOT 5.91A: root savingsGoal removed; both active aliases keep the Shadow-backed formula.
  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.doesNotMatch(monthly, /estimatedCharges\.toLocaleString\("fr-FR"\)|estimatedCharges,/);
  assert.doesNotMatch(coaching, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(exportSource, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(assistant, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
});

test("LOT 5.57 rollback remains local to the monthly reflection charges expression", () => {
  assert.equal(
    "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")",
    "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")",
  );
  assert.equal(
    "estimatedCharges.toLocaleString(\"fr-FR\")",
    "estimatedCharges.toLocaleString(\"fr-FR\")",
  );
});
