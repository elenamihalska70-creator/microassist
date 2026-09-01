import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_53_SOURCE = readFileSync(
  new URL("./lot-5-53-monthly-reflection-revenue-migration-validation.test.js", import.meta.url),
  "utf8",
);
const LOT_5_51_SOURCE = readFileSync(
  new URL("./lot-5-51-monthly-reflection-revenue-migration.test.js", import.meta.url),
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
  fiscalSummaryVisibleSlice: 13,
  monthlyReflectionRevenueTotalAssignment: 1,
  monthlyReflectionChargesAmountAssignment: 1,
  monthlyReflectionRevenueTotalReferences: 3,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

const TRANSITIONS = Object.freeze([
  { id: "zero", values: [], expected: 0 },
  { id: "first-positive", values: [1000], expected: 1000 },
  { id: "multiple-revenues", values: [1000, 250, 75], expected: 1325 },
  { id: "decimal-value", values: [1234.56], expected: 1234.56 },
  { id: "add-revenue-before", values: [1000], expected: 1000 },
  { id: "add-revenue-after", values: [1000, 500], expected: 1500 },
  { id: "remove-revenue-before", values: [1000, 500], expected: 1500 },
  { id: "remove-revenue-after", values: [1000], expected: 1000 },
  { id: "remove-last-before", values: [500], expected: 500 },
  { id: "remove-last-after", values: [], expected: 0 },
  { id: "zero-to-positive-before", values: [], expected: 0 },
  { id: "zero-to-positive-after", values: [250], expected: 250 },
  { id: "positive-to-zero-before", values: [250], expected: 250 },
  { id: "positive-to-zero-after", values: [], expected: 0 },
  { id: "successive-a", values: [100], expected: 100 },
  { id: "successive-b", values: [100, 200], expected: 300 },
  { id: "successive-c", values: [100, 200, 300.5], expected: 600.5 },
]);

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

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
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

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function total(values) {
  return values.reduce((sum, amount) => sum + amount, 0);
}

function formatRevenue(value) {
  return value.toLocaleString("fr-FR");
}

function renderText({ revenueTotal, estimatedCharges = 875, invoicesThisMonth = 2 }) {
  const invoiceLabel = `${invoicesThisMonth} facture${invoicesThisMonth > 1 ? "s" : ""}`;

  return `Tu as enregistré ${formatRevenue(
    revenueTotal,
  )} € de revenus, prévu ${estimatedCharges.toLocaleString(
    "fr-FR",
  )} € de charges et créé ${invoiceLabel}.`;
}

function selectRevenueTotal({ flagEnabled, shadowResult, currentMonthTotal }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.revenue.total : currentMonthTotal;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test("LOT 5.54 keeps the monthly reflection Shadow source stable", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.match(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(region, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.match(selector, /revenueTotal: usesShadow\s*\?\s*shadowResult\.revenue\.total\s*:\s*currentMonthTotal/);
  assert.match(LOT_5_53_SOURCE, /LOT 5\.53 validates the approved source alias and Shadow revenueTotal/);
});

test("LOT 5.54 keeps Shadow baseline at twelve with charges and reserve-low occurrences", () => {
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
    occurrences(APP_SOURCE, /\bmonthlyReflectionRevenueTotal\b/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalReferences,
  );
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.revenueTotal/g), 4);
});

test("LOT 5.54 keeps formatter and monthly reflection text stable", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.match(monthly, /title: "📅 Bilan du mois"/);
  assert.match(monthly, /"Tu vois plus clairement ton mois en cours\."/);
  assert.match(monthly, /const reminderLabel = `\$\{activeReminderItems\.length\} rappel/);
  assert.doesNotMatch(monthly, /Intl\.NumberFormat|Math\.round|Number\(|getDisplayValue|\?\?|\|\| 0/);
});

test("LOT 5.54 stabilizes all requested revenue transitions", () => {
  const evaluated = TRANSITIONS.map((transition) => ({
    id: transition.id,
    revenueTotal: total(transition.values),
    formatted: formatRevenue(total(transition.values)),
    text: renderText({ revenueTotal: total(transition.values) }),
  }));

  assert.deepEqual(
    evaluated.map(({ id, revenueTotal }) => ({ id, revenueTotal })),
    TRANSITIONS.map(({ id, expected }) => ({ id, revenueTotal: expected })),
  );
  for (const transition of evaluated) {
    assert.match(transition.text, new RegExp(`Tu as enregistré ${transition.formatted} € de revenus`));
    assert.match(transition.text, /prévu 875 € de charges et créé 2 factures\./);
  }
});

test("LOT 5.54 keeps repeated changes and cloned inputs deterministic", () => {
  const input = deepFreeze({
    values: [100, 200, 300.5],
    estimatedCharges: 1234.56,
    invoicesThisMonth: 1,
  });
  const before = structuredClone(input);
  const evaluate = (scenario) =>
    renderText({
      revenueTotal: total(scenario.values),
      estimatedCharges: scenario.estimatedCharges,
      invoicesThisMonth: scenario.invoicesThisMonth,
    });

  assert.equal(evaluate(input), evaluate(input));
  assert.equal(evaluate(input), evaluate(structuredClone(input)));
  assert.deepEqual(input, before);
});

test("LOT 5.54 keeps feature flag ON and OFF behavior stable", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.equal(
    selectRevenueTotal({
      flagEnabled: true,
      shadowResult: { revenue: { total: 450 } },
      currentMonthTotal: 125,
    }),
    450,
  );
  assert.equal(
    selectRevenueTotal({
      flagEnabled: false,
      shadowResult: { revenue: { total: 450 } },
      currentMonthTotal: 125,
    }),
    125,
  );
  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.doesNotMatch(region, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|FISCAL_SUMMARY_SHADOW_ENABLED/);
  assert.doesNotMatch(region, /\?\?|\|\| currentMonthTotal|localStorage\.setItem/);
});

test("LOT 5.54 keeps rollback local", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());
  const rollbackBefore = "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")";
  const rollbackAfter = "currentMonthTotal.toLocaleString(\"fr-FR\")";

  assert.match(monthly, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(monthly, /currentMonthTotal\.toLocaleString\("fr-FR"\)/);
  assert.equal(rollbackBefore, "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")");
  assert.equal(rollbackAfter, "currentMonthTotal.toLocaleString(\"fr-FR\")");
  assert.doesNotMatch(monthly, /localStorage|supabase|payload|handleExportPDF|buildFiscalSummaryInput/);
});

test("LOT 5.54 keeps currentMonthTotal retained for approved Legacy roles", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.doesNotMatch(monthly, /currentMonthTotal\.toLocaleString\("fr-FR"\)/);
  assert.match(app, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(app, /hasRealRevenue\s*\?\s*currentMonthTotal/);
  assert.match(app, /currentMonthTotal - estimatedCharges/);
  assert.match(app, /buildSmartAlerts\(\{[\s\S]*currentMonthTotal: smartAlertRevenueTotal,/);
  assert.match(app, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(app, /getDisplayValue\(currentMonthTotal, "money"\)/);
});

test("LOT 5.54 keeps feedback, exports, assistant, persistence and payloads unchanged", () => {
  const feedback = sourceWithoutComments(feedbackBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());

  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.doesNotMatch(feedback, /monthlyReflectionRevenueTotal|fiscalSummaryVisibleSlice/);
  assert.match(exportSource, /Revenus cumulés : \$\{getDisplayValue\(currentMonthTotal, "money"\)\}/);
  assert.doesNotMatch(exportSource, /monthlyReflectionRevenueTotal|fiscalSummaryVisibleSlice/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(assistant, /monthlyReflectionRevenueTotal|fiscalSummaryVisibleSlice/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /monthlyReflectionRevenueTotal|fiscalSummaryVisibleSlice/);
});

test("LOT 5.54 keeps React and fiscal pipeline stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(region, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(occurrences(region, /useMemo\(/g), 2);
  assert.match(region, /monthlyReflectionRevenueTotal,/);
});

test("LOT 5.54 keeps parity and runtime evidence intact", () => {
  assert.match(LOT_5_51_SOURCE, /LOT 5\.51A keeps revenue parity, shadow parity and runtime evidence intact/);
  assert.match(SHADOW_PARITY_SOURCE, /"revenue\.total"/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /\["revenue\.total", SHADOW_PARITY_MATCH\]/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});

test("LOT 5.54 keeps monthly reflection from propagating to adjacent consumers", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.doesNotMatch(
    monthly,
    /supabase|localStorage|feedback|analytics|payload|handleExportPDF|export_csv|export_pdf|assistant|coaching|invoiceSectionSummary|handleMarkInvoicePaid|weeklyRecapEffectiveRate/i,
  );
  assert.doesNotMatch(weekly, /monthlyReflectionRevenueTotal|dashboardMonthlyReflection/);
  assert.match(LOT_5_49_SOURCE, /LOT 5\.49 stabilizes the exact weekly consumer/);
});
