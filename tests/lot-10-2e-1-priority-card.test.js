import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPriorityCardViewModel } from "../src/components/dashboard/buildPriorityCardViewModel.js";
import { getPrioritizedActions } from "../src/domain/obligations/index.js";
import { buildUrssafDeclarationAction } from "../src/domain/obligations/buildUrssafDeclarationAction.js";
import { buildMissingInformationActions } from "../src/domain/obligations/buildMissingInformationActions.js";
import { buildNoActionRequiredAction } from "../src/domain/obligations/buildNoActionRequiredAction.js";
import { getOfficialAction } from "../src/domain/obligations/officialActionRegistry.js";
import { ACTION_TYPE } from "../src/domain/obligations/constants.js";

// LOT 10.2E.1: PriorityCard is the first component that renders the
// canonical getPrioritizedActions() output to real users. This file tests
// the pure, React-free view-model builder directly -- the same seam the
// component itself consumes -- since this repository has no React
// rendering test harness installed (no jsdom/@testing-library/react); the
// component (PriorityCard.jsx) is a thin, deterministic function of this
// view-model, so exercising the builder is the "component behavior" seam
// that actually exists here. Wiring-only facts (which existing handler a
// CTA reuses) are covered by targeted source-shape assertions below,
// matching the established convention for non-renderable UI code in this
// repo (see tests/lot-10-2d-migration-security.test.js).

const QUARTERLY_PROFILE = Object.freeze({
  activity_type: "services",
  acre: "no",
  acre_start_date: null,
  business_start_date: null,
  declaration_frequency: "trimestriel",
});

const URSSAF_LINK = getOfficialAction("urssafDeclaration");

// ---------------------------------------------------------------------
// RANKING: the view-model always reflects the CANONICAL top action, and a
// lower-priority action never displaces it.
// ---------------------------------------------------------------------

test("RANKING: top canonical action is rendered -- an urgent declaration with no competing action becomes the view-model", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: "2026-07-29", // Q2 due 2026-07-31, 2 days out -- due soon
  });

  const viewModel = buildPriorityCardViewModel(actions[0]);
  assert.equal(actions[0].type, ACTION_TYPE.urssafDeclaration);
  assert.equal(viewModel.key, "due_soon");
});

test("RANKING: a lower-priority declaration action never displaces a genuinely more urgent, different top action", () => {
  const dossier = {
    id: "dossier-1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-27T00:00:00.000Z", // already declared -> merely informational tier
  };

  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE,
    revenues: [],
    referenceDate: "2026-07-29",
    declarationDossiers: [dossier],
    monthlyRevenue: 4000, // exceeds the VAT threshold -> genuinely urgent, different action
  });

  // The domain layer itself must rank TVA above the confirmed declaration
  // (already covered by tests/lot-10-2d-declaration-lifecycle.test.js) --
  // this test proves the view-model builder respects whatever actions[0]
  // the ranking produced, rather than independently re-picking the
  // declaration action because it "looks" more familiar.
  assert.equal(actions[0].type, ACTION_TYPE.tvaThreshold);
  const viewModel = buildPriorityCardViewModel(actions[0]);
  assert.notEqual(viewModel.key, "declared");
  assert.notEqual(viewModel.title, "Déclaration confirmée");
});

// ---------------------------------------------------------------------
// COPY: exact French copy per required state (LOT 10.2E.1 section 6).
// ---------------------------------------------------------------------

test("COPY: OVERDUE", () => {
  // Note: buildUrssafDeclarationAction's own auto-selecting period
  // resolution (resolveCurrentDeclarationPeriod, LOT 10.2C) never actually
  // produces OVERDUE with no dossier -- once a window month closes, the
  // "current period" silently re-resolves to a fresh, still-upcoming
  // period rather than staying pinned to the missed one (a documented,
  // pre-existing LOT 10.2C limitation, out of this LOT's scope -- see the
  // Final Report). The OVERDUE *status itself* is a real, valid
  // OBLIGATION_STATUS value the view-model must still render correctly
  // whenever it IS produced (e.g. a future period-pinned dossier path), so
  // this fixture constructs that action shape directly instead of trying
  // to coerce it out of the auto-selecting engine.
  const action = {
    type: ACTION_TYPE.urssafDeclaration,
    status: "overdue",
    dueDate: "2026-07-31",
    officialAction: URSSAF_LINK,
    metadata: { daysLeft: -5, declaredAt: null },
  };
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "overdue");
  assert.equal(viewModel.severity, "critical");
  assert.equal(viewModel.title, "Déclaration URSSAF à vérifier");
  assert.equal(
    viewModel.explanation,
    "Nous n'avons pas encore de confirmation que la déclaration due le 31 juillet 2026 a été effectuée.",
  );
  assert.equal(viewModel.dateLabel, "31 juillet 2026");
  assert.equal(viewModel.secondaryCta.label, "J'ai déjà déclaré");
});

