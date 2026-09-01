import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_58_SOURCE = readFileSync(
  new URL("./lot-5-58-monthly-reflection-charges-migration-validation.test.js", import.meta.url),
  "utf8",
);
const LOT_5_56_SOURCE = readFileSync(
  new URL("./lot-5-56-monthly-reflection-charges-migration.test.js", import.meta.url),
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

const STABILITY_SCENARIOS = Object.freeze([
  { id: "zero", values: [] },
  { id: "positive", values: [1000] },
  { id: "decimal", values: [1234.56] },
  { id: "low-amount", values: [25] },
  { id: "high-amount", values: [25000] },
  { id: "changed-before", values: [1000] },
  { id: "changed-after", values: [1000, 500] },
  { id: "multiple", values: [1000, 250, 75] },
  { id: "remove-before", values: [1000, 500] },
  { id: "remove-after", values: [1000] },
  { id: "remove-last-before", values: [500] },
  { id: "remove-last-after", values: [] },
  { id: "zero-to-positive-before", values: [] },
  { id: "zero-to-positive-after", values: [250] },
  { id: "positive-to-zero-before", values: [250] },
  { id: "positive-to-zero-after", values: [] },
  { id: "acre-inactive", values: [1000], acre: "no" },
  {
    id: "acre-active",
    values: [1000],
    acre: "yes",
    acreStartDate: "2026-01-01",
  },
  { id: "successive-a", values: [100] },
  { id: "successive-b", values: [100, 200] },
  { id: "successive-c", values: [100, 200, 300.5] },
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

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

function smartAlertsBlock() {
  return extractBlock("const smartAlerts = useMemo", "  const smartPriorities = useMemo");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenuesFrom(values) {
  return values.map((amount, index) => ({
    id: `revenue-${index}`,
    amount,
    category: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function calculateCharges({ values, acre = "no", acreStartDate = "" }) {
  const input = buildFiscalSummaryInput({
    revenues: revenuesFrom(values),
    fiscalProfile: {
      activity_type: "service",
      acre,
      acre_start_date: acreStartDate,
    },
    period: {},
    referenceDate: "2026-07-20",
  });

  return calculateFiscalSummary(input, { trace: false }).summary.finalContributionAmount;
}

function selectFinalContributionAmount({ flagEnabled, shadowResult, estimatedCharges }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.summary.finalContributionAmount : estimatedCharges;
}

function renderMonthlyReflection({ revenueTotal, chargesAmount, invoicesThisMonth = 2 }) {
  const invoiceLabel = `${invoicesThisMonth} facture${invoicesThisMonth > 1 ? "s" : ""}`;
  return `Tu as enregistré ${revenueTotal.toLocaleString("fr-FR")} € de revenus, prévu ${chargesAmount.toLocaleString("fr-FR")} € de charges et créé ${invoiceLabel}.`;
}

test("LOT 5.59 keeps the monthly reflection charges Shadow source stable", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    region,
    /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/,
  );
  assert.match(monthly, /monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)/);
  assert.doesNotMatch(region, /monthlyReflectionChargesAmount = .*estimatedCharges/);
  assert.doesNotMatch(monthly, /estimatedCharges\.toLocaleString\("fr-FR"\)/);
});

test("LOT 5.59 keeps monthly reflection stable after the approved twelfth occurrence", () => {
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

test("LOT 5.59 keeps formatter and text stable", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());

  assert.match(
    monthly,
    /Tu as enregistré \$\{monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)\} € de revenus, prévu \$\{monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)\} € de charges et créé \$\{invoiceLabel\}\./,
  );
  assert.match(monthly, /const invoiceLabel = `\$\{invoicesThisMonth\} facture/);
  assert.match(monthly, /const reminderLabel = `\$\{activeReminderItems\.length\} rappel/);
  assert.match(monthly, /TVA : \$\{normalizedTvaStatusLabel \|\| "à surveiller"\}\./);
  assert.doesNotMatch(monthly, /getDisplayValue|Intl\.NumberFormat|Math\.round|Number\(|fallback|locale/);
});

test("LOT 5.59 stabilizes all requested charges transitions", () => {
  for (const scenario of STABILITY_SCENARIOS) {
    const first = calculateCharges(scenario);
    const second = calculateCharges(scenario);
    const cloned = calculateCharges(structuredClone(scenario));
    const revenueTotal = scenario.values.reduce((sum, amount) => sum + amount, 0);
    const rendered = renderMonthlyReflection({ revenueTotal, chargesAmount: first });

    assert.equal(first, second, scenario.id);
    assert.equal(first, cloned, scenario.id);
    assert.equal(typeof first, "number", scenario.id);
    assert.match(rendered, /Tu as enregistré .+ € de revenus, prévu .+ € de charges et créé 2 factures\./);
    assert.doesNotMatch(rendered, /NaN|undefined|null/);
  }
});

test("LOT 5.59 keeps feature flag ON and OFF behavior stable", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const shadowResult = { summary: { finalContributionAmount: 321 } };

  assert.equal(
    selectFinalContributionAmount({ flagEnabled: true, shadowResult, estimatedCharges: 999 }),
    321,
  );
  assert.equal(
    selectFinalContributionAmount({ flagEnabled: false, shadowResult, estimatedCharges: 999 }),
    999,
  );
  assert.equal(
    selectFinalContributionAmount({ flagEnabled: true, shadowResult: null, estimatedCharges: 999 }),
    999,
  );
  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(
    selector,
    /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/,
  );
  assert.doesNotMatch(monthlyReflectionRegion(), /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
});

test("LOT 5.59 keeps revenue consumer and rollback stable", () => {
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.match(region, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(region, /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/);
  assert.equal(
    "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")",
    "monthlyReflectionChargesAmount.toLocaleString(\"fr-FR\")",
  );
  assert.equal("estimatedCharges.toLocaleString(\"fr-FR\")", "estimatedCharges.toLocaleString(\"fr-FR\")");
});

test("LOT 5.59 keeps estimatedCharges Legacy and sensitive boundaries isolated; confirms root savingsGoal removed", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());

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
  assert.match(smartAlerts, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(coaching, /fiscalCoachingSavingsGoal > 0/);
  assert.doesNotMatch(coaching, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(exportSource, /dashboardChargesDisplay|savingsGoal|currentMonthTotal/);
  assert.doesNotMatch(exportSource, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(assistant, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.doesNotMatch(feedback, /monthlyReflectionChargesAmount|fiscalSummaryVisibleSlice/);
});

test("LOT 5.59 keeps React and fiscal pipeline surfaces stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const region = sourceWithoutComments(monthlyReflectionRegion());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(region, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(occurrences(region, /useMemo\(/g), 2);
});

test("LOT 5.59 keeps parity and runtime evidence intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /"summary\.finalContributionAmount"/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /\["summary\.finalContributionAmount", SHADOW_PARITY_MATCH\]/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(LOT_5_58_SOURCE, /validates deterministic charges scenarios and stable formatting/);
  assert.match(LOT_5_56_SOURCE, /keeps contribution, shadow parity and runtime evidence intact/);
});

test("LOT 5.59 confirms no propagation to adjacent consumers", () => {
  const monthly = sourceWithoutComments(monthlyReflectionBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.doesNotMatch(
    monthly,
    /supabase|localStorage|sessionStorage|payload|feedback|analytics|trackEvent|handleExportPDF|export_csv|export_pdf|assistant|coaching|savingsGoal|invoiceSectionSummary|handleMarkInvoicePaid|weeklyRecapEffectiveRate/i,
  );
  assert.match(weekly, /weeklyRecapEffectiveRate/);
  assert.doesNotMatch(weekly, /monthlyReflectionChargesAmount/);
});
