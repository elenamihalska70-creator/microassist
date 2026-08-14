import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_50_SOURCE = readFileSync(
  new URL("../docs/LOT_5_50_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md", import.meta.url),
  "utf8",
);
const LOT_5_49_SOURCE = readFileSync(
  new URL("./lot-5-49-weekly-rate-stabilization.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  monthlyReflectionRevenueTotalAlias: 1,
  monthlyReflectionChargesAmountAlias: 1,
  monthlyReflectionRevenueTotalConsumers: 3,
  monthlyReflectionChargesAmountConsumers: 3,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.51A identifies the exact monthly reflection block and approved candidate", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(LOT_5_50_SOURCE, /Dashboard monthly reflection - revenue amount/);
  assert.match(monthly, /const dashboardMonthlyReflection = useMemo\(\(\) => \{/);
  assert.match(monthly, /if \(revenues\.length === 0\) return null;/);
  assert.match(monthly, /title: "📅 Bilan du mois"/);
});

test("LOT 5.51A creates a local alias that reads exactly the visible slice revenue total", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.match(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.equal(
    occurrences(app, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalAlias,
  );
  assert.doesNotMatch(region, /monthlyReflectionRevenueTotal = .*currentMonthTotal/);
  assert.doesNotMatch(region, /useMemo\(\(\) => monthlyReflectionRevenueTotal|useMemo\(\(\) => fiscalSummaryVisibleSlice/);
});

test("LOT 5.51A migrates only the revenue amount source and preserves formatting", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.doesNotMatch(
    monthly,
    /Tu as enregistré \$\{currentMonthTotal\.toLocaleString\("fr-FR"\)\}/,
  );
  assert.doesNotMatch(monthly, /getDisplayValue|Intl\.NumberFormat|Math\.round|Number\(/);
  assert.match(monthly, /monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(monthly, /estimatedCharges\.toLocaleString\("fr-FR"\)/);
});

test("LOT 5.51A preserves monthly reflection text, neighbors and dependency boundary", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(monthly, /const invoiceLabel = `\$\{invoicesThisMonth\} facture/);
  assert.match(monthly, /const reminderLabel = `\$\{activeReminderItems\.length\} rappel/);
  assert.match(monthly, /computed\?\.tvaStatus === "soon" \|\| computed\?\.tvaStatus === "exceeded"/);
  assert.match(monthly, /TVA : \$\{normalizedTvaStatusLabel \|\| "à surveiller"\}\./);
  assert.match(monthly, /"Tu vois plus clairement ton mois en cours\."/);
  assert.match(monthly, /monthlyReflectionRevenueTotal,/);
  assert.doesNotMatch(monthly, /currentMonthTotal: smartAlertRevenueTotal/);
});

test("LOT 5.51A keeps all other currentMonthTotal responsibilities Legacy", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(app, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(app, /hasRealRevenue\s*\?\s*currentMonthTotal/);
  assert.match(app, /currentMonthTotal - estimatedCharges/);
  assert.match(app, /buildSmartAlerts\(\{[\s\S]*currentMonthTotal: smartAlertRevenueTotal,/);
  assert.match(app, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(app, /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(app, /currentMonthTotal: smartAlertRevenueTotal/);
});

test("LOT 5.51A keeps feedback, exports, assistant-adjacent and persistence boundaries unchanged", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.doesNotMatch(
    monthly,
    /localStorage|sessionStorage|supabase|fetch|payload|feedback|analytics|trackEvent|handleExportPDF|export_csv|export_pdf|assistant|coaching|invoiceSectionSummary|handleMarkInvoicePaid/i,
  );
  assert.match(app, /feedbackContextSnapshot = useMemo\(\(\) => \{/);
  assert.match(app, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(app, /const handleExportPDF = useCallback\(async \(\) => \{/);
  assert.match(app, /Revenus cumulés : \$\{getDisplayValue\(currentMonthTotal, "money"\)\}/);
  assert.match(app, /buildSimpleAssistantGuidance\(\{[\s\S]*realMonthlyRevenue: currentMonthTotal/);
  assert.match(app, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
});

test("LOT 5.51A reuses the existing feature flag through the visible slice", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(selector, /revenueTotal: usesShadow\s*\?\s*shadowResult\.revenue\.total\s*:\s*currentMonthTotal/);
  assert.match(region, /fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.doesNotMatch(region, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|FISCAL_SUMMARY_SHADOW_ENABLED/);
});

test("LOT 5.51A remains stable with the approved twelve Shadow occurrences and reserve-low occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const appOutsideSelector = appWithoutVisibleSlice();
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    1,
  );
  assert.equal(
    occurrences(
      region,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    APPROVED_COUNTS.monthlyReflectionChargesAmountAlias,
  );
  assert.equal(occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.revenueTotal/g), 6);
  assert.equal(occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
});

test("LOT 5.51A keeps React and fiscal pipeline boundaries stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(region, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(
    occurrences(APP_SOURCE, /\bmonthlyReflectionRevenueTotal\b/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalConsumers,
  );
  assert.equal(
    occurrences(APP_SOURCE, /\bmonthlyReflectionChargesAmount\b/g),
    APPROVED_COUNTS.monthlyReflectionChargesAmountConsumers,
  );
});

test("LOT 5.51A keeps revenue parity, shadow parity and runtime evidence intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /"revenue\.total"/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /\["revenue\.total", SHADOW_PARITY_MATCH\]/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(LOT_5_49_SOURCE, /LOT 5\.49 stabilizes the exact weekly consumer/);
});

test("LOT 5.51A documents local rollback", () => {
  const rollbackBefore = "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")";
  const rollbackAfter = "currentMonthTotal.toLocaleString(\"fr-FR\")";

  assert.equal(rollbackBefore, "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")");
  assert.equal(rollbackAfter, "currentMonthTotal.toLocaleString(\"fr-FR\")");
});