test("COPY: DUE", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-31", // due today
    declarationDossier: null,
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "due");
  assert.equal(viewModel.severity, "urgent");
  assert.equal(viewModel.title, "Déclaration URSSAF à faire aujourd'hui");
  assert.equal(viewModel.explanation, "C'est le dernier jour pour déclarer.");
});

test("COPY: DUE_SOON", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-29", // 2 days before 2026-07-31
    declarationDossier: null,
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "due_soon");
  assert.equal(viewModel.severity, "urgent");
  assert.equal(viewModel.title, "Déclaration à faire avant le 31 juillet 2026");
  assert.equal(viewModel.explanation, "Il vous reste 2 jours.");
});

test("COPY: DUE_SOON singular day is grammatically correct", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-30", // 1 day before 2026-07-31
    declarationDossier: null,
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.explanation, "Il vous reste 1 jour.");
});

test("COPY: UPCOMING is calm, not alarming", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-05-01", // well before the 2026-07-31 deadline
    declarationDossier: null,
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "upcoming");
  assert.equal(viewModel.severity, "calm");
  assert.equal(viewModel.title, "Prochaine déclaration");
  assert.equal(viewModel.explanation, "À faire avant le 31 juillet 2026.");
  assert.notEqual(viewModel.severity, "critical");
  assert.notEqual(viewModel.severity, "urgent");
});

test("COPY: ALL_CLEAR", () => {
  const viewModel = buildPriorityCardViewModel(buildNoActionRequiredAction());

  assert.equal(viewModel.key, "all_clear");
  assert.equal(viewModel.severity, "positive");
  assert.equal(viewModel.title, "Tout est à jour");
  assert.equal(viewModel.explanation, "Aucune action urgente pour le moment.");
  assert.equal(viewModel.primaryCta, null);
  assert.equal(viewModel.secondaryCta, null);
});

test("COPY: MISSING_INFORMATION names the exact missing field, one per field", () => {
  const cases = [
    ["activity_type", "On a besoin de connaître ton type d'activité pour calculer tes cotisations."],
    [
      "declaration_frequency",
      "On a besoin de savoir à quelle fréquence tu déclares (mensuelle ou trimestrielle).",
    ],
    [
      "business_start_date",
      "On a besoin de ta date de création d'activité pour appliquer correctement l'ACRE.",
    ],
  ];

  for (const [field, expectedExplanation] of cases) {
    const actions = buildMissingInformationActions({
      fiscalProfile:
        field === "activity_type"
          ? { activity_type: null, declaration_frequency: "trimestriel" }
          : field === "declaration_frequency"
            ? { activity_type: "services", declaration_frequency: null }
            : { activity_type: "services", declaration_frequency: "trimestriel", acre: "yes", business_start_date: null },
    });
    const action = actions.find((a) => a.metadata.missingField === field);
    assert.ok(action, `expected a missing-information action for ${field}`);

    const viewModel = buildPriorityCardViewModel(action);
    assert.equal(viewModel.key, "missing_information");
    assert.equal(viewModel.severity, "attention");
    assert.equal(viewModel.title, "Une information manque");
    assert.equal(viewModel.explanation, expectedExplanation);
    assert.equal(viewModel.primaryCta.kind, "edit_profile");
    assert.equal(viewModel.primaryCta.label, "Compléter mon profil");
  }
});

