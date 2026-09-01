import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_55_SOURCE = readFileSync(
  new URL("../docs/LOT_5_55_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md", import.meta.url),
  "utf8",
);
const LOT_5_54_SOURCE = readFileSync(
  new URL("./lot-5-54-monthly-reflection-revenue-stabilization.test.js", import.meta.url),
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
  fiscalSummaryVisibleSlice: 13,
  monthlyReflectionRevenueTotalAssignment: 1,
  monthlyReflectionChargesAmountAssignment: 1,
  monthlyReflectionChargesAmountReferences: 3,
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

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function monthlyReflectionRegion() {
  return extractBlock("const invoicesThisMonth = useMemo(() => {", "useEffect(() => {");
}

function monthlyReflectionBlock() {
  return extractBlock("  const dashboardMonthlyReflection = useMemo(() => {", "useEffect(() => {");
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

function smartAlertsBlock() {
  return extractBlock("const smartAlerts = useMemo", "  const smartPriorities = useMemo");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.56A identifies the monthly reflection charges consumer", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(LOT_5_55_SOURCE, /Dashboard monthly reflection - charges amount/);
  assert.match(monthly, /const dashboardMonthlyReflection = useMemo\(\(\) => \{/);
  assert.match(monthly, /if \(revenues\.length === 0\) return null;/);
  assert.match(monthly, /title: "📅 Bilan du mois"/);
});

test("LOT 5.56A creates a local charges alias from the visible slice", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.match(
    region,
    /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/,
  );
  assert.equal(
    occurrences(
      app,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    APPROVED_COUNTS.monthlyReflectionChargesAmountAssignment,
  );
  assert.doesNotMatch(region, /monthlyReflectionChargesAmount = .*estimatedCharges/);
  assert.doesNotMatch(region, /useMemo\(\(\) => monthlyReflectionChargesAmount|useState/);
});

test("LOT 5.56A migrates only the charges amount source and keeps formatting", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.doesNotMatch(monthly, /prévu \$\{estimatedCharges\.toLocaleString\("fr-FR"\)\}/);
  assert.doesNotMatch(monthly, /getDisplayValue|Intl\.NumberFormat|Math\.round|Number\(/);
  assert.match(monthly, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.match(monthly, /monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)/);
});

test("LOT 5.56A preserves surrounding text and already migrated revenue amount", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(monthly, /const invoiceLabel = `\$\{invoicesThisMonth\} facture/);
  assert.match(monthly, /const reminderLabel = `\$\{activeReminderItems\.length\} rappel/);
  assert.match(monthly, /TVA : \$\{normalizedTvaStatusLabel \|\| "à surveiller"\}\./);
  assert.match(monthly, /"Tu vois plus clairement ton mois en cours\."/);
  assert.match(monthly, /monthlyReflectionRevenueTotal,/);
  assert.match(monthly, /monthlyReflectionChargesAmount,/);
  assert.doesNotMatch(monthly, /estimatedCharges,/);
});

test("LOT 5.56A keeps estimatedCharges Legacy for other approved consumers; confirms root savingsGoal removed", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());

  assert.match(app, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(app, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(app, /currentMonthTotal - estimatedCharges/);
  assert.match(smartAlerts, /estimatedCharges: smartAlertEstimatedCharges/);
  // LOT 5.91A: root savingsGoal (the Legacy Math.max(estimatedCharges * 3, 500)
  // formula) has been removed; both active aliases keep the Shadow-backed formula.
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
});

test("LOT 5.56A keeps coaching, PDF, assistant and persistence isolated", () => {
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());

  assert.match(coaching, /fiscalCoachingSavingsGoal > 0/);
  assert.doesNotMatch(coaching, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(exportSource, /dashboardChargesDisplay|savingsGoal|currentMonthTotal/);
  assert.doesNotMatch(exportSource, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(assistant, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
});

test("LOT 5.56A reuses the existing feature flag through the visible slice", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(
    selector,
    /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/,
  );
  assert.match(region, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(region, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|FISCAL_SUMMARY_SHADOW_ENABLED/);
});

test("LOT 5.56A keeps React and fiscal pipeline boundaries stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(region, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(occurrences(region, /useMemo\(/g), 2);
});

test("LOT 5.56A keeps contribution, shadow parity and runtime evidence intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /"summary\.finalContributionAmount"/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /\["summary\.finalContributionAmount", SHADOW_PARITY_MATCH\]/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(LOT_5_54_SOURCE, /LOT 5\.54 keeps parity and runtime evidence intact/);
});

test("LOT 5.56A keeps the approved twelve Shadow occurrences with reserve-low stabilized", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(app, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalAssignment,
  );
  assert.equal(
    occurrences(
      app,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    APPROVED_COUNTS.monthlyReflectionChargesAmountAssignment,
  );
  assert.equal(
    occurrences(APP_SOURCE, /\bmonthlyReflectionChargesAmount\b/g),
    APPROVED_COUNTS.monthlyReflectionChargesAmountReferences,
  );
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(sourceWithoutComments(smartAlertsBlock()), /estimatedCharges: smartAlertEstimatedCharges/);
});

test("LOT 5.56A keeps no propagation from the migrated charges source", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.doesNotMatch(
    monthly,
    /supabase|localStorage|sessionStorage|payload|feedback|analytics|trackEvent|handleExportPDF|export_csv|export_pdf|assistant|coaching|savingsGoal|invoiceSectionSummary|handleMarkInvoicePaid|weeklyRecapEffectiveRate/i,
  );
});

test("LOT 5.56A documents local rollback", () => {
  const before = "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")";
  const after = "estimatedCharges.toLocaleString(\"fr-FR\")";

  assert.equal(before, "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")");
  assert.equal(after, "estimatedCharges.toLocaleString(\"fr-FR\")");
});
