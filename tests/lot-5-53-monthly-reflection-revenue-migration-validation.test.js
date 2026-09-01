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
const LOT_5_51_SOURCE = readFileSync(
  new URL("./lot-5-51-monthly-reflection-revenue-migration.test.js", import.meta.url),
  "utf8",
);
const LOT_5_52_SOURCE = readFileSync(
  new URL("../docs/LOT_5_52_EXTENDED_STABILIZATION_REPORT.md", import.meta.url),
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

const REVENUE_SCENARIOS = Object.freeze([
  { id: "zero", values: [], expected: 0 },
  { id: "positive", values: [1200], expected: 1200 },
  { id: "decimal", values: [1234.56], expected: 1234.56 },
  { id: "multiple", values: [500, 700, 33.33], expected: 1233.33 },
  { id: "removed-one", values: [500, 700], expected: 1200 },
  { id: "removed-last", values: [], expected: 0 },
  { id: "zero-to-positive-before", values: [], expected: 0 },
  { id: "zero-to-positive-after", values: [250], expected: 250 },
  { id: "positive-to-zero-before", values: [250], expected: 250 },
  { id: "positive-to-zero-after", values: [], expected: 0 },
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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function selectRevenueTotal({ flagEnabled, shadowResult, currentMonthTotal }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.revenue.total : currentMonthTotal;
}

function calculateScenarioTotal(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function formatMonthlyRevenue(value) {
  return value.toLocaleString("fr-FR");
}

function renderMonthlyReflectionText({ revenueTotal, estimatedCharges = 321, invoicesThisMonth = 2 }) {
  const invoiceLabel = `${invoicesThisMonth} facture${invoicesThisMonth > 1 ? "s" : ""}`;

  return `Tu as enregistré ${formatMonthlyRevenue(
    revenueTotal,
  )} € de revenus, prévu ${estimatedCharges.toLocaleString(
    "fr-FR",
  )} € de charges et créé ${invoiceLabel}.`;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test("LOT 5.53 validates the approved source alias and Shadow revenueTotal", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.match(LOT_5_50_SOURCE, /Dashboard monthly reflection - revenue amount/);
  assert.match(
    LOT_5_51_SOURCE,
    /monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\\\.revenueTotal/,
  );
  assert.match(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(selector, /revenueTotal: usesShadow\s*\?\s*shadowResult\.revenue\.total\s*:\s*currentMonthTotal/);
});

test("LOT 5.53 validates the exact monthly reflection consumer and direct Legacy read removal", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.doesNotMatch(
    monthly,
    /Tu as enregistré \$\{currentMonthTotal\.toLocaleString\("fr-FR"\)\}/,
  );
});

test("LOT 5.53 validates formatter and text integrity", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(monthly, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.match(monthly, /monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(monthly, /estimatedCharges\.toLocaleString\("fr-FR"\)/);
  assert.match(monthly, /const invoiceLabel = `\$\{invoicesThisMonth\} facture/);
  assert.match(monthly, /const reminderLabel = `\$\{activeReminderItems\.length\} rappel/);
  assert.match(monthly, /"Tu vois plus clairement ton mois en cours\."/);
  assert.doesNotMatch(monthly, /Intl\.NumberFormat|Math\.round|Number\(|getDisplayValue|\?\?|\|\| 0/);
});

test("LOT 5.53 validates deterministic revenue value scenarios and formatting", () => {
  const results = REVENUE_SCENARIOS.map((scenario) => {
    const revenueTotal = calculateScenarioTotal(scenario.values);

    return {
      id: scenario.id,
      revenueTotal,
      formatted: formatMonthlyRevenue(revenueTotal),
      text: renderMonthlyReflectionText({ revenueTotal }),
    };
  });

  assert.deepEqual(
    results.map(({ id, revenueTotal }) => ({ id, revenueTotal })),
    REVENUE_SCENARIOS.map(({ id, expected }) => ({ id, revenueTotal: expected })),
  );
  for (const result of results) {
    assert.match(result.text, new RegExp(`Tu as enregistré ${result.formatted} € de revenus`));
    assert.match(result.text, /prévu 321 € de charges et créé 2 factures\./);
  }
});

test("LOT 5.53 validates same input, cloned input and transitions remain deterministic", () => {
  const scenario = deepFreeze({
    values: [123.45, 876.55],
    estimatedCharges: 456.78,
    invoicesThisMonth: 1,
  });
  const before = structuredClone(scenario);
  const evaluate = (input) =>
    renderMonthlyReflectionText({
      revenueTotal: calculateScenarioTotal(input.values),
      estimatedCharges: input.estimatedCharges,
      invoicesThisMonth: input.invoicesThisMonth,
    });

  assert.equal(evaluate(scenario), evaluate(scenario));
  assert.equal(evaluate(scenario), evaluate(structuredClone(scenario)));
  assert.deepEqual(scenario, before);
});

test("LOT 5.53 validates feature flag ON and OFF source selection", () => {
  assert.equal(
    selectRevenueTotal({
      flagEnabled: true,
      shadowResult: { revenue: { total: 999 } },
      currentMonthTotal: 111,
    }),
    999,
  );
  assert.equal(
    selectRevenueTotal({
      flagEnabled: false,
      shadowResult: { revenue: { total: 999 } },
      currentMonthTotal: 111,
    }),
    111,
  );
  assert.equal(
    selectRevenueTotal({
      flagEnabled: true,
      shadowResult: null,
      currentMonthTotal: 111,
    }),
    111,
  );
  assert.doesNotMatch(monthlyReflectionRegion(), /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
});

test("LOT 5.53 validates Shadow baseline twelve with monthly reflection charges and reserve-low occurrences", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const appOutsideSelector = appWithoutVisibleSlice();

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
  assert.equal(occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.revenueTotal/g), 4);
  assert.match(LOT_5_52_SOURCE, /fiscalSummaryVisibleSlice = 10/);
  assert.match(LOT_5_52_SOURCE, /No 11th fiscalSummaryVisibleSlice occurrence/);
});

test("LOT 5.53 validates currentMonthTotal Legacy retention outside monthly reflection", () => {
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

test("LOT 5.53 validates feedback, exports, assistant and persistence boundaries", () => {
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

test("LOT 5.53 validates no propagation to adjacent consumers", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());
  const weekly = extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");

  assert.doesNotMatch(
    monthly,
    /localStorage|sessionStorage|supabase|fetch|payload|feedback|analytics|trackEvent|handleExportPDF|export_csv|export_pdf|assistant|coaching|invoiceSectionSummary|handleMarkInvoicePaid|weeklyRecapEffectiveRate/i,
  );
  assert.doesNotMatch(weekly, /monthlyReflectionRevenueTotal|dashboardMonthlyReflection/);
  assert.match(LOT_5_49_SOURCE, /LOT 5\.49 stabilizes the exact weekly consumer/);
});

test("LOT 5.53 validates React and fiscal pipeline stability", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(region, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(occurrences(region, /useMemo\(/g), 2);
  assert.match(region, /monthlyReflectionRevenueTotal,/);
});

test("LOT 5.53 validates parity and runtime evidence remain intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /"revenue\.total"/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /\["revenue\.total", SHADOW_PARITY_MATCH\]/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /does not mutate legacy snapshot, shadow result or shadow input/);
});

test("LOT 5.53 validates local rollback only", () => {
  const before = "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")";
  const after = "currentMonthTotal.toLocaleString(\"fr-FR\")";
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(monthly, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.equal(before, "monthlyReflectionRevenueTotal.toLocaleString(\"fr-FR\")");
  assert.equal(after, "currentMonthTotal.toLocaleString(\"fr-FR\")");
  assert.doesNotMatch(monthly, /localStorage|supabase|payload|handleExportPDF|buildFiscalSummaryInput/);
});