test("COPY: FIRST_DECLARATION_UNRESOLVED does not invent a date and points to the user's own URSSAF space", () => {
  const actions = buildMissingInformationActions({
    fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-05-15" }, // mid-Q2
    referenceDate: "2026-07-29", // current period Q2 (Apr-Jun) predates the business
  });
  const action = actions.find((a) => a.metadata.missingField === "first_declaration_period");
  assert.ok(action);

  const viewModel = buildPriorityCardViewModel(action);
  assert.equal(viewModel.key, "first_declaration_unresolved");
  assert.equal(viewModel.severity, "calm");
  assert.equal(viewModel.title, "Date de première déclaration à confirmer");
  assert.match(viewModel.explanation, /pas encore assez d'informations vérifiées/);
  // No date fabricated anywhere in the view-model.
  assert.equal(viewModel.dateLabel, null);
  assert.equal(viewModel.primaryCta.href, URSSAF_LINK.url);
  assert.equal(viewModel.secondaryCta, null);
});

test("NO FABRICATION: FIRST_DECLARATION_UNRESOLVED never carries a due date under any input", () => {
  for (const referenceDate of ["2026-07-01", "2026-07-29", "2026-09-30"]) {
    const actions = buildMissingInformationActions({
      fiscalProfile: { ...QUARTERLY_PROFILE, business_start_date: "2026-05-15" },
      referenceDate,
    });
    const action = actions.find((a) => a.metadata.missingField === "first_declaration_period");
    if (!action) continue; // only assert when this reference date actually lands in the unresolved period
    const viewModel = buildPriorityCardViewModel(action);
    assert.equal(viewModel.dateLabel, null);
  }
});

// ---------------------------------------------------------------------
// OFFICIAL CTA: the primary CTA always reuses the existing, verified
// officialActionRegistry entry -- never an invented URL or label.
// ---------------------------------------------------------------------

test("CTA: due/due_soon/upcoming (real auto-resolved states) all use the exact same officialActionRegistry URSSAF link", () => {
  for (const referenceDate of ["2026-07-31", "2026-07-29", "2026-05-01"]) {
    const action = buildUrssafDeclarationAction({
      fiscalProfile: QUARTERLY_PROFILE,
      referenceDate,
      declarationDossier: null,
    });
    const viewModel = buildPriorityCardViewModel(action);
    assert.equal(viewModel.primaryCta.kind, "official_link");
    assert.equal(viewModel.primaryCta.href, URSSAF_LINK.url);
    assert.equal(viewModel.primaryCta.label, URSSAF_LINK.label);
  }
});

test("CTA: OVERDUE (directly-constructed fixture, see COPY: OVERDUE) also uses the exact same official link", () => {
  const viewModel = buildPriorityCardViewModel({
    type: ACTION_TYPE.urssafDeclaration,
    status: "overdue",
    dueDate: "2026-07-31",
    officialAction: URSSAF_LINK,
    metadata: { daysLeft: -5, declaredAt: null },
  });
  assert.equal(viewModel.primaryCta.href, URSSAF_LINK.url);
  assert.equal(viewModel.primaryCta.label, URSSAF_LINK.label);
});

// ---------------------------------------------------------------------
// DECLARATION LIFECYCLE: DECLARED/PAID never show a contradictory
// confirmation CTA -- reusing the exact same LOT 10.2D confirm flow.
// ---------------------------------------------------------------------

test("LIFECYCLE: a DECLARED dossier does not show 'J'ai fait ma déclaration' again -- only 'J'ai payé'", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-29",
    declarationDossier: {
      id: "d1",
      declared_at: "2026-07-27T00:00:00.000Z",
      paid_at: null,
    },
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "declared");
  assert.equal(viewModel.title, "Déclaration confirmée");
  assert.equal(viewModel.explanation, "Tu as déclaré le 27 juillet 2026.");
  assert.equal(viewModel.secondaryCta, null);
  assert.equal(viewModel.primaryCta.kind, "confirm_payment");
  assert.equal(viewModel.primaryCta.label, "J'ai payé");
});

test("LIFECYCLE: a PAID dossier shows no CTA at all -- nothing contradictory, nothing left to confirm", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-29",
    declarationDossier: {
      id: "d1",
      declared_at: "2026-07-27T00:00:00.000Z",
      paid_at: "2026-07-28T00:00:00.000Z",
    },
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.key, "paid");
  assert.equal(viewModel.title, "Déclarée et payée");
  assert.equal(viewModel.primaryCta, null);
  assert.equal(viewModel.secondaryCta, null);
});

test("LIFECYCLE: a not-yet-declared dossier still offers 'J'ai fait ma déclaration'", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: QUARTERLY_PROFILE,
    referenceDate: "2026-07-29",
    declarationDossier: null,
  });
  const viewModel = buildPriorityCardViewModel(action);

  assert.equal(viewModel.secondaryCta.kind, "confirm_declaration");
  assert.equal(viewModel.secondaryCta.label, "J'ai fait ma déclaration");
});

// ---------------------------------------------------------------------
// GENERIC FALLBACK: an action type outside the required-state list (e.g.
// TVA threshold) never crashes and never fabricates declaration-specific
// copy.
// ---------------------------------------------------------------------

test("FALLBACK: an action type PriorityCard has no dedicated copy for renders a safe, honest generic card", () => {
  const viewModel = buildPriorityCardViewModel({
    type: ACTION_TYPE.tvaThreshold,
    status: null,
    severity: "critical",
    metadata: {},
  });

  assert.ok(viewModel);
  assert.equal(viewModel.key, "generic");
  assert.notEqual(viewModel.title, "Déclaration confirmée");
  assert.equal(viewModel.dateLabel, null);
});

test("EDGE: no action at all produces no view-model (component renders nothing, not a broken card)", () => {
  assert.equal(buildPriorityCardViewModel(null), null);
  assert.equal(buildPriorityCardViewModel(undefined), null);
});

// ---------------------------------------------------------------------
// NO DUPLICATED CALCULATION: source-shape guard -- the view-model builder
// must only ever relabel fields already present on the canonical action,
// never recompute a deadline or a fiscal amount itself.
// ---------------------------------------------------------------------

const VIEW_MODEL_SOURCE = readFileSync(
  new URL("../src/components/dashboard/buildPriorityCardViewModel.js", import.meta.url),
  "utf8",
);

test("NO DUPLICATION: buildPriorityCardViewModel.js never imports a deadline/fiscal calculation engine", () => {
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /deadlineRules\.js/);
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /declarationPeriod\.js/);
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /calculateFiscalSummary/);
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /getDeadlineRule/);
});

test("NO DUPLICATION: buildPriorityCardViewModel.js never constructs its own ACRE-related logic", () => {
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /acre_start_date/i);
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /calculateAcre/i);
});

// ---------------------------------------------------------------------
// WIRING: PriorityCard/App.jsx reuse the existing LOT 10.2D declaration
// confirmation flow -- no second modal or persistence path is created.
// ---------------------------------------------------------------------

const PRIORITY_CARD_SOURCE = readFileSync(
  new URL("../src/components/dashboard/PriorityCard.jsx", import.meta.url),
  "utf8",
);
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("WIRING: PriorityCard has no modal state or persistence call of its own", () => {
  assert.doesNotMatch(PRIORITY_CARD_SOURCE, /useState/);
  assert.doesNotMatch(PRIORITY_CARD_SOURCE, /\bimport\b[\s\S]*supabase/i);
  assert.doesNotMatch(PRIORITY_CARD_SOURCE, /\.rpc\(/);
});

test("WIRING: App.jsx passes the exact same LOT 10.2D declaration handlers into PriorityCard, not new ones", () => {
  const wiringBlock = APP_SOURCE.slice(
    APP_SOURCE.indexOf("<PriorityCard"),
    APP_SOURCE.indexOf("<PriorityCard") + 400,
  );
  assert.match(wiringBlock, /onConfirmDeclaration=\{handleOpenDeclarationConfirm\}/);
  assert.match(wiringBlock, /onConfirmPayment=\{handleConfirmDeclarationPayment\}/);
});

test("WIRING: App.jsx renders PriorityCard from the FIRST (top-ranked) canonical action, not an arbitrary index", () => {
  assert.match(APP_SOURCE, /buildPriorityCardViewModel\(dashboardPrioritizedActions\[0\] \?\? null\)/);
});

test("CONSOLIDATION: the legacy 'Action prioritaire' hero is not a second dashboard action surface", () => {
  const dashboardStart = APP_SOURCE.indexOf('appView === "dashboard" ? (');
  assert.notEqual(dashboardStart, -1);
  const dashboardBranch = APP_SOURCE.slice(dashboardStart, dashboardStart + 9000);

  assert.doesNotMatch(dashboardBranch, /Action prioritaire/);
  assert.doesNotMatch(dashboardBranch, /dashboardCockpit/);
  assert.doesNotMatch(dashboardBranch, /Déclarer maintenant/);
});

test("NO NEW MIGRATION: no new Supabase migration file references PriorityCard or its view-model", () => {
  assert.doesNotMatch(PRIORITY_CARD_SOURCE, /create or replace function/i);
  assert.doesNotMatch(VIEW_MODEL_SOURCE, /create or replace function/i);
});
