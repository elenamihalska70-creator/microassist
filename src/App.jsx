import {
  supabase,
  isSupabaseConfigured,
  SUPABASE_UNAVAILABLE_ERROR,
} from "./lib/supabase.js";
import AuthGate from "./components/AuthGate.jsx";
import CGUModal from "./components/CGUModal.jsx";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react"; // ✅ Добавляем useCallback
import "./App.css";
import { FISCAL_STEPS } from "./config/steps.fiscal";
import { computeObligations } from "./utils/obligations.js";
import { buildFiscalSummaryInput } from "./application/adapters/index.js";
import { resolveWeeklyEstimatedRate } from "./application/weekly/resolveWeeklyEstimatedRate.js";
import {
  createRuntimeParityEvidence,
  createRuntimeParityEvidenceStore,
} from "./application/shadow/runtimeParityEvidence.js";
import {
  buildLegacyActionPrioritySnapshot,
  buildCanonicalActionPrioritySnapshot,
  createActionPriorityParityEvidence,
  createActionPriorityParityEvidenceStore,
} from "./application/shadow/actionPriorityParityEvidence.js";
import { calculateFiscalSummary } from "./domain/calculations/facade/index.js";
import { getPrioritizedActions } from "./domain/obligations/index.js";
import { calculateNextReminderDate } from "./domain/rules/reminderSchedule.js";
import { showConsoleSignature } from "./consoleSignature.js";
import { useAuth } from "./context/AuthContext.jsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import InvoiceGenerator, {
  generateB2CInvoicePdf,
} from "./components/InvoiceGenerator.jsx";
import {
  PDP_ROADMAP_NOTE,
  TVA_EXEMPTION_MENTION,
  downloadTextFile,
  generateFacturXXml,
  getInvoiceComplianceScore,
  getInvoiceTotals,
  isInvoiceCompliant,
} from "./utils/facturx.js";
import { PRICING_LIMITS } from "./config/pricing.js";
import { ACCESS_MATRIX, getAccessProfile } from "./config/accessMatrix.js";
import PricingPage from "./components/PricingPage.jsx";
import ExpertDashboard from "./components/ExpertDashboard";
import MainNavigation from "./navigation/MainNavigation.jsx";
import AppShell from "./shell/AppShell.jsx";
// Добавьте после других констант:
const LS_KEY = "microassist_v1";
const LS_VERSION = 1;
const CHART_KEY = "microassist_show_chart";
const GUEST_REVENUES_KEY = "revenues_guest";
const GUEST_INVOICES_KEY = "guest_invoices";
const PREMIUM_STATUS_KEY = "microassist_is_premium";
const REMINDER_PREFS_KEY = "microassist_reminder_prefs";
const DASHBOARD_REMINDERS_DISMISSED_KEY =
  "microassist_dashboard_reminders_dismissed";
const DASHBOARD_SECTIONS_KEY = "microassist_dashboard_sections";
const DASHBOARD_TOP_NUDGE_DISMISSED_KEY =
  "microassist_dashboard_top_nudge_dismissed";
const DASHBOARD_CHECKLIST_COLLAPSED_KEY =
  "microassist_dashboard_checklist_collapsed";
const EXPERT_VIEW_DEMO_KEY = "microassist_expert_view_demo";
const FIRST_REVENUE_ONBOARDING_SEEN_KEY =
  "microassist_first_revenue_onboarding_seen";
const BETA_MICRO_FEEDBACK_KEY = "microassist_beta_micro_feedback";
const ANONYMOUS_VISITOR_ID_KEY = "microassist_anonymous_visitor_id";
const EMAIL_EVENT_KEY_PREFIX = "microassist_email_event_";
const BETA_SEEN_KEY = "beta_seen";
const PROFILE_CONFLICT_STRATEGY_KEY = "microassist_profile_conflict_strategy";
const SUBSCRIPTIONS_TABLE_ENABLED = false;
const FISCAL_SUMMARY_SHADOW_ENABLED = true;
const SHADOW_PARITY_EVIDENCE_COLLECTION_ENABLED = true;
const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;
const SHADOW_PARITY_EVIDENCE_STORE = createRuntimeParityEvidenceStore({
  enabled: SHADOW_PARITY_EVIDENCE_COLLECTION_ENABLED,
});
// LOT 10.2B: canonical obligation/action priority model, run in shadow mode
// only -- it does not drive any rendered UI yet (see docs section 10, "shadow
// migration strategy"). This records parity evidence comparing the legacy
// urgency signals (computed.urgency/tvaStatus, premiumTriggerContext) against
// the new canonical model's top-ranked action, without changing behavior.
const ACTION_PRIORITY_SHADOW_ENABLED = true;
const ACTION_PRIORITY_PARITY_EVIDENCE_STORE = createActionPriorityParityEvidenceStore({
  enabled: ACTION_PRIORITY_SHADOW_ENABLED,
});
const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfFLqWZajP6Dy0Zm5-bS9cnE5-joWecfCgfyIhzGRMbsk-jqA/viewform";
const FREE_EXPORTS_PER_MONTH = 3;
const EMPTY_EXPORT_USAGE = {
  csv: 0,
  pdf: 0,
  total: 0,
};
const EXPLANATION_CONTENT = {
  urssaf: {
    title: "Déclaration URSSAF en bref",
    sections: [
      {
        title: "À quoi sert l’URSSAF ?",
        text: "L’URSSAF est l’organisme où un micro-entrepreneur déclare son chiffre d’affaires.",
      },
      {
        title: "Pourquoi déclarer ?",
        text: "La déclaration permet de calculer les cotisations sociales à payer.",
      },
      {
        title: "Même à zéro",
        text: "Elle doit être faite même si ton chiffre d’affaires est de 0 €.",
      },
      {
        title: "Rythme",
        text: "Le rythme dépend de ton choix : mensuel ou trimestriel.",
      },
      {
        title: "Rôle de Microassist",
        text: "Microassist t’aide à préparer le montant et à recevoir des rappels, mais la déclaration se fait sur le site officiel.",
      },
    ],
    advice:
      "Tu peux déclarer directement sur le site officiel même si tu n’es pas sûr du montant exact : vérifie simplement les informations avant de valider.",
    link: "https://www.autoentrepreneur.urssaf.fr/",
    linkLabel: "Aller sur le site officiel URSSAF",
  },
  cfe: {
    title: "La CFE en bref",
    sections: [
      {
        title: "📌 Qu’est-ce que la CFE ?",
        text: "La Cotisation Foncière des Entreprises est un impôt local dû par beaucoup d’entreprises, même sans local professionnel.",
      },
      {
        title: "💰 À quoi ça sert ?",
        text: "Elle finance les collectivités locales et varie selon la commune, l’activité et la situation.",
      },
      {
        title: "📅 Quand la prévoir ?",
        text: "Elle est généralement à surveiller en fin d’année, surtout à partir de la deuxième année d’activité.",
      },
    ],
    advice: "Mets une petite réserve de côté pour éviter une surprise en fin d’année.",
    link: "https://www.impots.gouv.fr/professionnel/questions/quest-ce-que-la-cotisation-fonciere-des-entreprises-cfe",
    linkLabel: "En savoir plus sur impots.gouv.fr",
  },
  acre: {
    title: "L’ACRE en bref",
    sections: [
      {
        title: "📌 Qu’est-ce que l’ACRE ?",
        text: "Une aide qui réduit les cotisations sociales au début de l’activité.",
      },
      {
        title: "💰 À quoi ça sert ?",
        text: "Tu paies moins de charges pendant une période limitée.",
      },
      {
        title: "📅 Combien de temps ?",
        text: "En général, l’ACRE dure 12 mois pour une micro-entreprise.",
      },
    ],
    advice: "Profite de cette période pour mettre progressivement de côté.",
    link: "https://www.service-public.fr/particuliers/vosdroits/F11677",
    linkLabel: "En savoir plus sur service-public.fr",
  },
  tva: {
    title: "La TVA en bref",
    sections: [
      {
        title: "📌 C’est quoi ?",
        text: "Une taxe ajoutée au prix de vente dans certains cas.",
      },
      {
        title: "💰 Exemple simple",
        text: "Si une prestation coûte 100 € HT, le client peut payer 120 € TTC avec 20 % de TVA.",
      },
      {
        title: "📊 Pour les micro-entrepreneurs",
        text: "Beaucoup commencent sans facturer la TVA, puis doivent la surveiller si leur chiffre d’affaires augmente.",
      },
    ],
    advice:
      "Si tu ne sais pas encore, choisis “Je ne sais pas” et Microassist affichera une vigilance simple.",
    link: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F21746",
    linkLabel: "En savoir plus sur service-public.fr",
  },
};
const PENDING_AUTH_SUCCESS_KEY = "microassist_pending_auth_success";
const DEFAULT_REMINDER_PREFS = {
  declaration: true,
  tva: true,
  cfe: true,
  acre: true,
  email: true,
  sms: false,
};
const EMPTY_REMINDER_PREFS = {
  declaration: false,
  tva: false,
  cfe: false,
  acre: false,
  email: false,
  sms: false,
};
const DEFAULT_DASHBOARD_SECTIONS = {
  reminders: false,
  revenues: false,
  invoices: false,
  chart: false,
  learning: false,
  weekly: false,
  analysis: false,
};
const ANALYSIS_COPY = {
  title: "📊 Analyse financière",
  missingExpensesTitle: "Dépenses non renseignées",
  missingExpensesText: "Ajoute tes dépenses pour afficher une marge plus juste.",
  projectionLabel: "Projection annuelle",
  projectionPendingText:
    "Ajoute encore quelques revenus pour fiabiliser la projection annuelle.",
  projectionValueHelper: "Après charges et cotisations",
  projectionTrendHelper: "Projection basée sur ton rythme actuel.",
  expensesLabel: "Dépenses mensuelles",
  expensesHelper: "Tes charges personnelles",
  coverageLabel: "Couverture des dépenses",
  coverageHelper: "Revenus / Dépenses",
  collapsedWithExpenses: (amount) =>
    `${amount.toLocaleString("fr-FR")} € de dépenses mensuelles suivies.`,
  collapsedEmpty: "Analyse disponible dès que les données de suivi sont suffisantes.",
};
const DAILY_FISCAL_TIP_COPY = {
  title: "💡 Conseil fiscal du moment",
  irregularRevenue:
    "Tes encaissements sont irréguliers. Un suivi plus régulier rend tes repères fiscaux plus fiables.",
  irregularRevenueCta: "Ajouter un revenu",
  tvaWatch:
    "Le passage à la TVA approche. Vérifie dès maintenant le paramétrage de ta facturation.",
  tvaWatchCta: "Comprendre la TVA",
  missingExpenses: "Ajoute tes dépenses pour compléter la lecture de ta marge.",
  deadline:
    "La prochaine déclaration URSSAF mérite d’être préparée maintenant. Prévois le montant à déclarer avant l’échéance.",
  deadlineCta: "Gérer mes rappels",
  lowReserve:
    "Ta réserve reste courte au regard de l’objectif calculé. Sécurise une part des prochains encaissements.",
  acreEnding:
    "La fin de l’ACRE approche. Anticipe l’évolution de tes cotisations sur les prochains mois.",
  guestHistory:
    "Ton historique devient utile pour le suivi fiscal. Créer ton compte permet de le conserver dans la durée.",
  guestHistoryCta: "Créer mon compte",
  firstInvoice:
    "Tu as déjà de l’activité enregistrée. Une première facture aide à cadrer le suivi client, les encaissements et la TVA collectée.",
  firstInvoiceCta: "Créer une facture",
};
const FISCAL_MARKERS_COPY = {
  title: "Repères fiscaux",
  declaration: {
    label: "Échéance",
    fallbackValue: "À définir",
    fallbackHint: "Choisis ta périodicité.",
  },
  charges: {
    label: "À prévoir",
    profileIncompleteValue: "Profil à compléter",
    withRevenueHint: "Montant à mettre de côté",
    withoutRevenueHint: "Ajoute un revenu",
    incompleteHint: "Complète ton profil pour débloquer ce repère",
  },
  tva: {
    label: "TVA",
    fallbackValue: "À confirmer",
    getHint: ({ status, hasEarlyRevenueData, fallbackHint }) => {
      if (status === "exceeded") {
        return "La TVA doit maintenant entrer dans ton suivi.";
      }

      if (status === "soon") {
        return "Ton rythme d’activité demande une vigilance TVA.";
      }

      if (hasEarlyRevenueData) {
        return "Le statut TVA se précise avec davantage d’activité.";
      }

      return fallbackHint || "Statut estimé selon ton activité.";
    },
  },
};
const SCORE_COPY = {
  title: "🎯 Score fiscal",
  getHelper: ({ hasEarlyRevenueData, revenueCount }) => {
    if (hasEarlyRevenueData) {
      return revenueCount <= 1
        ? "Basé sur ton profil et un premier niveau d’activité."
        : "Basé sur ton profil et encore peu de données.";
    }

    return "Basé sur ton profil et ton suivi.";
  },
  getInterpretation: (score) => {
    if (score >= 80) return "Ton espace est très bien piloté.";
    if (score >= 60) return "Ton suivi est bon, encore quelques optimisations.";
    return "Ton espace a besoin de plus de suivi.";
  },
};
const MATURITY_COPY = {
  title: "📈 Niveau de maturité du suivi",
  badge: "En progression",
  getHelper: (revenuesLeft) =>
    revenuesLeft > 0
      ? `Ajoute encore ${revenuesLeft} revenu${revenuesLeft > 1 ? "s" : ""} pour fiabiliser les projections annuelles.`
      : "Ton cockpit fiscal dispose maintenant d’une base fiable pour les projections.",
};
const ROLE_BASED_TIPS = {
  default: {
    dailyFiscalTip: {
      irregularRevenue:
        "Tes encaissements sont irréguliers. Un suivi plus régulier rend tes repères fiscaux plus fiables.",
      tvaWatch:
        "Le passage à la TVA approche. Vérifie dès maintenant le paramétrage de ta facturation.",
      missingExpenses: "Ajoute tes dépenses pour compléter la lecture de ta marge.",
      deadline:
        "La prochaine déclaration URSSAF mérite d’être préparée maintenant. Prévois le montant à déclarer avant l’échéance.",
      lowReserve:
        "Ta réserve reste courte au regard de l’objectif calculé. Sécurise une part des prochains encaissements.",
      acreEnding:
        "La fin de l’ACRE approche. Anticipe l’évolution de tes cotisations sur les prochains mois.",
      guestHistory:
        "Ton historique devient utile pour le suivi fiscal. Créer ton compte permet de le conserver dans la durée.",
      firstInvoice:
        "Tu as déjà de l’activité enregistrée. Une première facture aide à cadrer le suivi client, les encaissements et la TVA collectée.",
    },
    pointOfDay: {
      tvaExceeded: "La TVA demande maintenant une préparation concrète.",
      tvaSoon: "La TVA mérite une vigilance renforcée pour les prochains revenus.",
      incompleteProfile: "Ton profil reste à compléter pour fiabiliser les calculs.",
      missingExpenses:
        "Aucune dépense renseignée : la marge et la lecture de santé restent partielles.",
      lowHistory: "Encore quelques revenus et les estimations deviendront plus fiables.",
      allGood: "Ton suivi avance bien. Continue comme ça.",
    },
    nextMonth: {
      tva: "Prépare le suivi TVA du mois prochain.",
      guest: "Crée ton compte pour retrouver ce suivi le mois prochain.",
      earlyHistory: "Ajoute encore quelques saisies pour mieux préparer le mois prochain.",
      reminders: "Active tes rappels pour mieux anticiper le mois prochain.",
      ready: "Ton suivi est prêt pour le mois prochain.",
    },
  },
  service: {
    dailyFiscalTip: {
      irregularRevenue:
        "Tes encaissements varient encore. Un suivi plus régulier rendra tes repères de prestations plus fiables.",
      tvaWatch:
        "Le passage à la TVA approche. Vérifie dès maintenant le paramétrage de tes devis et factures.",
      missingExpenses:
        "Ajoute tes frais de fonctionnement pour mieux lire ta marge de service.",
      deadline:
        "La prochaine déclaration URSSAF mérite d’être préparée maintenant. Prévois le montant à déclarer avant l’échéance.",
      lowReserve:
        "Ta réserve reste courte pour sécuriser les prochaines prestations encaissées.",
      acreEnding:
        "La fin de l’ACRE approche. Anticipe l’évolution de tes cotisations sur tes prochaines prestations.",
      guestHistory:
        "Ton historique de prestations devient utile. Créer ton compte permet de le conserver dans la durée.",
      firstInvoice:
        "Tu as déjà de l’activité enregistrée. Une première facture aide à cadrer le suivi client et les encaissements.",
    },
    pointOfDay: {
      tvaExceeded: "La TVA demande maintenant une préparation concrète sur tes prestations.",
      tvaSoon: "La TVA mérite une vigilance renforcée sur tes prochains encaissements.",
      incompleteProfile: "Ton profil reste à compléter pour fiabiliser les calculs liés à ton activité de service.",
      missingExpenses:
        "Aucun frais renseigné : la marge de tes prestations reste partielle.",
      lowHistory:
        "Encore quelques prestations enregistrées et les estimations seront plus fiables.",
      allGood: "Ton suivi de prestations avance bien. Continue comme ça.",
    },
    nextMonth: {
      tva: "Prépare le suivi TVA du mois prochain sur tes prestations.",
      guest: "Crée ton compte pour retrouver ton suivi de prestations le mois prochain.",
      earlyHistory:
        "Ajoute encore quelques prestations pour mieux préparer le mois prochain.",
      reminders: "Active tes rappels pour anticiper sereinement le mois prochain.",
      ready: "Ton suivi est prêt pour le mois prochain.",
    },
  },
  commerce: {
    dailyFiscalTip: {
      irregularRevenue:
        "Tes encaissements varient encore. Un suivi plus régulier rendra tes repères de commerce plus fiables.",
      tvaWatch:
        "Le passage à la TVA approche. Vérifie dès maintenant le paramétrage de ta facturation et de ton commerce.",
      missingExpenses:
        "Ajoute tes achats et frais pour mieux lire ta marge commerciale.",
      deadline:
        "La prochaine déclaration URSSAF mérite d’être préparée maintenant. Prévois le montant à déclarer avant l’échéance.",
      lowReserve:
        "Ta réserve reste courte pour absorber les prochains besoins liés à ton commerce.",
      acreEnding:
        "La fin de l’ACRE approche. Anticipe l’évolution de tes cotisations sur ton activité de commerce.",
      guestHistory:
        "Ton historique de commerce devient utile. Créer ton compte permet de le conserver dans la durée.",
      firstInvoice:
        "Tu as déjà de l’activité enregistrée. Une première facture aide à cadrer le suivi client, les encaissements et la TVA collectée.",
    },
    pointOfDay: {
      tvaExceeded: "La TVA demande maintenant une préparation concrète sur ton commerce.",
      tvaSoon: "La TVA mérite une vigilance renforcée sur ton commerce.",
      incompleteProfile: "Ton profil reste à compléter pour fiabiliser les calculs liés à ton activité de commerce.",
      missingExpenses:
        "Aucun achat ni frais renseigné : la marge commerciale reste partielle.",
      lowHistory: "Encore quelques revenus de commerce enregistrés et les estimations seront plus fiables.",
      allGood: "Ton suivi de commerce avance bien. Continue comme ça.",
    },
    nextMonth: {
      tva: "Prépare le suivi TVA du mois prochain sur ton commerce.",
      guest: "Crée ton compte pour retrouver ton suivi de commerce le mois prochain.",
      earlyHistory: "Ajoute encore quelques revenus de commerce pour mieux préparer le mois prochain.",
      reminders: "Active tes rappels pour anticiper sereinement le mois prochain.",
      ready: "Ton suivi est prêt pour le mois prochain.",
    },
  },
  mixte: {
    dailyFiscalTip: {
      irregularRevenue:
        "Tes encaissements varient encore. Un suivi plus régulier rendra tes repères d’activité plus fiables.",
      tvaWatch:
        "Le passage à la TVA approche. Vérifie dès maintenant le paramétrage de ta facturation sur l’ensemble de ton activité.",
      missingExpenses:
        "Ajoute tes frais pour mieux lire la marge globale de ton activité mixte.",
      deadline:
        "La prochaine déclaration URSSAF mérite d’être préparée maintenant. Prévois le montant à déclarer avant l’échéance.",
      lowReserve:
        "Ta réserve reste courte pour sécuriser les prochains encaissements de ton activité mixte.",
      acreEnding:
        "La fin de l’ACRE approche. Anticipe l’évolution de tes cotisations sur l’ensemble de ton activité.",
      guestHistory:
        "Ton historique devient utile pour suivre ton activité mixte. Créer ton compte permet de le conserver dans la durée.",
      firstInvoice:
        "Tu as déjà de l’activité enregistrée. Une première facture aide à cadrer le suivi client, les encaissements et la TVA collectée.",
    },
    pointOfDay: {
      tvaExceeded: "La TVA demande maintenant une préparation concrète sur l’ensemble de ton activité.",
      tvaSoon: "La TVA mérite une vigilance renforcée sur tes prochains encaissements.",
      incompleteProfile: "Ton profil reste à compléter pour fiabiliser les calculs liés à ton activité mixte.",
      missingExpenses:
        "Aucun frais renseigné : la marge de ton activité mixte reste partielle.",
      lowHistory:
        "Encore quelques revenus enregistrés et les estimations seront plus fiables.",
      allGood: "Ton suivi d’activité avance bien. Continue comme ça.",
    },
    nextMonth: {
      tva: "Prépare le suivi TVA du mois prochain sur l’ensemble de ton activité.",
      guest: "Crée ton compte pour retrouver ce suivi le mois prochain.",
      earlyHistory: "Ajoute encore quelques revenus pour mieux préparer le mois prochain.",
      reminders: "Active tes rappels pour anticiper sereinement le mois prochain.",
      ready: "Ton suivi est prêt pour le mois prochain.",
    },
  },
};
const FULL_RESET_LOCAL_STORAGE_KEYS = [
  LS_KEY,
  GUEST_REVENUES_KEY,
  GUEST_INVOICES_KEY,
  REMINDER_PREFS_KEY,
  DASHBOARD_REMINDERS_DISMISSED_KEY,
  DASHBOARD_SECTIONS_KEY,
  CHART_KEY,
  PENDING_AUTH_SUCCESS_KEY,
  PROFILE_CONFLICT_STRATEGY_KEY,
];
const MIN_REALISTIC_FISCAL_DATE = "2000-01-01";
const SIMPLE_PROFILE_KEY = "microassist_profile_v1";
const TVA_CONFIG_OPTIONS = [
  { value: "franchise", label: "Franchise de TVA" },
  { value: "active", label: "TVA active" },
  { value: "unknown", label: "Je ne sais pas" },
];

function getTvaConfigLabel(status) {
  const normalizedStatus = normalizeTvaConfigStatus(status);
  return (
    TVA_CONFIG_OPTIONS.find((option) => option.value === normalizedStatus)?.label ||
    "Je ne sais pas"
  );
}

function normalizeTvaConfigStatus(status) {
  if (status === "tva") return "active";
  if (status === "assujetti") return "active";
  if (status === "active" || status === "franchise" || status === "unknown") {
    return status;
  }

  return "unknown";
}

function readSimpleAssistantProfile() {
  try {
    const raw = localStorage.getItem(SIMPLE_PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return parsed;

    return {
      ...parsed,
      activity_type: parsed.activity_type
        ? normalizeActivityType(parsed.activity_type)
        : parsed.activity_type,
    };
  } catch {
    return null;
  }
}

function normalizeActivityType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "vente" || normalized === "sale" || normalized === "sales") {
    console.log("ACTIVITY NORMALIZED", value, "commerce");
    return "commerce";
  }
  if (normalized === "service" || normalized === "services") {
    if (value !== "services") {
      console.log("ACTIVITY NORMALIZED", value, "services");
    }
    return "services";
  }
  if (normalized === "mixte" || normalized === "mix" || normalized === "mixed") {
    if (value !== "mixte") {
      console.log("ACTIVITY NORMALIZED", value, "mixte");
    }
    return "mixte";
  }
  return normalized || "services";
}

function getSimpleActivityLabel(activityType) {
  const normalizedActivityType = normalizeActivityType(activityType);
  if (normalizedActivityType === "services") return "Services";
  if (normalizedActivityType === "commerce") return "Commerce";
  if (normalizedActivityType === "mixte") return "Activité mixte";
  return "Activité";
}

function getDisplayValue(value, type = "text") {
  if (value === null || value === undefined || value === "") {
    return "Pas encore assez de données";
  }

  const numericValue = Number(value);
  const isNumeric = Number.isFinite(numericValue);

  if (isNumeric && numericValue === 0 && type.includes("noData")) {
    return "Pas encore assez de données";
  }

  if (type.includes("money") && isNumeric) {
    return `${numericValue.toLocaleString("fr-FR")} €`;
  }

  if (type.includes("score") && isNumeric) {
    return `${numericValue} / 100`;
  }

  return String(value);
}

function readExpertViewLocalData() {
  let profile = readSimpleAssistantProfile() || {};
  let answers = {};
  let revenues = [];

  try {
    const rawSnapshot = localStorage.getItem(EXPERT_VIEW_DEMO_KEY);
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null;
    if (snapshot && typeof snapshot === "object") {
      return {
        profile: snapshot.profile || {},
        answers: snapshot.answers || {},
        revenues: Array.isArray(snapshot.revenues) ? snapshot.revenues : [],
      };
    }
  } catch {
    // Fallback to the local app data below.
  }

  try {
    const rawAnswers = localStorage.getItem(LS_KEY);
    const parsedAnswers = rawAnswers ? JSON.parse(rawAnswers) : null;
    answers = parsedAnswers?.answers || {};
  } catch {
    answers = {};
  }

  try {
    const rawRevenues = localStorage.getItem(GUEST_REVENUES_KEY);
    const parsedRevenues = rawRevenues ? JSON.parse(rawRevenues) : [];
    revenues = Array.isArray(parsedRevenues) ? parsedRevenues : [];
  } catch {
    revenues = [];
  }

  profile = {
    ...profile,
    activity_type: profile.activity_type || answers.activity_type || "services",
    declaration_frequency:
      profile.declaration_frequency ||
      answers.declaration_frequency ||
      "mensuel",
    tva_status: profile.tva_status || answers.tva_status || "unknown",
    acre: answers.acre,
    business_start_date: answers.business_start_date,
  };

  return { profile, answers, revenues };
}

function getExpertDeclarationLabel(frequency) {
  return frequency === "trimestriel" ? "Trimestrielle" : "Mensuelle";
}

function getExpertTvaLabel(status) {
  const normalizedStatus = normalizeTvaConfigStatus(status);
  if (normalizedStatus === "franchise") return "Franchise";
  if (normalizedStatus === "active") return "TVA active";
  return "À vérifier";
}

function getAcreStatusLabel(status) {
  if (status === "to_request") return "À demander";
  if (status === "requested") return "Demandée";
  if (status === "yes") return "Acceptée";
  if (status === "no") return "Non concerné";
  return "Je ne sais pas";
}

function ExpertView({ answers: providedAnswers, revenues: providedRevenues } = {}) {
  const localData = readExpertViewLocalData();
  const profile = localData.profile || {};
  const answers = providedAnswers || {
    activity: getSimpleActivityLabel(profile.activity_type),
    periodicity: getExpertDeclarationLabel(profile.declaration_frequency),
    tvaStatus: getExpertTvaLabel(profile.tva_status),
    acre: profile.acre || "unknown",
  };
  const revenues = providedRevenues || localData.revenues || [];
  const hasRevenue = revenues.length > 0;

  return (
    <main className="expertViewPage">
      <section className="expertViewHero">
        <p className="eyebrow">Microassist</p>
        <h1>Vue conseiller</h1>
        <p>Aperçu simplifié d’un dossier micro-entrepreneur.</p>
      </section>

      <section className="expertViewGrid">
        <div className="card">
          <h2>Dossier client</h2>
          <p><strong>Client :</strong> Démonstration</p>
          <p><strong>Activité :</strong> {answers?.activity || "Services"}</p>
          <p><strong>Déclaration :</strong> {answers?.periodicity || "Mensuelle"}</p>
          <p><strong>TVA :</strong> {answers?.tvaStatus || "À vérifier"}</p>
          <p><strong>ACRE :</strong> {getAcreStatusLabel(answers?.acre)}</p>
        </div>

        <div className="card priority">
          <h2>Action à vérifier</h2>
          <p>
            {hasRevenue
              ? "Vérifier la prochaine déclaration URSSAF et le montant à déclarer."
              : "Le client doit ajouter son premier revenu pour fiabiliser les estimations."}
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Indicateurs</h2>
        <ul>
          <li>Déclaration URSSAF : À vérifier</li>
          <li>TVA : À surveiller</li>
          <li>CFE : Rappel actif</li>
          <li>ACRE : {getAcreStatusLabel(answers?.acre)}</li>
        </ul>
      </section>

      <p className="muted">
        Version de démonstration — les données affichées sont indicatives.
      </p>
    </main>
  );
}

function buildSimpleAssistantGuidance({
  profile,
  realMonthlyRevenue = 0,
  hasRealRevenue = false,
} = {}) {
  if (!profile?.activity_type) {
    return {
      title: "Votre prochaine action",
      text: "Répondez aux 2 questions de démarrage pour obtenir une action claire.",
      chargeRate: null,
      alerts: [],
      tone: "neutral",
    };
  }

  const starterEstimate = Math.max(0, Number(profile.monthly_revenue) || 0);
  const hasStarterEstimate =
    profile.monthly_revenue !== null &&
    profile.monthly_revenue !== undefined &&
    profile.monthly_revenue !== "" &&
    Number(profile.monthly_revenue) > 0;
  const monthlyRevenue = hasRealRevenue
    ? Math.max(0, Number(realMonthlyRevenue) || 0)
    : starterEstimate;

  // Single canonical fiscal engine (LOT 10.1B): onboarding no longer owns its
  // own contribution/ACRE rate table. It calls the exact same computeObligations
  // path as the dashboard so the two screens can never disagree again.
  const guidanceObligations = computeObligations({
    ca_month: monthlyRevenue,
    activity_type: profile.activity_type,
    acre: profile.acre,
    acre_start_date: profile.acre_start_date,
    business_start_date: profile.business_start_date,
  });
  const chargeRate = Math.round(guidanceObligations.rate * 100);
  const chargeEstimate = guidanceObligations.estimatedAmount;
  const alerts = ["Préparez votre déclaration URSSAF"];

  if (!hasRealRevenue && !hasStarterEstimate) {
    return {
      title: "Votre prochaine action",
      text: "Ajoute ton premier revenu pour obtenir une estimation fiable.",
      helper: "Aucun CA estimé renseigné pour le moment.",
      chargeRate,
      alerts: ["Préparez votre déclaration URSSAF"],
      tone: "neutral",
      monthlyRevenue: null,
      hasRealRevenue,
    };
  }

  if (chargeEstimate > 0) {
    alerts.push("Mettez de côté pour vos charges");
  }
  let tone = "success";
  let tvaText = "";

  if (monthlyRevenue > 36800) {
    tone = "danger";
    tvaText = "Alerte TVA : votre chiffre d’affaires dépasse 36 800 €.";
    alerts.unshift("Alerte seuil TVA");
  } else if (monthlyRevenue > 30000) {
    tone = "warning";
    tvaText = "Attention au seuil TVA : votre chiffre d’affaires approche du seuil.";
    alerts.unshift("Attention au seuil TVA");
  } else if (profile.tva_status === "unknown") {
    alerts.push("Vérifiez votre statut TVA");
  }

  return {
    title: "Votre prochaine action",
    text: `Mettez environ ${chargeEstimate.toLocaleString("fr-FR")} € de côté ce mois-ci pour vos charges (${chargeRate}% estimés).`,
    helper:
      tvaText ||
      (hasRealRevenue
        ? "Estimation basée sur vos revenus enregistrés."
        : "Estimation provisoire basée sur ton CA estimé."),
    chargeRate,
    alerts,
    tone,
    monthlyRevenue,
    hasRealRevenue,
  };
}

function getInvoicePaymentStatus(invoice) {
  return invoice?.status === "paid" ? "paid" : "unpaid";
}

function getInvoiceDisplayAmountLabel(invoice) {
  const totals = getInvoiceTotals(invoice);
  const amount = totals.isVatExempt ? totals.totalHT : totals.totalTTC;
  return `${amount.toLocaleString("fr-FR")} € ${totals.amountLabel}`;
}

function getInvoiceDisplayNumber(invoice) {
  return invoice?.invoiceNumber || invoice?.invoice_number || invoice?.id || "Facture";
}

function getInvoiceDisplayDate(invoice) {
  return invoice?.issueDate || invoice?.invoice_date || "";
}

function addInvoiceDueDate(dateString, days = 30) {
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function isFacturXDraftInvoice(invoice) {
  return invoice?.formatStatus === "facturx_ready_draft";
}

function downloadInvoiceXmlDraft(invoice) {
  if (!isFacturXDraftInvoice(invoice)) return;

  downloadTextFile(
    `facturx-draft-${getInvoiceDisplayNumber(invoice)}.xml`,
    generateFacturXXml(invoice),
  );
}

function ExplanationModal({ content, onClose }) {
  if (!content) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        style={{ maxWidth: "520px" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explanation-modal-title"
      >
        <div className="sectionHead">
          <h3 id="explanation-modal-title">{content.title}</h3>
          <button
            className="iconBtn"
            onClick={onClose}
            type="button"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
          {content.sections.map((section) => (
            <div
              className="explanationModalBlock"
              key={section.title}
            >
              <strong>{section.title}</strong>
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {section.text}
              </p>
            </div>
          ))}

          {content.advice && (
            <div className="explanationModalAdvice">
              {content.advice}
            </div>
          )}

          {content.link && (
            <a
              href={content.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btnGhost"
              style={{
                textAlign: "center",
                display: "block",
                textDecoration: "none",
              }}
            >
              🔗 {content.linkLabel || "Source officielle"}
            </a>
          )}

          <button
            className="btn btnPrimary"
            onClick={onClose}
            type="button"
            style={{ width: "100%" }}
          >
            J’ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
// ... константы ...
function labelFromOptions(stepKey, value) {
  const normalizedValue =
    stepKey === "activity_type" ? normalizeActivityType(value) : value;
  const configStep = FISCAL_STEPS.find((s) => s.key === stepKey);
  const opt = configStep?.options?.find((o) => o.value === normalizedValue);
  return opt?.label || normalizedValue || "—";
}

function track(eventName, params = {}) {
  if (window.gtag) {
    window.gtag("event", eventName, params);
  }
}

function appendAnalyticsEntry({
  entry,
  storageKey,
  logPrefix,
  globalLogKey = null,
}) {
  if (typeof window !== "undefined") {
    if (globalLogKey) {
      window[globalLogKey] = window[globalLogKey] || [];
      window[globalLogKey].push(entry);
    }

    try {
      const raw = window.localStorage?.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(parsed) ? [...parsed, entry] : [entry];
      window.localStorage?.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore localStorage failures for client-side analytics.
    }
  }

  console.log(logPrefix, entry);
}

function getAnonymousVisitorId() {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage?.getItem(ANONYMOUS_VISITOR_ID_KEY);
    if (existing) return existing;

    const nextId =
      window.crypto?.randomUUID?.() ||
      `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage?.setItem(ANONYMOUS_VISITOR_ID_KEY, nextId);
    return nextId;
  } catch {
    return null;
  }
}

function debugLog(...args) {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
}

function debugWarn(...args) {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}

function hasRecoveryUrlState() {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hash);
  const authType = hashParams.get("type") || searchParams.get("type");

  return authType === "recovery";
}

function getAuthCallbackParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  return {
    searchParams,
    hashParams,
    type: hashParams.get("type") || searchParams.get("type"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    tokenHash: hashParams.get("token_hash") || searchParams.get("token_hash"),
    error: hashParams.get("error") || searchParams.get("error"),
    errorCode:
      hashParams.get("error_code") || searchParams.get("error_code"),
  };
}

function cleanAuthCallbackUrl() {
  const nextSearchParams = new URLSearchParams(window.location.search);
  [
    "mode",
    "token_hash",
    "type",
    "error",
    "error_code",
    "error_description",
  ].forEach((param) => nextSearchParams.delete(param));
  const nextSearch = nextSearchParams.toString();

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
  );
}

function clearStaleRecoveryState() {
  const { type: authType } = getAuthCallbackParams();

  if (authType === "recovery") {
    return;
  }

  try {
    localStorage.removeItem("microassist_recovery_flow");
    localStorage.removeItem("microassist_password_recovery");
    sessionStorage.removeItem("microassist_recovery_flow");
    sessionStorage.removeItem("microassist_password_recovery");
  } catch {
    // Ignore storage failures; URL state remains the source of truth.
  }

  const nextSearchParams = new URLSearchParams(window.location.search);
  if (nextSearchParams.get("mode") !== "recovery") {
    return;
  }

  nextSearchParams.delete("mode");
  const nextSearch = nextSearchParams.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${
      window.location.hash || ""
    }`,
  );
}

function getDeepLinkViewFromQuery() {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const requestedView = searchParams.get("view");

  if (
    requestedView === "pricing" ||
    requestedView === "dashboard" ||
    requestedView === "assistant"
  ) {
    return requestedView;
  }

  return null;
}

function getCurrentMonthlyExportStorageKey() {
  const now = new Date();
  return `microassist_exports_${now.getFullYear()}_${now.getMonth() + 1}`;
}

function readLocalPremiumStatus() {
  try {
    return localStorage.getItem(PREMIUM_STATUS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalPremiumStatus(isPremium) {
  try {
    localStorage.setItem(PREMIUM_STATUS_KEY, isPremium ? "1" : "0");
  } catch {
    // Ignore localStorage write failures for local premium fallback.
  }
}

function readFirstRevenueOnboardingSeen() {
  try {
    return localStorage.getItem(FIRST_REVENUE_ONBOARDING_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFirstRevenueOnboardingSeen(value) {
  try {
    localStorage.setItem(
      FIRST_REVENUE_ONBOARDING_SEEN_KEY,
      value ? "1" : "0",
    );
  } catch {
    // Ignore localStorage write failures for onboarding redirect state.
  }
}

function readBetaMicroFeedbackState() {
  try {
    const raw = localStorage.getItem(BETA_MICRO_FEEDBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") {
      return {
        answers: {},
        triggers: {},
      };
    }

    return {
      answers:
        parsed.answers && typeof parsed.answers === "object"
          ? parsed.answers
          : {},
      triggers:
        parsed.triggers && typeof parsed.triggers === "object"
          ? parsed.triggers
          : {},
    };
  } catch {
    return {
      answers: {},
      triggers: {},
    };
  }
}

function writeBetaMicroFeedbackState(nextState) {
  const normalized = {
    answers:
      nextState?.answers && typeof nextState.answers === "object"
        ? nextState.answers
        : {},
    triggers:
      nextState?.triggers && typeof nextState.triggers === "object"
        ? nextState.triggers
        : {},
  };

  try {
    localStorage.setItem(BETA_MICRO_FEEDBACK_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore localStorage failures for beta feedback prompts.
  }

  return normalized;
}

function readMonthlyExportUsage() {
  try {
    const saved = localStorage.getItem(getCurrentMonthlyExportStorageKey());

    if (!saved) {
      return { ...EMPTY_EXPORT_USAGE };
    }

    const parsed = JSON.parse(saved);
    return normalizeMonthlyExportUsage(parsed);
  } catch {
    try {
      const saved = localStorage.getItem(getCurrentMonthlyExportStorageKey());
      const legacyValue = saved ? Number(saved) : 0;
      return normalizeMonthlyExportUsage(legacyValue);
    } catch {
      return { ...EMPTY_EXPORT_USAGE };
    }
  }
}

function normalizeMonthlyExportUsage(rawValue) {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    const safeTotal = Math.max(0, rawValue);
    return {
      csv: 0,
      pdf: safeTotal,
      total: safeTotal,
    };
  }

  if (!rawValue || typeof rawValue !== "object") {
    return { ...EMPTY_EXPORT_USAGE };
  }

  const csv = Math.max(0, Number(rawValue.csv) || 0);
  const pdf = Math.max(0, Number(rawValue.pdf) || 0);
  const total = Math.max(0, Number(rawValue.total) || csv + pdf);

  return { csv, pdf, total };
}

function writeMonthlyExportUsage(rawValue) {
  try {
    const normalizedUsage = normalizeMonthlyExportUsage(rawValue);
    localStorage.setItem(
      getCurrentMonthlyExportStorageKey(),
      JSON.stringify(normalizedUsage)
    );
    return normalizedUsage;
  } catch {
    return normalizeMonthlyExportUsage(rawValue);
  }
}

function getTrialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) {
    return null;
  }

  const trialEndDate = new Date(trialEndsAt);

  if (Number.isNaN(trialEndDate.getTime())) {
    return null;
  }

  const diffMs = trialEndDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function isTrialExpired(trialEndsAt) {
  const daysLeft = getTrialDaysLeft(trialEndsAt);
  return daysLeft !== null && daysLeft <= 0;
}

function getRegistrationTrialWindow(user, founderSource = null) {
  const createdAt = user?.created_at;
  const isFounder =
    founderSource?.is_founder === true ||
    user?.app_metadata?.is_founder === true ||
    user?.user_metadata?.is_founder === true;
  const totalTrialDays = isFounder ? 90 : 14;

  if (!createdAt) {
    return {
      trialStartedAt: null,
      trialEndsAt: null,
    };
  }

  const registrationDate = new Date(createdAt);

  if (Number.isNaN(registrationDate.getTime())) {
    return {
      trialStartedAt: null,
      trialEndsAt: null,
    };
  }

  const trialEndDate = new Date(registrationDate);
  trialEndDate.setDate(trialEndDate.getDate() + totalTrialDays);

  return {
    trialStartedAt: registrationDate.toISOString(),
    trialEndsAt: trialEndDate.toISOString(),
  };
}

function isPaidSubscriptionStatus(status) {
  return ["active"].includes(String(status || "").toLowerCase());
}

function normalizeBillingPlanValue({
  rawPlan,
  hasPaidSubscription,
  isPremium,
  trialEndsAt,
}) {
  if (hasPaidSubscription) {
    return "premium";
  }

  if (trialEndsAt && !isTrialExpired(trialEndsAt)) {
    return "trial";
  }

  if (isPremium) {
    return "premium";
  }

  if (String(rawPlan || "").toLowerCase() === "trial") {
    return "trial";
  }

  return "free";
}

function getPremiumTrigger({
  revenuesCount,
  trialDaysLeft,
  daysBeforeDeadline,
  isPremium,
  lastActivityDays,
}) {
  if (isPremium) return null;

  if (trialDaysLeft !== null && trialDaysLeft <= 7 && trialDaysLeft > 0) {
    return "trial_ending";
  }

  if (daysBeforeDeadline !== null && daysBeforeDeadline <= 7) {
    return "deadline_soon";
  }

  if (revenuesCount >= 3) {
    return "engaged_user";
  }

  if (lastActivityDays >= 7) {
    return "inactive_user";
  }

  return null;
}

function getPremiumTriggerContext({
  computed,
  smartPriorities,
  trialDaysLeft,
  isEarlyAccessEndingToday = false,
  isPostEarlyAccessTrial = false,
}) {
  if (computed?.tvaStatus === "exceeded") {
    return {
      triggerType: "tva_exceeded",
      priorityLevel: "high",
      message:
        "Tu as dépassé le seuil TVA. Premium peut t’aider à anticiper la suite.",
    };
  }

  if (
    computed?.deadlineDate instanceof Date &&
    !Number.isNaN(computed.deadlineDate.getTime())
  ) {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const startOfDeadline = new Date(
      computed.deadlineDate.getFullYear(),
      computed.deadlineDate.getMonth(),
      computed.deadlineDate.getDate(),
    );
    const diffMs = startOfDeadline.getTime() - startOfToday.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 2) {
      return {
        triggerType: "declaration_urgent",
        priorityLevel: "high",
        message:
          "Ta déclaration approche. Premium te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      };
    }
  }

  if (Array.isArray(smartPriorities) && smartPriorities.length >= 2) {
    return {
      triggerType: "multiple_priorities",
      priorityLevel: "medium",
      message:
        "Plusieurs priorités ont été détectées. Premium te donne une vue plus complète et proactive.",
    };
  }

  if (isEarlyAccessEndingToday) {
    return {
      triggerType: "early_access_ending",
      priorityLevel: "medium",
      message:
        "Ton accès complet se termine aujourd’hui. Premium te permet de continuer avec toutes les alertes.",
    };
  }

  if (isPostEarlyAccessTrial) {
    return {
      triggerType: "post_early_access",
      priorityLevel: "medium",
      message: "Certaines fonctionnalités sont maintenant en Premium.",
    };
  }

  return null;
}

function shouldSendTrialEndingEmail(trialEndsAt) {
  return getTrialDaysLeft(trialEndsAt) === 7;
}

function shouldSendTrialEndingEmailJ2(trialEndsAt) {
  return getTrialDaysLeft(trialEndsAt) === 2;
}

function shouldSendTrialExpiredEmail(trialEndsAt) {
  return getTrialDaysLeft(trialEndsAt) <= 0;
}

function shouldSendDeclarationReminderJ2(deadlineDate) {
  if (!(deadlineDate instanceof Date) || Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfDeadline = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
  );

  const diffMs = startOfDeadline.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays === 2;
}

function shouldSendDeclarationReminderJ7(deadlineDate) {
  if (!(deadlineDate instanceof Date) || Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfDeadline = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
  );

  const diffMs = startOfDeadline.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= 7;
}

function formatDeclarationDeadlineLabel(deadlineDate) {
  if (!(deadlineDate instanceof Date) || Number.isNaN(deadlineDate.getTime())) {
    return "";
  }

  return deadlineDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Generic reminder event storage for trial_ending_j2, trial_expired,
// and future declaration reminder emails.
function getEmailEventStorageKey(eventType, userId) {
  return `${EMAIL_EVENT_KEY_PREFIX}${eventType}_${userId}`;
}

function wasEmailEventHandledRecently(
  eventType,
  userId,
  cooldownMs = 24 * 60 * 60 * 1000,
) {
  if (!eventType || !userId) return false;

  const storageKey = getEmailEventStorageKey(eventType, userId);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    return (
      parsed?.eventType === eventType &&
      typeof parsed?.at === "number" &&
      Date.now() - parsed.at < cooldownMs
    );
  } catch {
    return false;
  }
}

function markEmailEventHandled(eventType, userId, meta = {}) {
  if (!eventType || !userId) return;

  try {
    localStorage.setItem(
      getEmailEventStorageKey(eventType, userId),
      JSON.stringify({
        eventType,
        at: Date.now(),
        ...meta,
      }),
    );
  } catch {
    // ignore storage write issues
  }
}

// LOT 10.1G: buildTrialEndingEmailPayload / buildTrialEndingEmailPayloadJ2 /
// buildTrialExpiredEmailPayload removed. Their output was only ever used
// to populate the request body sent to send-trial-ending-email, which no
// longer trusts client-supplied subject/html/text -- the Edge Function
// now owns this exact copy server-side (see
// supabase/functions/send-trial-ending-email/trialEmailTemplates.js).

function buildDeclarationReminderEmailPayloadJ2({ email, deadlineDate }) {
  const declarationDateLabel = formatDeclarationDeadlineLabel(deadlineDate);

  return {
    subject: "⏰ Ta déclaration arrive dans 2 jours",
    text: [
      "Bonjour 👋",
      "",
      "Ta prochaine déclaration arrive dans 2 jours.",
      "",
      `Date limite : ${declarationDateLabel || "à confirmer"}`,
      "",
      "Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      "Tu peux retrouver ton espace fiscal ici :",
      "https://microassist.vercel.app/?view=dashboard",
      "",
      "À bientôt,",
      "Microassist",
    ].join("\n"),
    html: `
      <h2>Ta déclaration arrive dans 2 jours</h2>
      <p>Ta prochaine déclaration arrive dans <strong>2 jours</strong>.</p>
      <p><strong>Date limite :</strong> ${declarationDateLabel || "à confirmer"}</p>
      <p>Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      <p><a href="https://microassist.vercel.app/?view=dashboard" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Vérifier ma situation</a></p>
      <p>À bientôt,<br/>Microassist</p>
    `,
    email,
    deadlineDate,
  };
}

function buildDeclarationReminderEmailPayloadJ7({ email, deadlineDate }) {
  const declarationDateLabel = formatDeclarationDeadlineLabel(deadlineDate);

  return {
    subject: "📅 Ta déclaration arrive dans 7 jours",
    text: [
      "Bonjour 👋",
      "",
      "Ta prochaine déclaration arrive dans 7 jours.",
      "",
      `Date limite : ${declarationDateLabel || "à confirmer"}`,
      "",
      "Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      "Tu peux retrouver ton espace fiscal ici :",
      "https://microassist.vercel.app/?view=dashboard",
      "",
      "À bientôt,",
      "Microassist",
    ].join("\n"),
    html: `
      <h2>Ta déclaration arrive dans 7 jours</h2>
      <p>Ta prochaine déclaration arrive dans <strong>7 jours</strong>.</p>
      <p><strong>Date limite :</strong> ${declarationDateLabel || "à confirmer"}</p>
      <p>Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      <p><a href="https://microassist.vercel.app/?view=dashboard" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Vérifier ma situation</a></p>
      <p>À bientôt,<br/>Microassist</p>
    `,
    email,
    deadlineDate,
  };
}

function getTopHighSmartPriority(smartPriorities) {
  if (!Array.isArray(smartPriorities)) return null;
  return smartPriorities.find((item) => item?.level === "high") || null;
}

function buildSmartPriorityEmailPayload({ email, priority }) {
  return {
    subject: "🚨 Priorité importante dans ton espace Microassist",
    text: [
      "Bonjour 👋",
      "",
      "Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      "Voici la priorité détectée dans ton espace fiscal :",
      "",
      priority?.title || "",
      priority?.message || "",
      "",
      "Ouvre ton espace fiscal pour agir rapidement :",
      "https://microassist.vercel.app/?view=dashboard",
      "",
      "À bientôt,",
      "Microassist",
    ].join("\n"),
    html: `
      <h2>Priorité importante dans ton espace Microassist</h2>
      <p>Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      <p>Voici la priorité détectée dans ton espace fiscal.</p>
      <p><strong>${priority?.title || ""}</strong></p>
      <p>${priority?.message || ""}</p>
      <p><a href="https://microassist.vercel.app/?view=dashboard" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Vérifier ma situation</a></p>
      <p>À bientôt,<br/>Microassist</p>
    `,
    email,
    priority,
  };
}

function normalizePremiumTrackingSource(source = "unknown") {
  return normalizePremiumTriggerType(source);
}

function normalizePremiumConversionSource(source = "unknown") {
  const normalized = String(source || "unknown").toLowerCase();

  if (normalized.includes("score")) return "score";
  if (normalized.includes("reminder") || normalized.includes("sms")) {
    return "reminders";
  }

  return normalizePremiumTriggerType(source);
}

function getOfferTypeFromTriggerType(triggerType = "unknown") {
  return normalizePremiumTriggerType(triggerType) === "future_advanced_features"
    ? "future_advanced"
    : "current_premium";
}

function normalizePremiumTriggerType(source = "unknown") {
  const normalized = String(source || "unknown").toLowerCase();

  if (
    normalized === "future_advanced_features" ||
    normalized.includes("sms_premium") ||
    normalized.includes("sms_future")
  ) {
    return "future_advanced_features";
  }

  if (
    normalized === "tva_exceeded" ||
    normalized.includes("premium_tva_context")
  ) {
    return normalized === "tva_exceeded" ? "tva_exceeded" : "tva_context";
  }

  if (normalized === "declaration_urgent") {
    return "declaration_urgent";
  }

  if (
    normalized === "multiple_priorities" ||
    normalized.includes("smart_priorities_lock")
  ) {
    return normalized.includes("smart_priorities_lock")
      ? "smart_priorities_lock"
      : "multiple_priorities";
  }

  if (
    normalized === "early_access_ending" ||
    normalized.includes("early_access_end")
  ) {
    return "early_access_ending";
  }

  if (
    normalized === "post_early_access" ||
    normalized.includes("premium_after_trial") ||
    normalized.includes("dashboard_next_step_trial") ||
    normalized.includes("dashboard_recommendation_premium")
  ) {
    return "post_early_access";
  }

  if (normalized.includes("exports_limit") || normalized.includes("export")) {
    return "exports_limit";
  }

  if (normalized.includes("premium_history_context")) {
    return "history_context";
  }

  if (normalized.includes("premium_acre_context") || normalized.includes("acre")) {
    return "acre_context";
  }

  if (
    normalized.includes("premium_unpaid_context") ||
    normalized.includes("invoice") ||
    normalized.includes("unpaid")
  ) {
    return "unpaid_context";
  }

  if (normalized.includes("dashboard_top")) {
    return "dashboard_banner";
  }

  if (normalized.includes("pricing_page")) {
    return "pricing_page";
  }

  return "default";
}

function trackPremiumEvent(source = "unknown", action = "modal_open") {
  const entry = {
    source: normalizePremiumConversionSource(source),
    action,
    timestamp: new Date().toISOString(),
  };

  appendAnalyticsEntry({
    entry,
    storageKey: "premium_conversion_events",
    logPrefix: "[microassist:premium]",
  });
}

// Temporary beta tracking. Later this can be connected to Supabase or analytics.
function trackEvent(eventName, payload = {}) {
  const entry = {
    eventName,
    anonymousVisitorId: getAnonymousVisitorId(),
    timestamp: new Date().toISOString(),
    appView: null,
    userId: null,
    ...payload,
  };

  appendAnalyticsEntry({
    entry,
    storageKey: "microassist_analytics_events",
    logPrefix: `[microassist:event] ${eventName}`,
    globalLogKey: "__microassistEventLog",
  });
}

function normalizeDateValue(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return raw;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const normalized = normalizeDateValue(value);

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getFiscalDateErrors(sourceAnswers = {}) {
  const businessStartDate = normalizeDateValue(sourceAnswers.business_start_date);
  const acreStartDate = normalizeDateValue(sourceAnswers.acre_start_date);
  const businessDate = parseIsoDate(businessStartDate);
  const acreDate = parseIsoDate(acreStartDate);
  const today = parseIsoDate(getTodayIsoDate());
  const minRealisticDate = parseIsoDate(MIN_REALISTIC_FISCAL_DATE);
  const errors = {};

  if (businessStartDate) {
    if (!businessDate || businessDate < minRealisticDate) {
      errors.business_start_date = "Merci de saisir une date réaliste.";
    } else if (businessDate > today) {
      errors.business_start_date =
        "La date de début d’activité ne peut pas être dans le futur.";
    }
  }

  if (sourceAnswers.acre === "yes" && !acreStartDate) {
    errors.acre_start_date = "Merci d’indiquer la date de début de l’ACRE.";
  } else if (acreStartDate) {
    if (!acreDate || acreDate < minRealisticDate) {
      errors.acre_start_date = "Merci de saisir une date réaliste.";
    } else if (acreDate > today) {
      errors.acre_start_date = "La date ACRE ne peut pas être dans le futur.";
    } else if (businessDate && !errors.business_start_date && acreDate < businessDate) {
      errors.acre_start_date =
        "La date ACRE doit être postérieure ou égale au début d’activité.";
    }
  }

  if (
    !errors.acre_start_date &&
    acreDate &&
    businessDate &&
    !errors.business_start_date &&
    acreDate < businessDate
  ) {
    errors.acre_start_date =
      "La date ACRE doit être postérieure ou égale au début d’activité.";
  }

  return errors;
}

function buildSmartAlerts({
  computed = {},
  revenues = [],
  invoices = [],
  reminderPrefs = {},
  estimatedCharges = 0,
  currentMonthTotal = 0,
} = {}) {
  const today = parseIsoDate(getTodayIsoDate());
  const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);

  if (computed?.tvaStatus === "exceeded") {
    return [
      {
      id: "tva-threshold",
      level: "warning",
      title: "TVA à activer ce mois",
      text: "Prépare ta facturation et ta déclaration.",
      cta: "Comprendre la TVA",
      action: "tva_info",
      },
    ];
  }

  if (computed?.acreStatus === "active" && computed?.acreEndDate) {
    // LOT 10.1D: derives from the canonical, reform-aware acreEndDate
    // (computeObligations) instead of independently recomputing a flat
    // +12-month guess from acre_start_date.
    const daysLeft = Math.ceil(
      (computed.acreEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));

    if (daysLeft > 0 && monthsLeft <= 2) {
      return [
        {
        id: "acre-ending",
        level: "warning",
        title: "Fin ACRE bientôt",
        text: "Anticipe la hausse de cotisations liée à la fin de l’ACRE.",
        cta: "Modifier mon profil",
        action: "profile",
        },
      ];
    }
  }

  if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
    return [
      {
        id: "reserve-low",
        level: "warning",
        title: "Réserve à renforcer",
        text: "La réserve actuelle couvre moins d’un cycle de charges estimées.",
        cta: "Ajouter une dépense",
        action: "profile",
      },
    ];
  }

  if (revenues.length <= 2) {
    return [
      {
        id: "early-tracking",
        level: "success",
        title: "Suivi en démarrage",
        text: "Ton suivi commence bien. Continue à ajouter tes revenus pour fiabiliser les repères.",
        cta: "Ajouter un revenu",
        action: "add_revenue",
      },
    ];
  }

  return [
    {
      id: "all-clear",
      level: "success",
      title: "Aucun signal critique",
      text: "Ton espace fiscal est à jour. Continue à alimenter ton suivi pour garder des repères fiables.",
      cta: "Ajouter un revenu",
      action: "add_revenue",
    },
  ];
}

function buildSmartPriorities(computed) {
  const priorities = [];

  if (!computed) return priorities;

  if (computed.deadlineDate instanceof Date && !Number.isNaN(computed.deadlineDate.getTime())) {
    const today = new Date();
    const diffMs = computed.deadlineDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 2) {
      priorities.push({
        level: "high",
        title: "Déclaration urgente",
        message: `Tu dois déclarer avant le ${computed.deadlineLabel}`,
        action: "Déclarer maintenant",
        actionKey: "deadline",
      });
    }
  }

  if (computed.tvaStatus === "exceeded") {
    priorities.push({
      level: "high",
      title: "TVA dépassée",
      message:
        "⚠ Action urgente — Tu as dépassé le seuil TVA. Vérifie maintenant les prochaines étapes pour éviter une mauvaise surprise.",
      action: "Vérifier maintenant",
      actionKey: "tva",
    });
  }

  if (computed.tvaStatus === "soon") {
    priorities.push({
      level: "medium",
      title: "TVA proche du seuil",
      message: "Tu approches du seuil TVA.",
      action: "Anticiper",
      actionKey: "tva",
    });
  }

  if (computed.recommendedReserve && computed.estimatedAmount) {
    if (computed.recommendedReserve < computed.estimatedAmount * 0.5) {
      priorities.push({
        level: "medium",
        title: "Réserve insuffisante",
        message: "Tu n’as pas assez mis de côté.",
        action: "Ajuster",
        actionKey: "profile",
      });
    }
  }

  if (computed.nextDeclarationLabel) {
    priorities.push({
      level: "low",
      title: "Prochaine déclaration",
      message: computed.nextDeclarationLabel,
      action: null,
      actionKey: null,
    });
  }

  return priorities;
}

function getEstimatedRate(activityType) {
  const normalizedActivityType = normalizeActivityType(activityType);
  if (isMixedActivityValue(normalizedActivityType)) {
    return 0.18;
  }

  switch (normalizedActivityType) {
    case "commerce":
      return 0.123;
    case "services":
      return 0.22;
    default:
      return 0.22;
  }
}

function isMixedActivityValue(activityType = "") {
  const normalized = String(activityType || "").trim().toLowerCase();
  return normalized === "mixte" || normalized === "mix" || normalized === "mixed";
}

function normalizeActivityTypeForCalculations(activityType = "") {
  return normalizeActivityType(activityType);
}

function getRevenueContributionRate(revenue, activityType, fallbackRate = null) {
  const baseFallbackRate = getEstimatedRate(activityType);
  const adjustmentFactor =
    typeof fallbackRate === "number" && baseFallbackRate > 0
      ? fallbackRate / baseFallbackRate
      : 1;
  const revenueCategory = String(revenue?.revenue_category || "").toLowerCase();

  if (revenueCategory === "vente") {
    return 0.123 * adjustmentFactor;
  }

  if (revenueCategory === "service") {
    return 0.22 * adjustmentFactor;
  }

  return baseFallbackRate * adjustmentFactor;
}

function getRevenueCategoryLabel(revenueCategory = "") {
  if (revenueCategory === "vente") return "Commerce (BIC)";
  if (revenueCategory === "service") return "Service (BNC / prestations)";
  return "";
}

function sanitizeFiscalAnswers(sourceAnswers = {}) {
  const nextAnswers = { ...sourceAnswers };
  if (
    sourceAnswers.activity_type !== undefined &&
    sourceAnswers.activity_type !== null &&
    sourceAnswers.activity_type !== ""
  ) {
    nextAnswers.activity_type = normalizeActivityType(sourceAnswers.activity_type);
  }
  const normalizedBusinessStartDate = normalizeDateValue(
    sourceAnswers.business_start_date,
  );
  const normalizedAcreStartDate = normalizeDateValue(sourceAnswers.acre_start_date);
  const errors = getFiscalDateErrors({
    ...sourceAnswers,
    business_start_date: normalizedBusinessStartDate,
    acre_start_date: normalizedAcreStartDate,
  });

  nextAnswers.business_start_date = errors.business_start_date
    ? null
    : normalizedBusinessStartDate || null;

  if (sourceAnswers.acre !== "yes") {
    nextAnswers.acre_start_date = null;
  } else {
    nextAnswers.acre_start_date = errors.acre_start_date
      ? null
      : normalizedAcreStartDate || null;
  }

  return nextAnswers;
}

function getCurrentStepValidationMessage(stepKey, sourceAnswers = {}) {
  const errors = getFiscalDateErrors(sourceAnswers);

  if (stepKey === "business_start_date") {
    return errors.business_start_date || errors.acre_start_date || "";
  }

  if (stepKey === "acre_start_date") {
    return errors.acre_start_date || "";
  }

  return "";
}

function buildFiscalSummary(answers = {}, computed = {}) {
  const lines = [];

  lines.push("✅ Résumé fiscal");
  lines.push(
    `• Situation : ${labelFromOptions("entry_status", answers.entry_status)}`,
  );
  lines.push(`• Statut : ${labelFromOptions("status", answers.status)}`);
  lines.push(
    `• Activité : ${labelFromOptions("activity_type", answers.activity_type)}`,
  );
  lines.push(
    `• Déclarations : ${labelFromOptions(
      "declaration_frequency",
      answers.declaration_frequency,
    )}`,
  );

  lines.push("");
  lines.push("📌 Synthèse");
  lines.push(
    `• Prochaine déclaration : ${computed.nextDeclarationLabel ?? "Pas encore assez de données"}`,
  );
  lines.push(`• Montant estimé : ${computed.amountEstimatedLabel ?? "Pas encore assez de données"}`);
  lines.push(`• Date limite : ${computed.deadlineLabel ?? "Pas encore assez de données"}`);
  lines.push(`• TVA : ${computed.tvaStatusLabel ?? "À confirmer"}`);

  if (computed.tvaHint) {
    lines.push(`• Détail TVA : ${computed.tvaHint}`);
  }

  lines.push("");
  lines.push("⚠️ Indication simplifiée. Ne remplace pas un expert-comptable.");

  return lines.join("\n");
}

function buildFiscalChecklist(computed = {}) {
  const items = [];

  items.push("🧭 Plan d’action");

  if (typeof computed?.treasuryRecommended === "number") {
    items.push(
      `• À garder de côté : ${computed.treasuryRecommended.toLocaleString("fr-FR")} € minimum.`,
    );
  }

  if (computed?.urgency === "late") {
    items.push("• Déclarer dès que possible sur autoentrepreneur.urssaf.fr.");
  } else if (computed?.urgency === "soon") {
    items.push("• Prévoir un moment pour déclarer prochainement.");
  } else {
    items.push(
      "• Continuer à enregistrer le chiffre d’affaires régulièrement.",
    );
  }

  if (computed?.tvaStatus === "exceeded") {
    items.push("• Vérifier le régime TVA et anticiper la facturation.");
  } else if (computed?.tvaStatus === "soon") {
    items.push("• Surveiller le seuil TVA.");
  } else {
    items.push("• TVA : Franchise TVA OK.");
  }

  if (computed?.recommendations?.length) {
    items.push("");
    items.push("✅ Recommandations");
    computed.recommendations.forEach((r) => {
      items.push(`• ${r.title} — ${r.text}`);
    });
  }

  return items.join("\n");
}

function buildInitialAssistantMessages(userName = "") {
  return [
    {
      role: "bot",
      text: userName
        ? `Bonjour, ${userName} 👋 On va construire ton projet en 5 étapes. Réponds simplement.`
        : "Bonjour 👋 On va configurer ton profil fiscal. Réponds simplement.",
    },
    {
      role: "bot",
      text: `Étape 1 — ${FISCAL_STEPS[0].title}\n${FISCAL_STEPS[0].question}`,
    },
  ];
}

function getAssistantAnswersFromProfile(profile) {
  if (!profile) return {};

  return sanitizeFiscalAnswers({
    entry_status:
      profile.business_status === "micro_entreprise" ? "micro_yes" : "micro_no",
    status:
      profile.business_status === "micro_entreprise"
        ? "auto_entrepreneur"
        : null,
    activity_type: profile.activity_type
      ? normalizeActivityType(profile.activity_type)
      : null,
    declaration_frequency: profile.declaration_frequency || null,
    acre: profile.acre || null,
    acre_start_date: profile.acre_start_date || null,
    business_start_date: profile.business_start_date || null,
  });
}

function getActivityRole(activityType) {
  if (!activityType) return "default";
  switch (normalizeActivityType(activityType)) {
    case "services":
      return "service";
    case "commerce":
      return "commerce";
    case "mixte":
      return "mixte";
    default:
      return "default";
  }
}

function readLocalDraftPayload() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readLocalDraftAnswers() {
  const payload = readLocalDraftPayload();
  return payload?.answers && typeof payload.answers === "object"
    ? sanitizeFiscalAnswers(payload.answers)
    : null;
}

function pickProfileField(source, aliases) {
  if (!source || typeof source !== "object") return null;

  for (const key of aliases) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function normalizeProfileConflictValue(value, type = "string") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (type === "date") {
    return normalizeDateValue(value) || null;
  }

  if (type === "booleanish") {
    if (value === true || value === "true" || value === "yes") return "yes";
    if (value === false || value === "false" || value === "no") return "no";
  }

  return String(value).trim().toLowerCase();
}

function buildProfileConflictSnapshot(source) {
  const activityValue = pickProfileField(source, [
    "activity",
    "activityType",
    "activity_type",
  ]);

  return {
    activity: activityValue ? normalizeActivityType(activityValue) : null,
    declarationFrequency: normalizeProfileConflictValue(
      pickProfileField(source, [
        "declarationFrequency",
        "declaration_period",
        "declaration_frequency",
      ]),
    ),
    acre: normalizeProfileConflictValue(
      pickProfileField(source, ["acre", "hasAcre"]),
      "booleanish",
    ),
    businessStartDate: normalizeProfileConflictValue(
      pickProfileField(source, [
        "businessStartDate",
        "startDate",
        "business_start_date",
      ]),
      "date",
    ),
  };
}

function hasFiscalProfileConflict(localAnswers, remoteProfile) {
  const localSnapshot = buildProfileConflictSnapshot(localAnswers);
  const remoteSnapshot = buildProfileConflictSnapshot(remoteProfile);

  return (
    localSnapshot.activity !== remoteSnapshot.activity ||
    localSnapshot.declarationFrequency !== remoteSnapshot.declarationFrequency ||
    localSnapshot.acre !== remoteSnapshot.acre ||
    localSnapshot.businessStartDate !== remoteSnapshot.businessStartDate
  );
}

function haveStructuredFiscalFieldsChanged(previousAnswers = {}, nextAnswers = {}) {
  return (
    (previousAnswers.activity_type
      ? normalizeActivityType(previousAnswers.activity_type)
      : null) !==
      (nextAnswers.activity_type
        ? normalizeActivityType(nextAnswers.activity_type)
        : null) ||
    normalizeProfileConflictValue(previousAnswers.declaration_frequency) !==
      normalizeProfileConflictValue(nextAnswers.declaration_frequency) ||
    normalizeProfileConflictValue(previousAnswers.acre, "booleanish") !==
      normalizeProfileConflictValue(nextAnswers.acre, "booleanish") ||
    normalizeProfileConflictValue(previousAnswers.business_start_date, "date") !==
      normalizeProfileConflictValue(nextAnswers.business_start_date, "date")
  );
}

function readProfileConflictStrategy() {
  try {
    return localStorage.getItem(PROFILE_CONFLICT_STRATEGY_KEY) || null;
  } catch {
    return null;
  }
}

function writeProfileConflictStrategy(strategy) {
  try {
    if (!strategy) {
      localStorage.removeItem(PROFILE_CONFLICT_STRATEGY_KEY);
      return null;
    }

    localStorage.setItem(PROFILE_CONFLICT_STRATEGY_KEY, strategy);
    return strategy;
  } catch {
    return strategy || null;
  }
}

function buildFiscalProfilePayload(userId, normalizedProfileAnswers) {
  return {
    user_id: userId,
    business_status:
      normalizedProfileAnswers.entry_status === "micro_yes"
        ? "micro_entreprise"
        : "other",
    activity_type: normalizedProfileAnswers.activity_type
      ? normalizeActivityType(normalizedProfileAnswers.activity_type)
      : null,
    declaration_frequency:
      normalizedProfileAnswers.declaration_frequency || null,
    tva_mode: "franchise_en_base",
    acre: normalizedProfileAnswers.acre || null,
    acre_start_date: normalizedProfileAnswers.acre_start_date || null,
    business_start_date: normalizedProfileAnswers.business_start_date || null,
  };
}

function isSameFiscalProfilePayload(payload, currentProfile) {
  if (!payload || !currentProfile) return false;

  return (
    payload.user_id === currentProfile.user_id &&
    payload.business_status === (currentProfile.business_status || null) &&
    payload.activity_type ===
      (currentProfile.activity_type
        ? normalizeActivityType(currentProfile.activity_type)
        : null) &&
    payload.declaration_frequency ===
      (currentProfile.declaration_frequency || null) &&
    payload.tva_mode === (currentProfile.tva_mode || null) &&
    payload.acre === (currentProfile.acre || null) &&
    payload.acre_start_date === (currentProfile.acre_start_date || null) &&
    payload.business_start_date ===
      (currentProfile.business_start_date || null)
  );
}

function buildProfilePayload(user, currentProfile = {}, overrides = {}) {
  const fallbackDisplayName =
    user?.user_metadata?.first_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split("@")?.[0]?.trim() ||
    null;
  const registrationTrialWindow = getRegistrationTrialWindow(user, currentProfile);

  return {
    id: user?.id || currentProfile?.id || currentProfile?.user_id || null,
    email: overrides.email ?? currentProfile?.email ?? user?.email ?? null,
    full_name:
      overrides.full_name ??
      currentProfile?.full_name ??
      currentProfile?.display_name ??
      fallbackDisplayName,
    plan: overrides.plan ?? currentProfile?.plan ?? "free",
    subscription_status:
      overrides.subscription_status ??
      currentProfile?.subscription_status ??
      null,
    is_premium:
      overrides.is_premium ?? currentProfile?.is_premium ?? false,
    trial_started_at:
      overrides.trial_started_at ??
      currentProfile?.trial_started_at ??
      registrationTrialWindow.trialStartedAt,
    trial_ends_at:
      overrides.trial_ends_at ??
      currentProfile?.trial_ends_at ??
      registrationTrialWindow.trialEndsAt,
    stripe_customer_id:
      overrides.stripe_customer_id ??
      currentProfile?.stripe_customer_id ??
      null,
    locale:
      overrides.locale ??
      currentProfile?.locale ??
      user?.user_metadata?.locale ??
      null,
    onboarding_completed:
      overrides.onboarding_completed ??
      currentProfile?.onboarding_completed ??
      false,
    billing_identity:
      overrides.billing_identity ??
      currentProfile?.billing_identity ??
      null,
  };
}

function normalizeBillingIdentity(source = {}) {
  return {
    siret: String(source?.siret || "").trim(),
    legal_name: String(source?.legal_name || "").trim(),
    address: String(source?.address || "").trim(),
  };
}

function buildSubscriptionPayload(userId, currentSubscription = {}, overrides = {}) {
  return {
    user_id: userId || currentSubscription?.user_id || null,
    provider: overrides.provider ?? currentSubscription?.provider ?? "stripe",
    stripe_customer_id:
      overrides.stripe_customer_id ??
      currentSubscription?.stripe_customer_id ??
      null,
    stripe_subscription_id:
      overrides.stripe_subscription_id ??
      currentSubscription?.stripe_subscription_id ??
      null,
    stripe_price_id:
      overrides.stripe_price_id ?? currentSubscription?.stripe_price_id ?? null,
    status: overrides.status ?? currentSubscription?.status ?? null,
    current_period_start:
      overrides.current_period_start ??
      currentSubscription?.current_period_start ??
      null,
    current_period_end:
      overrides.current_period_end ??
      currentSubscription?.current_period_end ??
      null,
    cancel_at_period_end:
      overrides.cancel_at_period_end ??
      currentSubscription?.cancel_at_period_end ??
      false,
    trial_started_at:
      overrides.trial_started_at ??
      currentSubscription?.trial_started_at ??
      null,
    trial_ends_at:
      overrides.trial_ends_at ?? currentSubscription?.trial_ends_at ?? null,
  };
}

function buildSubscriptionLikeState({
  user,
  userProfile,
  subscriptionRecord,
  localPremiumStatus,
}) {
  const metadataSubscription =
    user?.app_metadata?.subscription ||
    user?.user_metadata?.subscription ||
    null;

  const metadataPlan =
    metadataSubscription?.plan ||
    user?.app_metadata?.plan ||
    user?.user_metadata?.plan ||
    null;
  const metadataIsPremium =
    typeof metadataSubscription?.is_premium === "boolean"
      ? metadataSubscription.is_premium
      : typeof user?.app_metadata?.is_premium === "boolean"
        ? user.app_metadata.is_premium
        : typeof user?.user_metadata?.is_premium === "boolean"
          ? user.user_metadata.is_premium
          : null;
  const metadataTrialStartedAt =
    metadataSubscription?.trial_started_at ||
    user?.app_metadata?.trial_started_at ||
    user?.user_metadata?.trial_started_at ||
    null;
  const metadataTrialEndsAt =
    metadataSubscription?.trial_ends_at ||
    user?.app_metadata?.trial_ends_at ||
    user?.user_metadata?.trial_ends_at ||
    null;
  const metadataSubscriptionStatus =
    metadataSubscription?.subscription_status ||
    user?.app_metadata?.subscription_status ||
    user?.user_metadata?.subscription_status ||
    null;
  const registrationTrialWindow = getRegistrationTrialWindow(user, userProfile);
  const subscriptionStatus =
    subscriptionRecord?.status ||
    userProfile?.subscription_status ||
    metadataSubscriptionStatus ||
    null;
  const hasPaidSubscription = isPaidSubscriptionStatus(subscriptionStatus);
  const trialStartedAt =
    subscriptionRecord?.trial_started_at ||
    userProfile?.trial_started_at ||
    metadataTrialStartedAt ||
    registrationTrialWindow.trialStartedAt;
  const trialEndsAt =
    subscriptionRecord?.trial_ends_at ||
    userProfile?.trial_ends_at ||
    metadataTrialEndsAt ||
    registrationTrialWindow.trialEndsAt;
  const profileIsPremium =
    typeof userProfile?.is_premium === "boolean"
      ? userProfile.is_premium
      : null;
  const fallbackIsPremium =
    profileIsPremium ?? metadataIsPremium ?? Boolean(localPremiumStatus);
  const isPremium = hasPaidSubscription || fallbackIsPremium;
  const rawPlan =
    subscriptionRecord?.plan ||
    userProfile?.plan ||
    metadataPlan ||
    null;

  return {
    plan: normalizeBillingPlanValue({
      rawPlan,
      hasPaidSubscription,
      isPremium,
      trialEndsAt,
    }),
    isPremium,
    trialStartedAt,
    trialEndsAt,
    subscriptionStatus,
    hasPaidSubscription,
  };
}

function isStepAvailable(stepConfig, sourceAnswers) {
  if (!stepConfig?.condition) {
    return true;
  }

  try {
    return stepConfig.condition(sourceAnswers);
  } catch {
    return true;
  }
}

const LEGAL_PAGES = {
  "/legal/privacy": {
    title: "Politique de confidentialité",
    intro:
      "Cette page présente les principes de protection des données appliqués pendant la phase de test de Microassist.",
    sections: [
      {
        title: "Données collectées",
        text: "Microassist limite la collecte aux informations utiles au fonctionnement de l’assistant fiscal : profil d’activité, revenus saisis, factures créées, rappels et informations de compte lorsque l’utilisateur choisit d’en créer un.",
      },
      {
        title: "Finalité",
        text: "Les données servent à afficher un suivi fiscal, conserver l’historique de l’utilisateur, générer des factures et préparer des rappels liés aux obligations de micro-entrepreneur.",
      },
      {
        title: "Droits",
        text: "Toute personne peut demander l’accès, la correction ou la suppression de ses données en écrivant à contact@microassist.fr.",
      },
    ],
  },
  "/legal/terms": {
    title: "Conditions d’utilisation",
    intro:
      "Microassist est un prototype SaaS en test destiné à aider les micro-entrepreneurs à mieux suivre leurs obligations.",
    sections: [
      {
        title: "Nature du service",
        text: "L’outil fournit des estimations, repères et rappels. Il ne remplace pas les sites officiels, un expert-comptable, un avocat ou l’administration fiscale.",
      },
      {
        title: "Responsabilité",
        text: "L’utilisateur reste responsable de ses déclarations, paiements, factures et vérifications auprès des organismes officiels.",
      },
      {
        title: "Phase de test",
        text: "Le service peut évoluer, être limité ou modifié pendant la période de prototype. Aucun paiement n’est demandé pendant cette phase.",
      },
    ],
  },
  "/legal/cookies": {
    title: "Gestion des cookies",
    intro:
      "Microassist utilise uniquement les stockages nécessaires au bon fonctionnement du prototype.",
    sections: [
      {
        title: "Stockage local",
        text: "Certaines informations peuvent être conservées dans le navigateur pour sauvegarder la progression, les revenus invités, les préférences d’affichage ou l’état des rappels.",
      },
      {
        title: "Cookies essentiels",
        text: "Les cookies ou jetons techniques liés à l’authentification peuvent être utilisés lorsque l’utilisateur crée un compte.",
      },
      {
        title: "Choix utilisateur",
        text: "L’utilisateur peut effacer les données locales depuis son navigateur ou demander la suppression des données associées à son compte.",
      },
    ],
  },
  "/legal/mentions": {
    title: "Mentions légales",
    intro:
      "Informations relatives à l’éditeur du prototype Microassist.",
    sections: [
      {
        title: "Éditeur",
        text: "Olena Mykhalska / Digital Lab, Belfort, France. Email : contact@microassist.fr. SIREN : 105 759 286. SIRET : 105 759 286 00013. Statut : entrepreneur individuel.",
      },
      {
        title: "Hébergement",
        text: "Le service est hébergé avec Supabase et Vercel.",
      },
      {
        title: "Prototype",
        text: "Microassist est actuellement un prototype SaaS en test, développé à Belfort pour accompagner les micro-entrepreneurs.",
      },
    ],
  },
  "/legal/accessibility": {
    title: "Accessibilité",
    intro:
      "Microassist vise une interface claire, lisible et utilisable sur ordinateur comme sur mobile.",
    sections: [
      {
        title: "Engagement",
        text: "Les pages sont conçues avec des contrastes lisibles, une structure simple et des contrôles accessibles au clavier lorsque cela est possible.",
      },
      {
        title: "Amélioration continue",
        text: "Le prototype évolue encore. Les retours d’accessibilité peuvent être envoyés à contact@microassist.fr.",
      },
      {
        title: "Limites connues",
        text: "Certaines zones anciennes de l’interface peuvent encore nécessiter des améliorations de structure ou de libellés.",
      },
    ],
  },
  "/legal/security": {
    title: "Sécurité des données",
    intro:
      "Microassist applique une approche prudente : minimiser les données, sécuriser les accès et permettre la suppression sur demande.",
    sections: [
      {
        title: "Accès sécurisé",
        text: "Les comptes et données synchronisées reposent sur l’infrastructure Supabase. L’accès aux données utilisateur est limité au strict besoin de fonctionnement et de support.",
      },
      {
        title: "Minimisation",
        text: "Microassist demande uniquement les informations nécessaires au suivi fiscal, aux factures, aux rappels et à l’amélioration du prototype.",
      },
      {
        title: "Suppression",
        text: "Une demande de suppression peut être adressée à contact@microassist.fr. Les données locales peuvent aussi être effacées depuis le navigateur.",
      },
    ],
  },
};

function MicroassistFooter({
  onGoToAssistant,
  onGoToDashboard,
  onGoToInvoices,
  onGoToPricing,
  onGoToReminders,
  onGoToHelp,
}) {
  const productLinks = [
    { label: "Assistant fiscal", onClick: onGoToAssistant, href: "/?view=assistant" },
    { label: "Mon espace fiscal", onClick: onGoToDashboard, href: "/?view=dashboard" },
    { label: "Factures", onClick: onGoToInvoices, href: "/?view=dashboard#invoices-section" },
    { label: "Tarifs", onClick: onGoToPricing, href: "/?view=pricing" },
    { label: "Rappels", onClick: onGoToReminders, href: "/?view=dashboard#reminders-section" },
    { label: "Aide", onClick: onGoToHelp, href: "/#services" },
  ];
  const legalLinks = [
    ["Politique de confidentialité", "/legal/privacy"],
    ["Conditions d’utilisation", "/legal/terms"],
    ["Gestion des cookies", "/legal/cookies"],
    ["Mentions légales", "/legal/mentions"],
    ["Accessibilité", "/legal/accessibility"],
    ["Sécurité des données", "/legal/security"],
    ["Contact RGPD", "mailto:contact@microassist.fr?subject=Contact%20RGPD"],
  ];

  const handleInternalFooterClick = (event, action) => {
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterGrid">
          <section className="siteFooterColumn siteFooterBrand">
            <h2>Microassist</h2>
            <p>
              Assistant fiscal simple pour micro-entrepreneurs. Charges, TVA,
              factures, rappels et suivi fiscal au même endroit.
            </p>
            <div className="siteFooterBadges" aria-label="Garanties du prototype">
              <span>✓ Prototype en test</span>
              <span>✓ Aucun paiement demandé</span>
              <span>✓ Données protégées</span>
            </div>
            <div className="siteFooterMeta">Version bêta • Belfort • France</div>
          </section>

          <section className="siteFooterColumn">
            <h3>Produit</h3>
            <nav aria-label="Liens produit">
              {productLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(event) => handleInternalFooterClick(event, link.onClick)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </section>

          <section className="siteFooterColumn siteFooterTrust">
            <h3>Confiance & RGPD</h3>
            <nav aria-label="Liens confiance et RGPD">
              {legalLinks.map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </nav>
            <p>
              Microassist respecte les principes RGPD : minimisation des données,
              accès sécurisé, suppression sur demande.
            </p>
          </section>

          <section className="siteFooterColumn siteFooterEditor">
            <h3>Éditeur</h3>
            <address>
              <strong>Olena Mykhalska / Digital Lab</strong>
              <span>Belfort, France</span>
              <a href="mailto:contact@microassist.fr">contact@microassist.fr</a>
              <span>SIRET : 105 759 286 00013</span>
              <span>Statut : entrepreneur individuel</span>
              <span>Hébergement : Supabase + Vercel</span>
            </address>
          </section>
        </div>

        <div className="siteFooterBottom">
          <span>© 2026 Microassist — Prototype SaaS français développé à Belfort</span>
        </div>
      </div>
    </footer>
  );
}

function LegalPage({ page, path }) {
  return (
    <div className="page legalPageShell">
      <header className="topbar">
        <div className="topbarLeft">
          <a className="brand legalBrandLink" href="/">
            Microassist
          </a>
          <div className="topbarMeta">
            <div className="greetingBadge">Informations légales</div>
          </div>
        </div>
        <div className="topbarRight">
          <nav className="nav">
            <a className="navLink" href="/">
              Accueil
            </a>
            <a className="navLink" href="/?view=pricing">
              Tarifs
            </a>
            <a className="navLink" href="mailto:contact@microassist.fr">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <main className="legalPage">
        <a className="legalBackLink" href="/">
          Retour à Microassist
        </a>
        <section className="legalHero">
          <p className="legalEyebrow">Microassist</p>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
        </section>

        <section className="legalContent" aria-label={page.title}>
          {page.sections.map((section) => (
            <article key={section.title} className="legalSection">
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </article>
          ))}
          <div className="legalNotice">
            Dernière mise à jour : 2026. Page du prototype : <code>{path}</code>
          </div>
        </section>
      </main>

      <MicroassistFooter />
    </div>
  );
}

export default function App() {
  // Основные состояния
  const [stepIndex, setStepIndex] = useState(0);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState("");
  const [saveNotice, setSaveNotice] = useState(null);
  const saveNoticeTimeoutRef = useRef(null);
  const [successToast, setSuccessToast] = useState(null);
  const successToastTimeoutRef = useRef(null);
  const showSaveNotice = useCallback((notice, duration = 4000) => {
  if (saveNoticeTimeoutRef.current) {
    clearTimeout(saveNoticeTimeoutRef.current);
    saveNoticeTimeoutRef.current = null;
  }

  setSaveNotice(notice);

  if (duration > 0) {
    saveNoticeTimeoutRef.current = window.setTimeout(() => {
      setSaveNotice(null);
      saveNoticeTimeoutRef.current = null;
    }, duration);
  }
}, []);
  const showSuccessToast = useCallback((message, duration = 4000) => {
  if (successToastTimeoutRef.current) {
    clearTimeout(successToastTimeoutRef.current);
    successToastTimeoutRef.current = null;
  }

  setSuccessToast(message);

  if (duration > 0) {
    successToastTimeoutRef.current = window.setTimeout(() => {
      setSuccessToast(null);
      successToastTimeoutRef.current = null;
    }, duration);
  }
}, []);
  const smartPrioritiesRef = useRef(null);
  const simpleOnboardingAdvanceTimeoutRef = useRef(null);

useEffect(() => {
  return () => {
    if (saveNoticeTimeoutRef.current) {
      clearTimeout(saveNoticeTimeoutRef.current);
    }
    if (successToastTimeoutRef.current) {
      clearTimeout(successToastTimeoutRef.current);
    }
    if (simpleOnboardingAdvanceTimeoutRef.current) {
      clearTimeout(simpleOnboardingAdvanceTimeoutRef.current);
    }
    if (betaMicroFeedbackThanksTimeoutRef.current) {
      clearTimeout(betaMicroFeedbackThanksTimeoutRef.current);
    }
  };
}, []);
  const [invoiceNotice, setInvoiceNotice] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [restoredAt, setRestoredAt] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  // UI состояния
  const [helpOpen, setHelpOpen] = useState(false); // ✅ ДОБАВИТЬ
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState("signup");
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [assistantFieldError, setAssistantFieldError] = useState("");
  const [assistantEditMode, setAssistantEditMode] = useState(false);
  const [showFirstRevenueOnboarding, setShowFirstRevenueOnboarding] =
    useState(false);
  const [profileEditMode, setProfileEditMode] = useState("idle");
  const [selectedProfileField, setSelectedProfileField] = useState(null);
  const [profileEditDraft, setProfileEditDraft] = useState({});
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInProgress, setResetInProgress] = useState(false);
  const [profileConflictState, setProfileConflictState] = useState({
    open: false,
    localAnswers: null,
    remoteProfile: null,
  });
  const [profileSyncBlocked, setProfileSyncBlocked] = useState(
    () => readProfileConflictStrategy() === "keep_local",
  );
  const [pendingStructuredProfileEdit, setPendingStructuredProfileEdit] =
    useState(null);
  
  const [focusMode, setFocusMode] = useState(false); // ✅ ДОБАВИТЬ
  const { user, loading: authLoading } = useAuth();
  const [appView, setAppView] = useState("landing");
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [userName, setUserName] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);
  const assistantRef = useRef(null);
  const profileReviewRef = useRef(null);
  const tvaProfileConfigRef = useRef(null);
  const securityRef = useRef(null);
  const heroRef = useRef(null);
  const servicesRef = useRef(null);
  const fiscalRef = useRef(null);
  const revenusRef = useRef(null);
  const facturesRef = useRef(null);
  const analyseRef = useRef(null);
  const prioritesRef = useRef(null);
  const chartRef = useRef(null);
  const deepLinkViewPendingRef = useRef(getDeepLinkViewFromQuery());
  const viewLabel =
    appView === "landing"
      ? "Assistant fiscal"
      : appView === "assistant"
        ? "Profil fiscal"
        : "Espace fiscal";

  const trackBetaEvent = useCallback(
    (eventName, payload = {}) => {
      trackEvent(eventName, {
        appView,
        userId: user?.id || null,
        ...payload,
      });
    },
    [appView, user?.id],
  );

  const goToView = useCallback((nextView, options = {}) => {
    const { push = true, focus = false } = options;
    if (push) {
      const nextUrl = window.location.pathname.startsWith("/legal")
        ? "/"
        : "";
      window.history.pushState({ appView: nextView }, "", nextUrl);
      setCurrentPath(window.location.pathname);
    }
    setAppView(nextView);
    setFocusMode(focus);
    if (nextView === "assistant") setAssistantCollapsed(false);
  }, []);

  const goToPricing = useCallback(() => {
  goToView("pricing", { focus: false });
  window.scrollTo({ top: 0, behavior: "smooth" });
}, [goToView]);

  useEffect(() => {
    if (appView === "landing") {
      trackBetaEvent("landing_view", { source: "app_view" });
    }
    if (appView === "assistant") {
      trackBetaEvent("profile_view", { source: "app_view" });
    }
    if (appView === "dashboard") {
      trackBetaEvent("dashboard_view", { source: "app_view" });
    }
  }, [appView, trackBetaEvent]);

  const goToDashboard = useCallback((options = {}) => {
    const { scroll = true } = options;
    goToView("dashboard", { push: true, focus: true });

    if (!scroll) return;

    setTimeout(() => {
      fiscalRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, [goToView]);
  const handleOpenSmartPriorities = useCallback(() => {
    if (appView !== "dashboard") {
      goToDashboard({ scroll: false });
      setTimeout(() => {
        smartPrioritiesRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
      return;
    }

    smartPrioritiesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [appView, goToDashboard]);
  // Состояния для доходов
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [revenues, setRevenues] = useState([]);
  const [dashboardSections, setDashboardSections] = useState(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_SECTIONS_KEY);
      return raw
        ? { ...DEFAULT_DASHBOARD_SECTIONS, ...JSON.parse(raw) }
        : DEFAULT_DASHBOARD_SECTIONS;
    } catch {
      return DEFAULT_DASHBOARD_SECTIONS;
    }
  });
  const [showBetaNotice, setShowBetaNotice] = useState(() => {
    const hash = window.location.hash;

    if (hash) {
      const hashParams = new URLSearchParams(
        hash.startsWith("#") ? hash.slice(1) : hash,
      );

      if (
        hashParams.get("type") === "signup" &&
        hashParams.get("access_token")
      ) {
        return false;
      }
    }

    return !localStorage.getItem(BETA_SEEN_KEY);
  });
  useEffect(() => {
    if (showBetaNotice) {
      trackBetaEvent("beta_modal_seen", { source: "beta_notice" });
    }
  }, [showBetaNotice, trackBetaEvent]);
  const [simpleAssistantProfile, setSimpleAssistantProfile] = useState(() =>
    readSimpleAssistantProfile(),
  );
  const [showSimpleOnboarding, setShowSimpleOnboarding] = useState(false);
  const [simpleOnboardingStep, setSimpleOnboardingStep] = useState(0);
  const [simpleOnboardingDraft, setSimpleOnboardingDraft] = useState({
    activity_type: "services",
    declaration_frequency: "mensuel",
    business_start_date: "",
    acre: "unknown",
    tva_status: "unknown",
  });
  const [showOnboardingConfirmation, setShowOnboardingConfirmation] =
    useState(false);
  const [tvaConfigDraft, setTvaConfigDraft] = useState(
    () => normalizeTvaConfigStatus(readSimpleAssistantProfile()?.tva_status),
  );
  const [isEditingTVA, setIsEditingTVA] = useState(false);
  const [showCGU, setShowCGU] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [invoiceInitialValues, setInvoiceInitialValues] = useState(null);
  const [mode] = useState("user");
  
  const [invoices, setInvoices] = useState([]);
  const [guestInvoices, setGuestInvoices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_INVOICES_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showFutureAdvancedModal, setShowFutureAdvancedModal] = useState(false);
  const [monthlyExportUsage, setMonthlyExportUsage] = useState(EMPTY_EXPORT_USAGE);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [explanationModalType, setExplanationModalType] = useState(null);
  // состояния
  const [premiumModalSource, setPremiumModalSource] = useState("unknown");
  const [premiumWaitlistEmail, setPremiumWaitlistEmail] = useState("");
  const [premiumWaitlistError, setPremiumWaitlistError] = useState("");
  const [isJoiningPremiumWaitlist, setIsJoiningPremiumWaitlist] =
    useState(false);
  const [premiumWaitlistJoined, setPremiumWaitlistJoined] = useState(false);
  const premiumCTAViewSourceRef = useRef(null);
  const firstRevenueOnboardingSeenRef = useRef(
    readFirstRevenueOnboardingSeen(),
  );
  const [dashboardRemindersDismissed, setDashboardRemindersDismissed] =
    useState(() => {
      try {
        return (
          localStorage.getItem(DASHBOARD_REMINDERS_DISMISSED_KEY) === "1"
        );
      } catch {
        return false;
      }
    });
  const [dashboardTopNudgeDismissedType, setDashboardTopNudgeDismissedType] =
    useState(() => {
      try {
        return localStorage.getItem(DASHBOARD_TOP_NUDGE_DISMISSED_KEY) || "";
      } catch {
        return "";
      }
    });
  const [dashboardChecklistCollapsed, setDashboardChecklistCollapsed] =
    useState(() => {
      try {
        return localStorage.getItem(DASHBOARD_CHECKLIST_COLLAPSED_KEY) === "1";
      } catch {
        return false;
      }
    });
// Modals pédagogiques
  const [showCashImpactModal, setShowCashImpactModal] = useState(false);
  const [showTVADiagnosticModal, setShowTVADiagnosticModal] = useState(false);
  const openExplanationModal = useCallback((type) => {
    if (type === "urssaf") {
      trackBetaEvent("urssaf_info_opened", { source: "explanation_modal" });
    }
    setExplanationModalType(type);
  }, [trackBetaEvent]);
  const closeExplanationModal = useCallback(() => {
    setExplanationModalType(null);
  }, []);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [betaMicroFeedbackState, setBetaMicroFeedbackState] = useState(() =>
    readBetaMicroFeedbackState(),
  );
  const [betaMicroFeedbackThanks, setBetaMicroFeedbackThanks] = useState(null);
  const betaMicroFeedbackThanksTimeoutRef = useRef(null);

  const [reminderPrefs, setReminderPrefs] = useState(DEFAULT_REMINDER_PREFS);
// Plan par défaut côté invité uniquement. Les droits reconnectés viennent du profil Supabase.
 

  const [revenueForm, setRevenueForm] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    revenue_category: "",
    client: "",
    invoice: "",
    note: "",
  });
  const [showRevenueDetails, setShowRevenueDetails] = useState(false); // ✅ ДОБАВИТЬ

  const [showChart, setShowChart] = useState(() => {
    try {
      const saved = localStorage.getItem(CHART_KEY);
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const hideChart = () => {
    setShowChart(false);
    localStorage.setItem(CHART_KEY, "false");
  };

  const openAuthModal = useCallback((mode = "signup") => {
    if (mode === "signup") {
      trackBetaEvent("signup_clicked", { source: "auth_modal" });
    }
    setAuthInitialMode(mode);
    setIsRecoveryFlow(mode === "recovery");
    setAuthOpen(true);
  }, [trackBetaEvent]);

const closeAuthModal = useCallback((reason = "unknown") => {
  console.log("[AUTH CLOSE]", {
    reason,
    isRecoveryFlow,
    authInitialMode,
    authOpen,
    search: window.location.search,
    hash: window.location.hash,
  });

  if (!isRecoveryFlow) {
  setAuthOpen(false);
}
}, [isRecoveryFlow, authInitialMode, authOpen]);

const openRecoveryModal = useCallback(() => {
  console.log("[RECOVERY OPEN MODAL]", {
    search: window.location.search,
    hash: window.location.hash,
  });

  setShowBetaNotice(false);
  setAuthInitialMode("recovery");
  setIsRecoveryFlow(true);
  setAuthOpen(true);
}, []);

const handleRecoveryComplete = useCallback(() => {
  console.log("[RECOVERY COMPLETE]", {
    search: window.location.search,
    hash: window.location.hash,
  });

  setIsRecoveryFlow(false);
  setAuthInitialMode("signin");
  if (!isRecoveryFlow) {
  setAuthOpen(false);
}

  const nextSearchParams = new URLSearchParams(window.location.search);
  nextSearchParams.delete("mode");
  const nextSearch = nextSearchParams.toString();

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
  );

  setTimeout(() => {
    goToDashboard({ scroll: false });
  }, 150);
}, [goToDashboard]);

  const clearAuthenticatedRuntimeState = useCallback(
    ({ clearLocalSessionKeys = false } = {}) => {
      closeAuthModal("auth user change effect");
      setAuthInitialMode("signup");
      setIsRecoveryFlow(false);
      setAppView("landing");
      setFocusMode(false);
      setUserProfile(null);
      setSubscriptionRecord(null);
      setFiscalProfile(null);
      setFiscalProfileLoaded(false);
      fiscalProfileFetchRef.current = {
        inFlight: null,
        userId: null,
        lastFetchedAt: 0,
        lastData: null,
      };
      guestMigrationRef.current = {
        inFlight: null,
        userId: null,
        completedForUserId: null,
      };
      fiscalProfileSaveSourceRef.current = "auto_sync";
      setAnswers({});
      setStepIndex(0);
      setMessages(buildInitialAssistantMessages());
      setInput("");
      setAssistantFieldError("");
      setAssistantEditMode(false);
      setProfileEditMode("idle");
      setSelectedProfileField(null);
      setProfileEditDraft({});
      setPendingStructuredProfileEdit(null);
      setProfileConflictState({
        open: false,
        localAnswers: null,
        remoteProfile: null,
      });
      setProfileSyncBlocked(false);
      setAssistantCollapsed(false);
      setHelpOpen(false);
      setIsTyping(false);
      setUserName("");
      setRevenues([]);
      setInvoices([]);
      setGuestInvoices([]);
      setDashboardSections(DEFAULT_DASHBOARD_SECTIONS);
      setReminderPrefs(DEFAULT_REMINDER_PREFS);
      setSelectedMonth("all");
      setHasDraft(false);
      setLastSavedAt(null);
      setRestoredAt(null);
      setInvoiceNotice(null);
      setSaveNotice(null);
      setShowAddRevenue(false);
      setShowRevenueDetails(false);
      setShowInvoiceGenerator(false);
      setShowReminderModal(false);
      setShowPricingModal(false);
      setShowCashImpactModal(false);
      setShowTVADiagnosticModal(false);
      setExplanationModalType(null);
      setPremiumWaitlistJoined(false);
      setPremiumWaitlistEmail("");
      setPremiumWaitlistError("");
      setPremiumModalSource("unknown");
      setLocalPremiumStatus(false);
      resetRevenueForm();

      if (clearLocalSessionKeys) {
        clearLocalStorageKeys([
          LS_KEY,
          REMINDER_PREFS_KEY,
          PENDING_AUTH_SUCCESS_KEY,
          PREMIUM_STATUS_KEY,
        ]);
      }
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    if (logoutPending) return;

    setLogoutPending(true);

    if (!isSupabaseConfigured) {
      clearAuthenticatedRuntimeState({ clearLocalSessionKeys: true });
      window.location.assign(window.location.pathname + window.location.search);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      clearAuthenticatedRuntimeState({ clearLocalSessionKeys: true });
      window.location.assign(window.location.pathname + window.location.search);
    } catch (error) {
      console.error("Logout error:", error);
      showSaveNotice("Impossible de te déconnecter pour le moment.", 4000);
      setLogoutPending(false);
    }
  }, [clearAuthenticatedRuntimeState, logoutPending, showSaveNotice]);

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [userProfile, setUserProfile] = useState(null);
  const [billingIdentityDraft, setBillingIdentityDraft] = useState(() =>
    normalizeBillingIdentity(),
  );
  const [subscriptionRecord, setSubscriptionRecord] = useState(null);
  const [fiscalProfile, setFiscalProfile] = useState(null);
  const [fiscalProfileLoaded, setFiscalProfileLoaded] = useState(false);
  const [localPremiumStatus, setLocalPremiumStatus] = useState(() =>
    readLocalPremiumStatus(),
  );
  const fiscalProfileFetchRef = useRef({
    inFlight: null,
    userId: null,
    lastFetchedAt: 0,
    lastData: null,
  });
  const guestMigrationRef = useRef({
    inFlight: null,
    userId: null,
    completedForUserId: null,
  });
  const previousUserIdRef = useRef(null);
  const fiscalProfileSaveSourceRef = useRef("auto_sync");
  const subscriptionLikeState = useMemo(
    () =>
      buildSubscriptionLikeState({
        user,
        userProfile,
        subscriptionRecord,
        localPremiumStatus,
      }),
    [localPremiumStatus, subscriptionRecord, user, userProfile],
  );
  const persistedPlan = subscriptionLikeState.plan;
  const profilePremiumStatus = subscriptionLikeState.isPremium;
  const trialDaysLeft = useMemo(
    () => getTrialDaysLeft(subscriptionLikeState.trialEndsAt),
    [subscriptionLikeState.trialEndsAt],
  );
  const isGuest = !user;
  const isFounder = userProfile?.is_founder === true;
  const billingIdentity = useMemo(
    () => normalizeBillingIdentity(userProfile?.billing_identity),
    [userProfile?.billing_identity],
  );
  const totalTrialDays = isFounder ? 90 : 14;
  const isTrialActive = trialDaysLeft !== null && trialDaysLeft > 0;
  const trialHasExpired = useMemo(
    () => isTrialExpired(subscriptionLikeState.trialEndsAt),
    [subscriptionLikeState.trialEndsAt],
  );
  const isLocalhostQa =
    typeof window !== "undefined" &&
    import.meta.env.DEV &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const isQaPremium = Boolean(isLocalhostQa && localPremiumStatus);
  const billingUiState = useMemo(() => {
    if (isQaPremium) {
      return "premium_active";
    }

    if (!user) {
      return "guest";
    }

    if (subscriptionLikeState.hasPaidSubscription) {
      return "premium_active";
    }

    if (subscriptionLikeState.trialEndsAt) {
      return isTrialActive ? "trial_active" : "trial_expired";
    }

    if (profilePremiumStatus) {
      return "premium_active";
    }

    return "registered_free";
  }, [
    isQaPremium,
    isTrialActive,
    profilePremiumStatus,
    subscriptionLikeState.hasPaidSubscription,
    subscriptionLikeState.trialEndsAt,
    user,
  ]);
  const isPremiumUser = billingUiState === "premium_active";
  const isEarlyAccessEndingToday =
    !isGuest &&
    !isPremiumUser &&
    billingUiState === "trial_active" &&
    typeof trialDaysLeft === "number" &&
    trialDaysLeft === totalTrialDays - 7;
  const isEarlyFullAccess =
    !isGuest &&
    !isPremiumUser &&
    billingUiState === "trial_active" &&
    typeof trialDaysLeft === "number" &&
    trialDaysLeft > totalTrialDays - 7;
  const isPostEarlyAccessTrial =
    !isGuest &&
    !isPremiumUser &&
    (billingUiState === "trial_expired" || billingUiState === "registered_free");
  const hasPremiumLikeAccess =
    isPremiumUser || isEarlyFullAccess;
  const accessProfileKey = getAccessProfile({
    isGuest,
    isPremiumUser,
    isFounder,
    isEarlyFullAccess,
    billingUiState,
  });
  const accessProfile = ACCESS_MATRIX[accessProfileKey];
  const hasPremiumAccess =
    isQaPremium || hasPremiumLikeAccess;
  const trialEndsAtLabel = useMemo(() => {
    if (!subscriptionLikeState.trialEndsAt) {
      return "";
    }

    const trialEndDate = new Date(subscriptionLikeState.trialEndsAt);

    if (Number.isNaN(trialEndDate.getTime())) {
      return "";
    }

    return trialEndDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [subscriptionLikeState.trialEndsAt]);
  const daysBeforeDeadline = null;
  const lastActivityDays = 0;
  const premiumTrigger = getPremiumTrigger({
    revenuesCount: revenues?.length || 0,
    trialDaysLeft,
    daysBeforeDeadline:
      typeof daysBeforeDeadline === "number" ? daysBeforeDeadline : null,
    isPremium: Boolean(subscriptionLikeState?.isPremium),
    lastActivityDays:
      typeof lastActivityDays === "number" ? lastActivityDays : 0,
  });
  const sendTrialEndingEmail = useCallback(
    async () => {
      // LOT 10.1G: the anon key grants no real identity and the function
      // no longer trusts a client-supplied recipient/subject/html/userId
      // -- the caller's own authenticated session token is the only
      // credential sent, and the Edge Function derives everything else
      // (event type, trial state, email content) itself.
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        console.warn(
          "[trial-email-send] error",
          "Missing authenticated session",
        );
        return null;
      }

      const response = await fetch(
        "https://bvymwuokljxgoavfehav.supabase.co/functions/v1/send-trial-ending-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          `send-trial-ending-email failed with status ${response.status}`,
        );
      }

      return result;
    },
    [],
  );


  // Effective plan is the only plan used by UI limits and premium guards.
  const effectivePlan = useMemo(() => {
    return hasPremiumAccess ? "premium" : "free";
  }, [hasPremiumAccess]);
  const currentPlanLimits = hasPremiumAccess
    ? PRICING_LIMITS.essential || PRICING_LIMITS.free
    : PRICING_LIMITS.free;
  const canExportCsv =
    accessProfile?.features?.export_csv === true;
  const canExportPdf =
    isQaPremium || accessProfile?.features?.export_pdf === true;
  const isSmsReminderImplemented = false;
  const hasSmsPremiumAccess =
    isSmsReminderImplemented && effectivePlan === "premium";
  const usedExports = monthlyExportUsage.total;
  const remainingExports =
    !hasPremiumAccess
      ? Math.max(0, FREE_EXPORTS_PER_MONTH - usedExports)
      : Infinity;
  const isExportLimitReached = !hasPremiumAccess && remainingExports <= 0;
  const exportHelperText = useMemo(() => {
    if (isQaPremium) {
      return "Mode Premium QA • exports illimités";
    }

    switch (billingUiState) {
      case "trial_active":
        return "PDF + CSV inclus • historique complet";
      case "premium_active":
        return "PDF + CSV illimités • historique complet";
      case "trial_expired":
        return "PDF + CSV inclus";
      case "guest":
      case "registered_free":
      default:
        return "PDF + CSV inclus";
    }
  }, [billingUiState, canExportPdf, isQaPremium]);
  const premiumExportBadge = useMemo(() => {
    if (isQaPremium) {
      return "🧪 Premium QA";
    }

    switch (billingUiState) {
      case "trial_active":
        return `⏳ Essai actif${trialDaysLeft ? ` • ${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""} restants` : ""}`;
      case "premium_active":
        return "⭐ Premium actif";
      default:
        return "";
    }
  }, [billingUiState, hasPremiumLikeAccess, isQaPremium, remainingExports, trialDaysLeft]);

  function toggleLocalPremiumQa() {
    const nextValue = !localPremiumStatus;
    setLocalPremiumStatus(nextValue);
    writeLocalPremiumStatus(nextValue);
  }

  const refreshUserProfile = useCallback(async () => {
    if (!user?.id) {
      setUserProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        debugWarn("Load profiles warning:", error.message);
        setUserProfile(null);
        return null;
      }

      setUserProfile(data || null);
      return data || null;
    } catch (error) {
      debugWarn("Unexpected profiles load warning:", error);
      setUserProfile(null);
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    setBillingIdentityDraft(billingIdentity);
  }, [billingIdentity]);

  const saveBillingIdentity = useCallback(async () => {
    const nextBillingIdentity = normalizeBillingIdentity(billingIdentityDraft);

    if (!user?.id) {
      showSaveNotice(
        "Crée un compte pour enregistrer ton identité de facturation.",
        4000,
      );
      return false;
    }

    const profilePayload = buildProfilePayload(user, userProfile, {
      billing_identity: nextBillingIdentity,
    });

    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.error("Billing identity save error:", error.message);
        showSaveNotice("Impossible d’enregistrer l’identité de facturation.", 4000);
        return false;
      }

      setUserProfile(data || profilePayload);
      showSaveNotice("Identité de facturation enregistrée ✅", 3000);
      return true;
    } catch (error) {
      console.error("Unexpected billing identity save error:", error);
      showSaveNotice("Impossible d’enregistrer l’identité de facturation.", 4000);
      return false;
    }
  }, [billingIdentityDraft, showSaveNotice, user, userProfile]);

const refreshSubscriptionRecord = useCallback(async () => {
  if (!SUBSCRIPTIONS_TABLE_ENABLED) {
    setSubscriptionRecord(null);
    return null;
  }

  if (!user?.id) {
    setSubscriptionRecord(null);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      const message = error?.message || "";

      const isMissingSubscriptionsTable =
        message.includes("Could not find the table 'public.subscriptions'") ||
        message.includes('relation "public.subscriptions" does not exist');

      if (isMissingSubscriptionsTable) {
        debugLog("[subscriptions] table not ready yet, fallback to profiles only");
        setSubscriptionRecord(null);
        return null;
      }

      debugWarn("Load subscriptions warning:", error.message);
      setSubscriptionRecord(null);
      return null;
    }

    const nextSubscription = Array.isArray(data) ? data[0] || null : null;
    const normalizedSubscription = nextSubscription
      ? buildSubscriptionPayload(user.id, nextSubscription)
      : null;

    setSubscriptionRecord(normalizedSubscription);
    return normalizedSubscription;
  } catch (error) {
    const message = error?.message || "";

    const isMissingSubscriptionsTable =
      message.includes("Could not find the table 'public.subscriptions'") ||
      message.includes('relation "public.subscriptions" does not exist');

    if (isMissingSubscriptionsTable) {
      debugLog("[subscriptions] table not ready yet, fallback to profiles only");
      setSubscriptionRecord(null);
      return null;
    }

    debugWarn("Unexpected subscriptions load warning:", error);
    setSubscriptionRecord(null);
    return null;
  }
}, [user?.id]);


  const refreshRevenues = useCallback(async () => {
    if (!user) {
      setRevenues([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("revenues")
        .select("*")
        .eq("user_id", user.id)
        .order("revenue_date", { ascending: false });

      if (error) {
        console.error("Load revenues error:", error.message);
        setRevenues([]);
        return;
      }

      const normalized = (data || []).map((item) => ({
        id: item.id,
        amount: Number(item.amount || 0),
        date: item.revenue_date,
        revenue_category: item.revenue_category || "",
        client: item.client || "",
        invoice: item.invoice || "",
        note: item.note || "",
        createdAt: item.created_at || null,
      }));

      setRevenues(normalized);
    } catch (error) {
      console.error("Unexpected error in refreshRevenues:", error);
      setRevenues([]);
    }
  }, [user]);

  const refreshInvoices = useCallback(async () => {
    if (!user) {
      setInvoices([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load invoices error:", error.message);
        setInvoices([]);
        return;
      }
      setInvoices(data || []);
    } catch (error) {
      console.error("Unexpected error in refreshInvoices:", error);
      setInvoices([]);
    }
  }, [user]);

  // useCallback для refreshFiscalProfile
  const refreshFiscalProfile = useCallback(async (options = {}) => {
    const { force = false } = options;
    if (!user) {
      setFiscalProfile(null);
      setFiscalProfileLoaded(false);
      fiscalProfileFetchRef.current = {
        inFlight: null,
        userId: null,
        lastFetchedAt: 0,
        lastData: null,
      };
      return;
    }

    const fetchState = fiscalProfileFetchRef.current;
    const now = Date.now();

    if (!force && fetchState.inFlight && fetchState.userId === user.id) {
      return fetchState.inFlight;
    }

    if (
      !force &&
      fetchState.userId === user.id &&
      now - fetchState.lastFetchedAt < 500
    ) {
      return fetchState.lastData;
    }

    try {
      setFiscalProfileLoaded(false);

      const request = (async () => {
        const { data, error } = await supabase
          .from("fiscal_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (error) {
        console.error("Load fiscal profile error:", error.message);
        setFiscalProfile(null);
        setFiscalProfileLoaded(true);
        fetchState.lastFetchedAt = Date.now();
        fetchState.lastData = null;
        return null;
      }

      const normalizedData = data
        ? {
            ...data,
            activity_type: data.activity_type
              ? normalizeActivityType(data.activity_type)
              : null,
          }
        : null;
      setFiscalProfile(normalizedData);
      setFiscalProfileLoaded(true);
      fetchState.lastFetchedAt = Date.now();
      fetchState.lastData = normalizedData;
      return normalizedData;
      })();

      fetchState.userId = user.id;
      fetchState.inFlight = request;

      return await request;
    } catch (error) {
      console.error("Unexpected error in refreshFiscalProfile:", error);
      setFiscalProfile(null);
      setFiscalProfileLoaded(true);
      fiscalProfileFetchRef.current.lastFetchedAt = Date.now();
      fiscalProfileFetchRef.current.lastData = null;
      return null;
    } finally {
      if (fiscalProfileFetchRef.current.userId === user.id) {
        fiscalProfileFetchRef.current.inFlight = null;
      }
    }
  }, [user]);

  function calculateNextReminder(frequency) {
    return calculateNextReminderDate(frequency);
  }

  const persistPremiumStatus = useCallback(
    async (nextIsPremium, options = {}) => {
      const { refresh = true } = options;
      const normalizedValue = Boolean(nextIsPremium);
      const nextPlan = normalizedValue
        ? "premium"
        : isTrialExpired(subscriptionLikeState.trialEndsAt)
          ? "free"
          : "trial";

      setLocalPremiumStatus(normalizedValue);
      writeLocalPremiumStatus(normalizedValue);

      if (user?.id) {
        const profilePayload = buildProfilePayload(user, userProfile, {
          plan: nextPlan,
          subscription_status:
            subscriptionLikeState.subscriptionStatus || userProfile?.subscription_status || null,
          is_premium: normalizedValue,
          trial_started_at:
            subscriptionLikeState.trialStartedAt || userProfile?.trial_started_at || null,
          trial_ends_at:
            subscriptionLikeState.trialEndsAt || userProfile?.trial_ends_at || null,
          stripe_customer_id: userProfile?.stripe_customer_id || null,
        });

        debugLog("[profiles] sending payload", {
          source: "persist_premium_status",
          payload: profilePayload,
        });

        try {
          const { data, error } = await supabase
            .from("profiles")
            .upsert(profilePayload, { onConflict: "id" })
            .select()
            .single();

          debugLog("[profiles] save result", {
            source: "persist_premium_status",
            data,
            error,
          });

          if (error) {
            debugWarn(
              "Persist premium status fallback to local-only state:",
              error.message,
            );
          } else {
            setUserProfile(data || profilePayload);
          }
        } catch (error) {
          debugWarn("Persist premium status fallback to local-only state:", error);
        }
      }

      if (refresh) {
        await Promise.all([
          refreshFiscalProfile({ force: true }),
          refreshUserProfile(),
          SUBSCRIPTIONS_TABLE_ENABLED
            ? refreshSubscriptionRecord()
            : Promise.resolve(null),
        ]);
      }

      debugLog("[profiles] premium status stored outside fiscal_profiles", {
        normalizedValue,
        userId: user?.id || null,
      });
      return true;
    },
    [
      userProfile,
      refreshFiscalProfile,
      refreshUserProfile,
      refreshSubscriptionRecord,
      subscriptionLikeState.subscriptionStatus,
      subscriptionLikeState.trialEndsAt,
      subscriptionLikeState.trialStartedAt,
      user,
    ],
  );

  const saveFiscalProfileToSupabase = useCallback(async (profileAnswers, options = {}) => {
    const {
      source = "auto_sync",
      showSuccessNotice = false,
    } = options;
    const normalizedProfileAnswers = sanitizeFiscalAnswers(profileAnswers);
    if (!user?.id) {
      return { ok: false, skipped: true, reason: "missing_user" };
    }

    if (!fiscalProfileLoaded) {
      return { ok: false, skipped: true, reason: "profile_not_loaded" };
    }
    const payload = buildFiscalProfilePayload(user.id, normalizedProfileAnswers);

    if (isSameFiscalProfilePayload(payload, fiscalProfile)) {
      debugLog("[fiscal_profiles] save skipped (duplicate payload ignored)", {
        source,
        payload,
      });
      return { ok: true, skipped: true, reason: "duplicate_ignored" };
    }

    debugLog("[fiscal_profiles] sending payload", {
      source,
      payload,
    });

    const { data, error } = await supabase
      .from("fiscal_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    debugLog("[fiscal_profiles] save result", {
      source,
      data,
      error,
    });

    if (error) {
      console.error("Fiscal profile upsert error:", {
        source,
        payload,
        error,
      });
      showSaveNotice(
        "Impossible d’enregistrer ton profil fiscal pour le moment.",
        4000,
      );
      return { ok: false, skipped: false, error };
    }

    if (showSuccessNotice) {
      showSaveNotice("Profil fiscal enregistré ✅", 3000);
    }

    const nextRemindAt = calculateNextReminder(
      normalizedProfileAnswers.declaration_frequency,
    );

    if (!nextRemindAt) {
      return { ok: true, skipped: false, data };
    }

    const { error: reminderError } = await supabase.from("reminders").upsert(
      {
        user_id: user.id,
        reminder_type: "declaration",
        reminder_date: nextRemindAt.slice(0, 10),
        status: "pending",
      },
      { onConflict: "user_id,reminder_type" },
    );

    if (reminderError) {
      console.error("Reminder upsert error:", reminderError.message);
    }

    return { ok: true, skipped: false, data };
  }, [
    user?.id,
    fiscalProfile,
    fiscalProfileLoaded,
    showSaveNotice,
  ]);

  async function saveReminderPrefsToSupabase(prefsToSave = reminderPrefs) {
    try {
      if (!user) return false;
      if (!isFiscalProfileComplete) return false;
      if (!fiscalProfile?.user_id) return false;

      const normalizedReminderPrefs = {
        ...prefsToSave,
        sms: hasSmsPremiumAccess ? prefsToSave.sms : false,
      };

      const payload = {
        reminder_declaration: normalizedReminderPrefs.declaration,
        reminder_tva: normalizedReminderPrefs.tva,
        reminder_cfe: normalizedReminderPrefs.cfe,
        reminder_acre: normalizedReminderPrefs.acre,
        reminder_email: normalizedReminderPrefs.email,
        reminder_sms: normalizedReminderPrefs.sms,
      };

      const { error } = await supabase
        .from("fiscal_profiles")
        .update(payload)
        .eq("user_id", user.id);

      if (error) {
        console.error("saveReminderPrefsToSupabase error:", error);
        return false;
      }

      await refreshFiscalProfile();
      return true;
    } catch (error) {
      console.error("Unexpected reminder prefs error:", error);
      return false;
    }
  }

  async function saveReminderPreferences() {
    const normalizedReminderPrefs = {
      ...reminderPrefs,
      sms: hasSmsPremiumAccess ? reminderPrefs.sms : false,
    };

    track("reminder_preferences_saved", normalizedReminderPrefs);

    localStorage.setItem(
      REMINDER_PREFS_KEY,
      JSON.stringify(normalizedReminderPrefs),
    );

    const saved = await saveReminderPrefsToSupabase(normalizedReminderPrefs);

    if (saved || !user) {
      setReminderPrefs(normalizedReminderPrefs);
      setShowReminderModal(false);
      showSaveNotice("Préférences de rappels enregistrées ✅", 3000);
      showSuccessToast("✅ Rappel mis à jour.", 4000);
      return;
    }

    if (user && !isFiscalProfileComplete) {
      setReminderPrefs(normalizedReminderPrefs);
      setShowReminderModal(false);
      showSaveNotice(
        "Préférences enregistrées localement. Complète ton profil fiscal pour les synchroniser.",
        3500,
      );
      return;
    }

    showSaveNotice("Impossible d’enregistrer les préférences.", 3000);
  }

  const migrateLocalDataToSupabase = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user) return false;

    const migrationState = guestMigrationRef.current;

    if (migrationState.inFlight && migrationState.userId === user.id) {
      return migrationState.inFlight;
    }

    const migrationRequest = (async () => {
      let migrated = false;
      const conflictStrategy = readProfileConflictStrategy();

      // Un conflit déjà détecté bloque toute fusion automatique ultérieure.
      if (conflictStrategy) {
        return false;
      }

      const localDraftAnswers = readLocalDraftAnswers();
      const hasLocalStructuredProfile = Boolean(
        localDraftAnswers?.activity_type ||
        localDraftAnswers?.declaration_frequency ||
        localDraftAnswers?.acre ||
        localDraftAnswers?.business_start_date,
      );
      const remoteProfile = await refreshFiscalProfile({ force: true });
      const hasRemoteStructuredProfile = Boolean(
        remoteProfile?.activity_type ||
        remoteProfile?.declaration_frequency ||
        remoteProfile?.acre ||
        remoteProfile?.business_start_date,
      );

      if (
        hasLocalStructuredProfile &&
        hasRemoteStructuredProfile &&
        hasFiscalProfileConflict(localDraftAnswers, remoteProfile)
      ) {
        setProfileConflictState({
          open: true,
          localAnswers: localDraftAnswers,
          remoteProfile,
        });
        setProfileSyncBlocked(true);
        writeProfileConflictStrategy("detected");
        migrationState.completedForUserId = user.id;
        return false;
      }

      // 1. Migrer les revenus locaux
      const localRevenues = localStorage.getItem(GUEST_REVENUES_KEY);
      if (localRevenues) {
        try {
          const revenues = JSON.parse(localRevenues);
          if (Array.isArray(revenues) && revenues.length > 0) {
            const payload = revenues.map((rev) => ({
              user_id: user.id,
              amount: rev.amount,
              revenue_date: rev.date,
              client: rev.client || null,
              invoice: rev.invoice || null,
              note: rev.note || null,
            }));

            const { error } = await supabase.from("revenues").insert(payload);

            if (error) {
              throw error;
            }

            migrated = true;
            console.log("✅ Revenus locaux migrés:", revenues.length);
          }
        } catch (e) {
          console.error("Erreur migration revenus:", e);
        }
      }

      // 2. Migrer les factures invité
      const localGuestInvoices = localStorage.getItem(GUEST_INVOICES_KEY);
      if (localGuestInvoices) {
        try {
          const invoicesToMigrate = JSON.parse(localGuestInvoices);
          if (Array.isArray(invoicesToMigrate) && invoicesToMigrate.length > 0) {
            const legacyInvoicesToMigrate = invoicesToMigrate.filter(
              (invoice) => !isFacturXDraftInvoice(invoice),
            );
            const payload = legacyInvoicesToMigrate.map((invoice) => ({
              user_id: user.id,
              invoice_number: invoice.invoice_number,
              client_name: invoice.client_name || "",
              client_address: invoice.client_address || "",
              client_email: invoice.client_email || "",
              description: invoice.description || "",
              amount: invoice.amount || 0,
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              status: invoice.status === "paid" ? "paid" : "unpaid",
              is_compliant: isInvoiceCompliant(invoice, userProfile),
              paid_at: invoice.paid_at || null,
            }));

            if (payload.length === 0) {
              console.log("Factures Factur-X locales conservées sans migration.");
            } else {
              const { error } = await supabase.from("invoices").insert(payload);

              if (error) {
                throw error;
              }

              migrated = true;
              console.log("✅ Factures invité migrées:", payload.length);
            }
          }
        } catch (e) {
          console.error("Erreur migration factures:", e);
        }
      }

      // 3. Migrer le profil fiscal
      const localAnswers = localStorage.getItem(LS_KEY);
      if (localAnswers) {
        try {
          const data = JSON.parse(localAnswers);
          if (
            data.answers &&
            (data.answers.activity_type || data.answers.declaration_frequency)
          ) {
            const fiscalProfileSave = await saveFiscalProfileToSupabase(
              data.answers,
              {
                source: "migration_local_profile",
                showSuccessNotice: false,
              },
            );

            if (fiscalProfileSave?.ok) {
              migrated = true;
              console.log("✅ Profil fiscal local migré");
            }
          }
        } catch (e) {
          console.error("Erreur migration profil:", e);
        }
      }

      // 4. Migrer les préférences de rappels invité
      const localReminderPrefs = localStorage.getItem(REMINDER_PREFS_KEY);
      if (localReminderPrefs) {
        try {
          const parsedPrefs = JSON.parse(localReminderPrefs);
          const didSavePrefs = await saveReminderPrefsToSupabase(parsedPrefs);

          if (didSavePrefs) {
            migrated = true;
            console.log("✅ Préférences de rappel migrées");
          }
        } catch (e) {
          console.error("Erreur migration rappels:", e);
        }
      }

      if (migrated) {
        const preservedFacturxInvoices = (() => {
          try {
            const parsed = JSON.parse(
              localStorage.getItem(GUEST_INVOICES_KEY) || "[]",
            );
            return Array.isArray(parsed)
              ? parsed.filter((invoice) => isFacturXDraftInvoice(invoice))
              : [];
          } catch {
            return [];
          }
        })();
        clearLocalStorageKeys([
          LS_KEY,
          GUEST_REVENUES_KEY,
          GUEST_INVOICES_KEY,
          REMINDER_PREFS_KEY,
        ]);
        if (preservedFacturxInvoices.length > 0) {
          localStorage.setItem(
            GUEST_INVOICES_KEY,
            JSON.stringify(preservedFacturxInvoices),
          );
          setGuestInvoices(preservedFacturxInvoices);
        } else {
          setGuestInvoices([]);
        }
        setHasDraft(false);
        setLastSavedAt(null);
        setRestoredAt(null);

        await Promise.all([
          refreshRevenues(),
          refreshFiscalProfile({ force: true }),
          refreshInvoices(),
        ]);

        migrationState.completedForUserId = user.id;

        if (!silent) {
          showSaveNotice(
            "Ton profil est sauvegardé dans ton espace.",
            3000,
          );
        }
      }

      return migrated;
    })();

    migrationState.userId = user.id;
    migrationState.inFlight = migrationRequest;

    try {
      return await migrationRequest;
    } finally {
      if (guestMigrationRef.current.userId === user.id) {
        guestMigrationRef.current.inFlight = null;
      }
    }
  }, [
    user,
    refreshRevenues,
    refreshFiscalProfile,
    refreshInvoices,
    saveFiscalProfileToSupabase,
    showSaveNotice,
    userProfile,
  ]);

  // Эффекты с правильными зависимостями
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setFiscalProfile(null);
      return;
    }

    const timer = setTimeout(() => {
      refreshFiscalProfile();
    }, 180);

    return () => clearTimeout(timer);
  }, [authLoading, user, refreshFiscalProfile]);

  useEffect(() => {
    if (!user) {
      setRevenues([]);
      return;
    }
    refreshRevenues();
  }, [user, refreshRevenues]);

  useEffect(() => {
    if (!user) {
      setInvoices([]);
      return;
    }
    refreshInvoices();
  }, [user, refreshInvoices]);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    refreshUserProfile();
  }, [user, refreshUserProfile]);

  useEffect(() => {
    if (!user) {
      setSubscriptionRecord(null);
      return;
    }
    if (!SUBSCRIPTIONS_TABLE_ENABLED) {
      setSubscriptionRecord(null);
      return;
    }
    refreshSubscriptionRecord();
  }, [user, refreshSubscriptionRecord]);

useEffect(() => {
  if (!isSupabaseConfigured) {
    return;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("[AUTH EVENT APP]", {
      event,
      hasSession: Boolean(session),
      userId: session?.user?.id || null,
      search: window.location.search,
      hash: window.location.hash,
      isRecoveryFlow,
    });

    if (event === "PASSWORD_RECOVERY" && session && hasRecoveryUrlState()) {
      openRecoveryModal();
    }
  });

  return () => {
    subscription.unsubscribe();
  };
  }, [openRecoveryModal, isRecoveryFlow]);

  useEffect(() => {
    clearStaleRecoveryState();

    const {
      type: authType,
      accessToken,
      refreshToken,
      tokenHash,
      error: authError,
      errorCode: authErrorCode,
    } = getAuthCallbackParams();

    const isSignupConfirmation =
      authType === "signup" ||
      authType === "confirmation" ||
      authType === "invite";

    if (hasRecoveryUrlState()) {
      console.log("[recovery-debug] open recovery from App URL");
      setAuthInitialMode("recovery");
      setIsRecoveryFlow(true);
      setAuthOpen(true);
    }

    if (authType === "recovery") {
      openRecoveryModal();
    }

    if (
      authError === "access_denied" ||
      authErrorCode === "otp_expired"
    ) {
      showSaveNotice(
        "Le lien a expiré. Demande un nouveau lien ou connecte-toi avec ton mot de passe.",
        5000,
      );
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      openAuthModal("signin");
      return;
    }

    if (tokenHash && authType && isSupabaseConfigured) {
      const supportedOtpTypes = new Set([
        "signup",
        "recovery",
        "invite",
        "magiclink",
        "email",
        "email_change",
      ]);
      const verifyType = authType === "confirmation" ? "signup" : authType;

      if (!supportedOtpTypes.has(verifyType)) {
        return;
      }

      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: verifyType,
        })
        .then(({ error: verifyError }) => {
          if (verifyError) {
            showSaveNotice(
              "Le lien a expiré. Demande un nouveau lien ou connecte-toi avec ton mot de passe.",
              5000,
            );
            cleanAuthCallbackUrl();
            openAuthModal("signin");
            return;
          }

          if (isSignupConfirmation) {
            localStorage.setItem(PENDING_AUTH_SUCCESS_KEY, "email_confirmed");
            localStorage.setItem(BETA_SEEN_KEY, "1");
            setShowBetaNotice(false);
            return;
          }

          if (authType === "recovery") {
            openRecoveryModal();
            return;
          }

          localStorage.setItem(PENDING_AUTH_SUCCESS_KEY, "signed_in");
        });
      return;
    }

    if (!accessToken && !refreshToken) {
      return;
    }

    if (isSignupConfirmation) {
      localStorage.setItem(PENDING_AUTH_SUCCESS_KEY, "email_confirmed");
      localStorage.setItem(BETA_SEEN_KEY, "1");
      setShowBetaNotice(false);
      return;
    }

    if (authType === "recovery") {
      openRecoveryModal();
      return;
    }

    localStorage.setItem(PENDING_AUTH_SUCCESS_KEY, "signed_in");
  }, [openRecoveryModal, openAuthModal, showSaveNotice]);

// sync reminder prefs depuis Supabase
useEffect(() => {
  if (!fiscalProfile) return;

  setReminderPrefs((prev) => ({
    ...prev,
    declaration: fiscalProfile.reminder_declaration ?? prev.declaration,
    tva: fiscalProfile.reminder_tva ?? prev.tva,
    cfe: fiscalProfile.reminder_cfe ?? prev.cfe,
    acre: fiscalProfile.reminder_acre ?? prev.acre,
    email: fiscalProfile.reminder_email ?? prev.email,
    sms: hasSmsPremiumAccess ? (fiscalProfile.reminder_sms ?? prev.sms) : false,
  }));
}, [fiscalProfile, hasSmsPremiumAccess]);


  const steps = FISCAL_STEPS;

  const [messages, setMessages] = useState(() => buildInitialAssistantMessages());

  const step = steps[stepIndex];

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const forceTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    forceTop();

    const t1 = setTimeout(forceTop, 0);
    const t2 = setTimeout(forceTop, 150);
    const t3 = setTimeout(forceTop, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    showConsoleSignature();
  }, []);

  // ОПТИМИЗИРОВАННЫЙ Эффект для Realtime подписки на доходы
  useEffect(() => {
    // Если нет пользователя - не подписываемся
    if (!user) return;

    let channel;
    let isSubscribed = true;

    const setupRealtime = async () => {
      try {
        // Используем user из хука, не делаем лишний запрос
        channel = supabase
          .channel(`revenues-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "revenues",
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log("Revenue change detected:", payload);
              if (isSubscribed) {
                await refreshRevenues();
              }
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              console.log("Realtime subscription active for revenues");
            } else if (status === "CHANNEL_ERROR") {
              console.error("Realtime subscription error");
            }
          });
      } catch (error) {
        console.error("Error setting up realtime:", error);
      }
    };

    setupRealtime();

    // Очистка при размонтировании или смене пользователя
    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]); // ДОБАВЛЯЕМ user в зависимости!

  // ОПТИМИЗИРОВАННЫЙ Эффект для Realtime подписки на профиль
  useEffect(() => {
    // Если нет пользователя - не подписываемся
    if (!user) return;

    let channel;
    let isSubscribed = true;

    const setupFiscalProfileRealtime = async () => {
      try {
        // Используем user из хука
        channel = supabase
          .channel(`fiscal-profile-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "fiscal_profiles",
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              console.log("Fiscal profile change detected:", payload);
              if (isSubscribed) {
                await refreshFiscalProfile();
              }
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              console.log("Realtime subscription active for fiscal profile");
            } else if (status === "CHANNEL_ERROR") {
              console.error("Realtime subscription error for fiscal profile");
            }
          });
      } catch (error) {
        console.error("Error setting up fiscal profile realtime:", error);
      }
    };

    setupFiscalProfileRealtime();

    // Очистка при размонтировании или смене пользователя
    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]); // ДОБАВЛЯЕМ user в зависимости!

  useEffect(() => {
    if (!chatEndRef.current) return;
    if (appView !== "assistant") return;

    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [messages, stepIndex, isTyping, appView]);

  function scrollToTopSection(target = "hero") {
    const refMap = {
      hero: heroRef,
      assistant: assistantRef,
      security: securityRef,
    };

    const ref = refMap[target];
    if (!ref?.current) return;

    requestAnimationFrame(() => {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function addMessage(role, text) {
    setMessages((prev) => [...prev, { role, text }]);
  }

  function addAssistant(text) {
    addMessage("bot", `🤖 ${text}`);
  }

  function getIndexByKey(key) {
    return FISCAL_STEPS.findIndex((s) => s.key === key);
  }

  function scrollToRef(ref) {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function scrollToSection(id) {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function openSecuritySection() {
    setFocusMode(false);

    setTimeout(() => {
      securityRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  function goNext(forcedNextIndex = null, sourceAnswers = answers) {
    let nextIndex = forcedNextIndex ?? stepIndex + 1;

    while (
      nextIndex < FISCAL_STEPS.length &&
      !isStepAvailable(FISCAL_STEPS[nextIndex], sourceAnswers)
    ) {
      nextIndex += 1;
    }

    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);

      if (nextIndex < FISCAL_STEPS.length) {
        setStepIndex(nextIndex);
        const nextStep = FISCAL_STEPS[nextIndex];
        addMessage(
          "bot",
          `Étape ${nextIndex + 1} — ${nextStep.title}\n${nextStep.question}`,
        );
      } else {
        addMessage("bot", "✅ Terminé.");
      }
    }, 600);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);

      // всегда стартуем с Accueil
      setAppView("landing");
      setFocusMode(false);

      if (!raw) {
        setHydrated(true);
        return;
      }

      const data = JSON.parse(raw);

      if (!data || data.version !== LS_VERSION) {
        localStorage.removeItem(LS_KEY);
        setHydrated(true);
        return;
      }

      setHasDraft(true);

      if (data.savedAt) setLastSavedAt(data.savedAt);

      const a = data.answers || {};
      if (a && typeof a === "object") setAnswers(sanitizeFiscalAnswers(a));

      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      }

      if (typeof data.userName === "string") {
        setUserName(data.userName);
      }

      let nextIndex = 0;
      if (typeof data.stepIndex === "number") {
        nextIndex = data.stepIndex;
      }

      setStepIndex(nextIndex);
      setRestoredAt(new Date().toISOString());
    } catch (e) {
      console.warn("Restore failed:", e);
      localStorage.removeItem(LS_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_SECTIONS_KEY,
        JSON.stringify(dashboardSections),
      );
    } catch {
      // Ignore localStorage failures for dashboard UI preferences.
    }
  }, [dashboardSections]);

useEffect(() => {
  syncMonthlyExportUsage();
}, []);

useEffect(() => {
  const handleVisibilitySync = () => {
    if (document.visibilityState === "visible") {
      syncMonthlyExportUsage();
    }
  };

  window.addEventListener("focus", syncMonthlyExportUsage);
  document.addEventListener("visibilitychange", handleVisibilitySync);

  return () => {
    window.removeEventListener("focus", syncMonthlyExportUsage);
    document.removeEventListener("visibilitychange", handleVisibilitySync);
  };
}, []);

useEffect(() => {
  try {
    const saved = localStorage.getItem(REMINDER_PREFS_KEY);
    if (saved) {
      setReminderPrefs(JSON.parse(saved));
    }
  } catch (error) {
    console.error("Erreur chargement préférences rappels:", error);
  }
}, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_CHECKLIST_COLLAPSED_KEY,
        dashboardChecklistCollapsed ? "1" : "0",
      );
    } catch {
      // Ignore localStorage failures for checklist UI state.
    }
  }, [dashboardChecklistCollapsed]);

  const sanitizedAnswers = useMemo(() => sanitizeFiscalAnswers(answers), [answers]);
  const fiscalDateErrors = useMemo(() => getFiscalDateErrors(answers), [answers]);
  const hasBlockingFiscalDateError =
    Boolean(fiscalDateErrors.business_start_date) ||
    Boolean(fiscalDateErrors.acre_start_date);

  useEffect(() => {
    const canSaveFiscalProfile =
      sanitizedAnswers?.entry_status &&
      sanitizedAnswers?.activity_type &&
      sanitizedAnswers?.declaration_frequency;

    if (!canSaveFiscalProfile) return;
    if (hasBlockingFiscalDateError) return;
    if (!user) return;
    if (user && !fiscalProfileLoaded) return;
    if (profileSyncBlocked) return;

    const timeoutId = setTimeout(() => {
      const source = fiscalProfileSaveSourceRef.current || "auto_sync";
      fiscalProfileSaveSourceRef.current = "auto_sync";
      saveFiscalProfileToSupabase(sanitizedAnswers, {
        source,
        showSuccessNotice: false,
      });

    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    sanitizedAnswers?.entry_status,
    sanitizedAnswers?.activity_type,
    sanitizedAnswers?.declaration_frequency,
    sanitizedAnswers?.acre,
    sanitizedAnswers?.acre_start_date,
    sanitizedAnswers?.business_start_date,
    hasBlockingFiscalDateError,
    fiscalProfileLoaded,
    profileSyncBlocked,
    saveFiscalProfileToSupabase,
    user,
    showSaveNotice,
  ]);
  useEffect(() => {
    if (!userName) return;

    setMessages((prev) => {
      if (!prev?.length) return prev;

      const next = [...prev];
      next[0] = {
        ...next[0],
        text: `Bonjour, ${userName} 👋 On va construire ton projet en 5 étapes. Réponds simplement.`,
      };
      return next;
    });
  }, [userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (step?.mode === "dashboard") return;
    inputRef.current?.focus();
  }, [stepIndex, step?.mode]);

  useEffect(() => {
    setHelpOpen(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!hydrated) return;
    if (messages.length === 0) return;

    try {
      const now = new Date().toISOString();
      const payload = {
        version: LS_VERSION,
        stepIndex,
        answers,
        userName,
        messages,
        appView,
        savedAt: now,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      setLastSavedAt(now);
    } catch (e) {
      console.warn("Save failed:", e);
    }
  }, [hydrated, stepIndex, answers, messages, userName, appView]);

  useEffect(() => {
    if (revenues.length === 1) {
      setAssistantCollapsed(true);
    }
  }, [revenues.length]);

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      setCurrentPath(window.location.pathname);

      if (state?.appView) {
        setAppView(state.appView);

        if (state.appView === "landing") {
          setFocusMode(false);
        }

        if (state.appView === "assistant") {
          setAssistantCollapsed(false);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || authLoading) return;
    if (isRecoveryFlow) return;

    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const pendingDeepLinkView = deepLinkViewPendingRef.current;
    const effectiveDeepLinkView =
      pendingDeepLinkView ||
      (requestedView === "pricing" ||
      requestedView === "dashboard" ||
      requestedView === "assistant"
        ? requestedView
        : null);

    if (!effectiveDeepLinkView) return;
    if (appView === effectiveDeepLinkView) return;

    if (
      requestedView === "pricing" ||
      requestedView === "dashboard" ||
      requestedView === "assistant"
    ) {
      console.log(`[deep-link] detected ${requestedView} query param`);
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const hasAuthRedirectInProgress =
      hasRecoveryUrlState() ||
      Boolean(hashParams.get("type")) ||
      Boolean(hashParams.get("access_token")) ||
      Boolean(hashParams.get("refresh_token")) ||
      Boolean(hashParams.get("error")) ||
      Boolean(hashParams.get("error_code"));

    if (hasAuthRedirectInProgress) {
      console.log("[deep-link] skipped due to higher priority flow", {
        flow: "auth_redirect",
        requestedView: effectiveDeepLinkView,
      });
      return;
    }

    console.log(`[deep-link] ${effectiveDeepLinkView} opened from query param`);
    deepLinkViewPendingRef.current = null;
    goToView(effectiveDeepLinkView, { push: false, focus: false });
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        appView: effectiveDeepLinkView,
      },
      "",
      window.location.pathname,
    );
  }, [appView, authLoading, goToView, hydrated, isRecoveryFlow]);

  useEffect(() => {
    if (!user) {
      const savedRevenues = localStorage.getItem(GUEST_REVENUES_KEY);
      if (savedRevenues) {
        try {
          setRevenues(JSON.parse(savedRevenues));
        } catch (e) {
          console.error("Failed to load guest revenues:", e);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    setAssistantFieldError("");
  }, [stepIndex, appView]);

  const dashboardAnswers = useMemo(() => {
    const hasActivity =
      sanitizedAnswers?.activity_type || fiscalProfile?.activity_type;
    const hasFrequency =
      sanitizedAnswers?.declaration_frequency ||
      fiscalProfile?.declaration_frequency;

    if (!hasActivity && !hasFrequency) {
      return {
        activity_type: null,
        declaration_frequency: null,
        acre: null,
        business_start_date: sanitizedAnswers?.business_start_date || null,
      };
    }

    const rawActivityType =
      sanitizedAnswers?.activity_type || fiscalProfile?.activity_type || null;

    return {
      ...sanitizedAnswers,
      activity_type: rawActivityType ? normalizeActivityType(rawActivityType) : null,
      declaration_frequency:
        sanitizedAnswers?.declaration_frequency ||
        fiscalProfile?.declaration_frequency ||
        null,
      acre: sanitizedAnswers?.acre || fiscalProfile?.acre || null,
      business_start_date:
        sanitizedAnswers?.business_start_date ||
        fiscalProfile?.business_start_date ||
        null,
      acre_start_date:
        sanitizedAnswers?.acre_start_date || fiscalProfile?.acre_start_date || null,
    };
  }, [sanitizedAnswers, fiscalProfile]);

  const hasProfileCore =
    Boolean(dashboardAnswers?.activity_type) &&
    Boolean(dashboardAnswers?.declaration_frequency);
  const hasProfileAcreValue =
    dashboardAnswers?.acre !== undefined &&
    dashboardAnswers?.acre !== null &&
    dashboardAnswers?.acre !== "";
  const hasProfileStartDate = Boolean(dashboardAnswers?.business_start_date);
  const isProfileComplete =
    Boolean(dashboardAnswers?.activity_type) &&
    Boolean(dashboardAnswers?.declaration_frequency) &&
    hasProfileAcreValue &&
    hasProfileStartDate;
  const requiresAcreStartDate = dashboardAnswers?.acre === "yes";
  const isFiscalProfileComplete =
    hasProfileCore &&
    Boolean(dashboardAnswers?.business_start_date) &&
    (!requiresAcreStartDate || Boolean(dashboardAnswers?.acre_start_date));

  useEffect(() => {
    if (!hydrated || authLoading) return;
    if (appView === "dashboard") {
      setShowSimpleOnboarding(false);
      return;
    }
    if (hasProfileCore || fiscalProfile) {
      setShowSimpleOnboarding(false);
      return;
    }
    if (simpleAssistantProfile?.activity_type) {
      const normalizedStarterActivity = normalizeActivityType(
        simpleAssistantProfile.activity_type,
      );
      setAnswers((currentAnswers) =>
        sanitizeFiscalAnswers({
          ...currentAnswers,
          entry_status: currentAnswers.entry_status || "micro_yes",
          status: currentAnswers.status || "auto_entrepreneur",
          activity_type: normalizedStarterActivity,
          declaration_frequency:
            currentAnswers.declaration_frequency ||
            simpleAssistantProfile.declaration_frequency ||
            "mensuel",
          acre: currentAnswers.acre,
          business_start_date: currentAnswers.business_start_date || null,
          acre_start_date: currentAnswers.acre_start_date || null,
        }),
      );
      setShowSimpleOnboarding(false);
      return;
    }

    setShowSimpleOnboarding(true);
  }, [
    appView,
    authLoading,
    fiscalProfile,
    hasProfileCore,
    hydrated,
    simpleAssistantProfile?.activity_type,
  ]);

  useEffect(() => {
    if (simpleAssistantProfile?.tva_status) {
      setTvaConfigDraft(normalizeTvaConfigStatus(simpleAssistantProfile.tva_status));
    }
  }, [simpleAssistantProfile?.tva_status]);

  useEffect(() => {
    if (isFiscalProfileComplete && showFirstRevenueOnboarding) {
      setShowFirstRevenueOnboarding(false);
    }
  }, [isFiscalProfileComplete, showFirstRevenueOnboarding]);

  const shouldShowGuestLocalMessage = !user && (
    hasProfileCore ||
    revenues.length > 0 ||
    guestInvoices.length > 0
  );

  const currentMonthTotal = useMemo(() => {
    return revenues.reduce((sum, item) => {
      return sum + Number(item.amount || 0);
    }, 0);
  }, [revenues]);

  const mixedRevenueBreakdown = useMemo(() => {
    if (!isMixedActivityValue(dashboardAnswers?.activity_type)) {
      return null;
    }

    const venteTotal = revenues.reduce((sum, item) => {
      return item?.revenue_category === "vente"
        ? sum + Number(item.amount || 0)
        : sum;
    }, 0);
    const serviceTotal = revenues.reduce((sum, item) => {
      return item?.revenue_category === "service"
        ? sum + Number(item.amount || 0)
        : sum;
    }, 0);

    if (venteTotal <= 0 && serviceTotal <= 0) {
      return null;
    }

    return {
      venteTotal,
      serviceTotal,
    };
  }, [dashboardAnswers?.activity_type, revenues]);

  const computed = useMemo(() => {
    const normalizedActivityType = normalizeActivityTypeForCalculations(
      dashboardAnswers?.activity_type,
    );

    if (!hasProfileCore) {
      return {
        nextDeclarationLabel: "Profil à compléter",
        amountEstimatedLabel: "Pas encore assez de données",
        deadlineLabel: "Profil à compléter",
        tvaStatusLabel: "À confirmer",
        tvaHint: "Renseigne ton activité et ta périodicité",
        urgency: null,
        tvaUrgency: null,
        recommendations: [],
        treasuryRecommended: null,
        rate: null,
        acreStatus: null,
        acreHint: "Ajoute les informations clés du profil pour activer les estimations.",
        cfeAlert: null,
        financialHealth: null,
        financialHealthMessage: null,
        savingsRecommended: 0,
      };
    }

    if (!isFiscalProfileComplete) {
      return {
        nextDeclarationLabel: "Profil à compléter",
        amountEstimatedLabel: "Estimation en attente",
        deadlineLabel: "Complète ton profil fiscal",
        tvaStatusLabel: "À confirmer",
        tvaHint: "Complète ton profil fiscal pour obtenir des estimations fiables.",
        urgency: null,
        tvaUrgency: null,
        recommendations: [
          {
            key: "complete-profile",
            title: "Profil à compléter",
            text: "Ajoute ton début d’activité et, si besoin, la date ACRE pour fiabiliser tes repères.",
            level: "warning",
          },
        ],
        treasuryRecommended: null,
        rate: null,
        acreStatus: null,
        acreHint: "Le statut ACRE sera fiable après complétion du profil.",
        cfeAlert: null,
        financialHealth: null,
        financialHealthMessage: null,
        savingsRecommended: 0,
      };
    }

    try {
      const currentYear = new Date().getFullYear();

      const caYtd = revenues
        .filter(
          (r) => new Date(`${r.date}T00:00:00`).getFullYear() === currentYear,
        )
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const monthsWithData =
        new Set(
          revenues
            .filter(
              (r) =>
                new Date(`${r.date}T00:00:00`).getFullYear() === currentYear,
            )
            .map((r) => new Date(`${r.date}T00:00:00`).getMonth()),
        ).size || 1;

      return computeObligations({
        ...dashboardAnswers,
        activity_type: normalizedActivityType,
        ca_month: currentMonthTotal,
        ca_ytd: caYtd,
        months_with_data: monthsWithData,
      });
    } catch (error) {
      console.error("Compute error:", error);
      return {
        nextDeclarationLabel: "Erreur",
        amountEstimatedLabel: "Pas encore assez de données",
        deadlineLabel: "Pas encore assez de données",
        tvaStatusLabel: "Erreur",
        tvaHint: "Une erreur est survenue",
        urgency: null,
        tvaUrgency: null,
        recommendations: [],
        treasuryRecommended: null,
      };
    }
  }, [dashboardAnswers, currentMonthTotal, revenues, hasProfileCore, isFiscalProfileComplete]);

  const fiscalSummaryShadow = useMemo(() => {
    if (!FISCAL_SUMMARY_SHADOW_ENABLED || !hasProfileCore) {
      return null;
    }

    try {
      const shadowInput = buildFiscalSummaryInput({
        revenues,
        fiscalProfile: {
          activity_type: dashboardAnswers.activity_type,
          acre: dashboardAnswers.acre,
          acre_start_date: dashboardAnswers.acre_start_date,
          business_start_date: dashboardAnswers.business_start_date,
        },
        period: {},
        referenceDate: getTodayIsoDate(),
      });
      const shadowResult = calculateFiscalSummary(shadowInput, { trace: false });
      const legacySnapshot = {
        revenueTotal: currentMonthTotal,
        estimatedAmount: computed?.estimatedAmount,
        rate: computed?.rate,
        acreStatus: computed?.acreStatus,
      };
      const shadowParityEvidence = createRuntimeParityEvidence({
        scenarioId: "app.dashboard.first-slice",
        legacySnapshot,
        shadowResult,
        shadowInput,
        observedAt: shadowInput.referenceDate,
      });
      SHADOW_PARITY_EVIDENCE_STORE.record(shadowParityEvidence);

      void shadowParityEvidence;
      void shadowResult;

      return {
        shadowInput,
        shadowResult,
        shadowParityEvidence,
      };
    } catch {
      return null;
    }
  }, [
    dashboardAnswers.acre,
    dashboardAnswers.acre_start_date,
    dashboardAnswers.activity_type,
    computed?.acreStatus,
    computed?.estimatedAmount,
    computed?.rate,
    currentMonthTotal,
    hasProfileCore,
    revenues,
  ]);

  const activityLabel = useMemo(
    () => labelFromOptions("activity_type", dashboardAnswers.activity_type),
    [dashboardAnswers.activity_type],
  );

  const freqLabel = useMemo(
    () =>
      labelFromOptions(
        "declaration_frequency", // <- исправлено название
        dashboardAnswers.declaration_frequency,
      ),
    [dashboardAnswers.declaration_frequency],
  );
  const profileLine = useMemo(() => {
    const a = dashboardAnswers.activity_type ? activityLabel : "";
    const f = dashboardAnswers.declaration_frequency ? freqLabel : "";
    if (!a && !f) return "";
    if (a && f) return `${a} • ${f}`;
    return a || f;
  }, [
    dashboardAnswers.activity_type,
    dashboardAnswers.declaration_frequency,
    activityLabel,
    freqLabel,
  ]);
  const activityRole = useMemo(
    () => getActivityRole(dashboardAnswers.activity_type),
    [dashboardAnswers.activity_type],
  );
  const roleBasedTips = useMemo(
    () => ROLE_BASED_TIPS[activityRole] || ROLE_BASED_TIPS.default,
    [activityRole],
  );
  const authGreetingName = useMemo(() => {
    const metadataFirstName =
      user?.user_metadata?.first_name?.trim() ||
      user?.user_metadata?.full_name?.trim()?.split(" ")?.[0] ||
      "";
    const emailName = user?.email?.split("@")?.[0]?.trim() || "";
    return metadataFirstName || emailName;
  }, [user]);
  const topbarGreetingLabel =
    user && authGreetingName
      ? `Bonjour ${authGreetingName} 👋`
      : "Bonjour 👋";
  const trustBadgeLabel = user
    ? "🔒 Profil, revenus et historique sécurisés dans ton espace"
    : "🖥️ Test sans compte : données conservées sur cet appareil.";
  const connectedAccountLabel = user?.email?.trim() || "";
  const fiscalProfilePageMode = hasProfileCore
    ? assistantEditMode
      ? "edit"
      : "summary"
    : "create";
  const isFiscalProfileCreateMode = fiscalProfilePageMode === "create";
  const isFiscalProfileSummaryMode = fiscalProfilePageMode === "summary";
  const isFiscalProfileEditMode = fiscalProfilePageMode === "edit";
  const showProfileTargetedStep =
    isFiscalProfileEditMode && profileEditMode === "edit_step";
  const showCreateWizard = isFiscalProfileCreateMode && !assistantCollapsed;

  const canSend = useMemo(() => input.trim().length > 0, [input]);
  const canSubmitCurrentStep = useMemo(
    () => canSend && !assistantFieldError,
    [canSend, assistantFieldError],
  );

  // ==================== CALCULS POUR DASHBOARD ====================
  const estimatedCharges = useMemo(() => {
    if (computed?.rate) {
      return Math.round(currentMonthTotal * computed.rate);
    }
    return 0;
  }, [currentMonthTotal, computed?.rate]);

  const availableAmount = useMemo(() => {
    return Math.max(0, currentMonthTotal - estimatedCharges);
  }, [currentMonthTotal, estimatedCharges]);

  const fiscalSummaryVisibleSlice = useMemo(() => {
    const shadowResult = fiscalSummaryShadow?.shadowResult;
    const usesShadow =
      FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&
      Boolean(shadowResult);

    return {
      revenueTotal: usesShadow
        ? shadowResult.revenue.total
        : currentMonthTotal,
      baseAmount: usesShadow
        ? shadowResult.summary.baseAmount
        : currentMonthTotal,
      finalContributionAmount: usesShadow
        ? shadowResult.summary.finalContributionAmount
        : estimatedCharges,
      effectiveRate: usesShadow
        ? shadowResult.summary.effectiveRate
        : computed?.rate,
      acreStatus: usesShadow
        ? shadowResult.contributions.acre.acreStatus
        : computed?.acreStatus,
    };
  }, [
    computed?.acreStatus,
    computed?.rate,
    currentMonthTotal,
    estimatedCharges,
    fiscalSummaryShadow,
  ]);

  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================
  const revenueAmount = useMemo(() => {
    return Number(String(revenueForm.amount || "").replace(",", "."));
  }, [revenueForm.amount]);

  const previewCharges = useMemo(() => {
    if (!Number.isFinite(revenueAmount) || revenueAmount <= 0) return 0;
    const effectiveRate = getRevenueContributionRate(
      { revenue_category: revenueForm.revenue_category },
      dashboardAnswers.activity_type,
      computed?.rate,
    );
    return Math.round(revenueAmount * effectiveRate);
  }, [
    revenueAmount,
    revenueForm.revenue_category,
    computed?.rate,
    dashboardAnswers.activity_type,
  ]);

  const previewAvailable = useMemo(() => {
    if (!Number.isFinite(revenueAmount) || revenueAmount <= 0) return 0;
    return Math.max(0, revenueAmount - previewCharges);
  }, [revenueAmount, previewCharges]);

  const previewRateLabel = useMemo(() => {
    const effectiveRate = getRevenueContributionRate(
      { revenue_category: revenueForm.revenue_category },
      dashboardAnswers.activity_type,
      computed?.rate,
    );
    return `${Math.round(effectiveRate * 1000) / 10} %`;
  }, [revenueForm.revenue_category, computed?.rate, dashboardAnswers.activity_type]);

  const previewAdvice = useMemo(() => {
    if (!Number.isFinite(revenueAmount) || revenueAmount <= 0) return "";
    if (previewCharges === 0) {
      return "Ajoute un montant pour voir une estimation.";
    }
    if (previewCharges <= 50) {
      return "Petit revenu : garde ce repère simple pour éviter les oublis.";
    }
    if (previewCharges <= 300) {
      return "Pense à mettre ce montant de côté dès maintenant.";
    }
    return "Bon réflexe : sépare cette somme tout de suite pour éviter les surprises.";
  }, [revenueAmount, previewCharges]);

  const monthlyHistory = useMemo(() => {
    const map = {};

    revenues.forEach((item) => {
      if (!item?.date) return;

      const d = new Date(`${item.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;

      const key = `${d.getFullYear()}-${d.getMonth()}`;

      if (!map[key]) {
        map[key] = {
          year: d.getFullYear(),
          month: d.getMonth(),
          total: 0,
        };
      }

      map[key].total += Number(item.amount || 0);
    });

    return Object.values(map).sort((a, b) => {
      const da = new Date(a.year, a.month, 1);
      const db = new Date(b.year, b.month, 1);
      return db - da;
    });
  }, [revenues]);

  const monthOptions = useMemo(() => {
    return monthlyHistory.map((m) => {
      const date = new Date(m.year, m.month);
      return {
        value: `${m.year}-${m.month}`,
        label: date.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      };
    });
  }, [monthlyHistory]);

  const filteredRevenues = useMemo(() => {
    if (selectedMonth === "all") return revenues;

    return revenues.filter((item) => {
      if (!item?.date) return false;

      const d = new Date(`${item.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;

      return `${d.getFullYear()}-${d.getMonth()}` === selectedMonth;
    });
  }, [revenues, selectedMonth]);

  const revenueChartData = useMemo(() => {
    return monthlyHistory.slice().reverse().slice(-6);
  }, [monthlyHistory]);

  const maxRevenueValue = useMemo(() => {
    if (revenueChartData.length === 0) return 1;
    return Math.max(...revenueChartData.map((item) => item.total), 1);
  }, [revenueChartData]);

  const revenueStats = useMemo(() => {
    const count = revenues.length;

    const lastRevenue = count > 0 ? Number(revenues[0]?.amount || 0) : 0;

    const monthlyAverage =
      monthlyHistory.length > 0
        ? Math.round(
            monthlyHistory.reduce((sum, item) => sum + item.total, 0) /
              monthlyHistory.length,
          )
        : 0;

    return {
      count,
      lastRevenue,
      monthlyAverage,
    };
  }, [revenues, monthlyHistory]);
  const firstRevenueDate = useMemo(() => {
    return revenues
      .map((item) => parseIsoDate(item?.date))
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime())[0] || null;
  }, [revenues]);
  const daysSinceFirstRevenue = useMemo(() => {
    if (!firstRevenueDate) return 0;

    return Math.max(
      0,
      Math.floor(
        (Date.now() - firstRevenueDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
  }, [firstRevenueDate]);
  const shouldShowAnnualProjection =
    revenues.length >= 5 && daysSinceFirstRevenue >= 7;
  const hasEarlyRevenueData = revenues.length < 5;
  const dashboardConfidence = useMemo(() => {
    if (revenues.length <= 1) {
      return {
        tone: "warning",
        label: "Estimation selon ton activité",
      };
    }

    if (revenues.length < 3) {
      return {
        tone: "warning",
        label: "Fiabilité en apprentissage",
      };
    }

    if (revenues.length < 7 || !isFiscalProfileComplete) {
      return {
        tone: "neutral",
        label: "Estimation de plus en plus fiable",
      };
    }

    return {
      tone: "success",
      label: "Haute fiabilité selon ton activité",
    };
  }, [isFiscalProfileComplete, revenues.length]);
  const chargesEstimateHelper = hasEarlyRevenueData
    ? "Estimation provisoire sur peu de données."
    : "Estimation basée sur ton activité.";
  const availableEstimateHelper = hasEarlyRevenueData
    ? "Disponible provisoire après estimation des charges."
    : "Disponible après charges estimées.";
  const annualProjectionHelper = ANALYSIS_COPY.projectionTrendHelper;
  const tvaStatusHelper = FISCAL_MARKERS_COPY.tva.getHint({
    status: computed?.tvaStatus,
    hasEarlyRevenueData,
    fallbackHint: computed?.tvaHint,
  });
  const fiscalScoreHelper = SCORE_COPY.getHelper({
    hasEarlyRevenueData,
    revenueCount: revenues.length,
  });
  const normalizedTvaStatusLabel = useMemo(() => {
    if (!computed?.tvaStatusLabel) return "À confirmer";
    if (!isFiscalProfileComplete) return computed.tvaStatusLabel;
    if (computed?.tvaStatus === "exceeded" || computed?.tvaStatus === "soon") {
      return computed.tvaStatusLabel;
    }

    return revenues.length < 5 ? "TVA sous seuil" : "Franchise TVA OK";
  }, [
    computed?.tvaStatus,
    computed?.tvaStatusLabel,
    isFiscalProfileComplete,
    revenues.length,
  ]);
  const profileConfirmationTvaLabel = useMemo(() => {
    const starterTvaStatus = normalizeTvaConfigStatus(
      simpleAssistantProfile?.tva_status ||
        answers.tva_status ||
        dashboardAnswers.tva_status,
    );

    if (starterTvaStatus !== "unknown") {
      return getTvaConfigLabel(starterTvaStatus);
    }

    return "À confirmer";
  }, [
    answers.tva_status,
    dashboardAnswers.tva_status,
    simpleAssistantProfile?.tva_status,
  ]);
  const savedTvaValue = useMemo(() => {
    const normalizedStatus = normalizeTvaConfigStatus(
      simpleAssistantProfile?.tva_status ||
        answers.tva_status ||
        dashboardAnswers.tva_status,
    );
    const isExplicitlyConfigured =
      simpleAssistantProfile?.tva_configured === true ||
      normalizedStatus === "franchise" ||
      normalizedStatus === "active";

    return isExplicitlyConfigured ? normalizedStatus : "";
  }, [
    answers.tva_status,
    dashboardAnswers.tva_status,
    simpleAssistantProfile?.tva_configured,
    simpleAssistantProfile?.tva_status,
  ]);
  const savedTvaLabel = savedTvaValue
    ? savedTvaValue === "unknown"
      ? "À confirmer"
      : getTvaConfigLabel(savedTvaValue)
    : "";
  const confidenceHelperText = dashboardConfidence.label;
  const dashboardMilestone = useMemo(() => {
    if (revenues.length >= 10) {
      return "🏆 Dashboard haute fiabilité";
    }

    if (revenues.length >= 5) {
      return "🧠 Projection annuelle activée";
    }

    if (revenues.length >= 3) {
      return "📈 Estimation plus fiable";
    }

    if (revenues.length >= 1) {
      return "🎉 Premier revenu enregistré";
    }

    return "";
  }, [revenues.length]);
  const hasConfiguredReminders = useMemo(() => {
    const hasPersistedLocalPrefs = (() => {
      try {
        return Boolean(localStorage.getItem(REMINDER_PREFS_KEY));
      } catch {
        return false;
      }
    })();

    const hasPersistedProfilePrefs = Boolean(
      fiscalProfile &&
        [
          fiscalProfile.reminder_declaration,
          fiscalProfile.reminder_tva,
          fiscalProfile.reminder_cfe,
          fiscalProfile.reminder_acre,
          fiscalProfile.reminder_email,
          fiscalProfile.reminder_sms,
        ].some((value) => value === true),
    );

    return hasPersistedLocalPrefs || hasPersistedProfilePrefs;
  }, [fiscalProfile]);
  const visibleInvoices = user ? [...guestInvoices, ...invoices] : guestInvoices;
  const unifiedStarterProfile = useMemo(
    () => ({
      activity_type:
        normalizeActivityType(
          dashboardAnswers?.activity_type ||
            simpleAssistantProfile?.activity_type ||
            "services",
        ),
      monthly_revenue: simpleAssistantProfile?.monthly_revenue ?? null,
      tva_status: normalizeTvaConfigStatus(simpleAssistantProfile?.tva_status),
      // LOT 10.1B: carry the same ACRE/date fields the dashboard reads from
      // dashboardAnswers, so the onboarding estimate can apply ACRE like the
      // dashboard does instead of silently ignoring it.
      acre: dashboardAnswers?.acre ?? null,
      acre_start_date: dashboardAnswers?.acre_start_date ?? null,
      business_start_date: dashboardAnswers?.business_start_date ?? null,
    }),
    [
      dashboardAnswers?.activity_type,
      dashboardAnswers?.acre,
      dashboardAnswers?.acre_start_date,
      dashboardAnswers?.business_start_date,
      simpleAssistantProfile?.activity_type,
      simpleAssistantProfile?.monthly_revenue,
      simpleAssistantProfile?.tva_status,
    ],
  );
  const simpleAssistantGuidance = useMemo(
    () =>
      buildSimpleAssistantGuidance({
        profile: unifiedStarterProfile,
        realMonthlyRevenue: currentMonthTotal,
        hasRealRevenue: revenues.length > 0,
      }),
    [currentMonthTotal, revenues.length, unifiedStarterProfile],
  );
  const cockpitEstimate = useMemo(() => {
    const starterRevenue =
      simpleAssistantProfile?.starter_monthly_revenue ??
      simpleAssistantProfile?.monthly_revenue ??
      null;
    const hasRealRevenue = revenues.length > 0;
    const hasStarterRevenue =
      starterRevenue !== null &&
      starterRevenue !== undefined &&
      starterRevenue !== "" &&
      Number(starterRevenue) > 0;
    const baseRevenue = hasRealRevenue
      ? currentMonthTotal
      : hasStarterRevenue
        ? Number(starterRevenue) || 0
        : null;
    const rate =
      typeof computed?.rate === "number" && computed.rate > 0
        ? computed.rate
        : getEstimatedRate(dashboardAnswers.activity_type);

    if (baseRevenue === null) {
      return {
        hasEstimate: false,
        isProvisional: false,
        revenue: null,
        charges: null,
        available: null,
      };
    }

    const charges = Math.round(baseRevenue * rate);
    return {
      hasEstimate: true,
      isProvisional: !hasRealRevenue && hasStarterRevenue,
      revenue: baseRevenue,
      charges,
      available: Math.max(0, baseRevenue - charges),
    };
  }, [
    computed?.rate,
    currentMonthTotal,
    dashboardAnswers.activity_type,
    revenues.length,
    simpleAssistantProfile?.monthly_revenue,
    simpleAssistantProfile?.starter_monthly_revenue,
  ]);
  const hasRevenueData = revenues.length > 0;
  const hasLowDataProfile =
    !hasRevenueData && simpleAssistantProfile?.data_quality === "low_data";
  const hasDashboardValueForUpgrade =
    hasRevenueData || cockpitEstimate.hasEstimate;
  const hasAnyDashboardData = hasDashboardValueForUpgrade;
  const shouldShowDashboardPremiumValue =
    Boolean(hasProfileCore || simpleAssistantProfile) &&
    hasDashboardValueForUpgrade;
  const estimateHelperText =
    "Les estimations deviennent plus fiables après quelques revenus";
  const provisionalCaHelperText =
    "Estimation provisoire basée sur ton CA estimé";
  const dashboardEmptyDataMessage = hasRevenueData
    ? ""
    : "Ajoute ton premier revenu";
  const dashboardQuietPlaceholder = "À compléter";
  const dashboardRevenueDisplay = hasRevenueData
    ? getDisplayValue(fiscalSummaryVisibleSlice.revenueTotal, "money")
    : cockpitEstimate.isProvisional
      ? `${getDisplayValue(cockpitEstimate.revenue, "money")} estimés`
      : hasLowDataProfile
        ? dashboardQuietPlaceholder
      : "Ajoute ton premier revenu";
  const dashboardChargesDisplay = hasLowDataProfile
    ? dashboardQuietPlaceholder
    : hasAnyDashboardData
    ? getDisplayValue(
        cockpitEstimate.isProvisional
          ? cockpitEstimate.charges
          : fiscalSummaryVisibleSlice.finalContributionAmount,
        "money",
      )
    : dashboardQuietPlaceholder;
  const dashboardAvailableDisplay = hasLowDataProfile
    ? dashboardQuietPlaceholder
    : hasAnyDashboardData
    ? getDisplayValue(
        cockpitEstimate.hasEstimate ? cockpitEstimate.available : availableAmount,
        "money",
      )
    : dashboardQuietPlaceholder;
  const reliabilityBadge = useMemo(() => {
    if (revenues.length === 0) return { percent: 20, label: "Démarrage" };
    if (revenues.length <= 2) return { percent: 40, label: "Premières données" };
    if (revenues.length <= 4) return { percent: 65, label: "En progression" };
    return { percent: 85, label: "Bonne base" };
  }, [revenues.length]);
  const dashboardChecklistItems = useMemo(
    () => [
      {
        key: "first_revenue",
        label: "Premier revenu ajouté",
        completed: revenues.length > 0,
      },
      {
        key: "fiscal_profile",
        label: "Profil fiscal complété",
        completed: isFiscalProfileComplete,
      },
      {
        key: "first_invoice",
        label: "Première facture créée",
        completed: visibleInvoices.length > 0,
      },
      {
        key: "free_account",
        label: "Compte gratuit créé",
        completed: Boolean(user),
      },
      {
        key: "reminders",
        label: "Rappels activés",
        completed: hasConfiguredReminders,
      },
    ],
    [
      hasConfiguredReminders,
      isFiscalProfileComplete,
      revenues.length,
      user,
      visibleInvoices.length,
    ],
  );
  const completedChecklistSteps = dashboardChecklistItems.filter(
    (item) => item.completed,
  ).length;
  const shouldShowDashboardChecklist = completedChecklistSteps < 5;
  const dashboardLearningProgress = useMemo(() => {
    if (revenues.length === 0 || revenues.length >= 5) return null;

    const current = Math.min(revenues.length, 5);
    const percent = Math.round((current / 5) * 100);

    return { current, percent };
  }, [revenues.length]);
  const trackingMaturityPercent = Math.min((revenues.length / 5) * 100, 100);
  const trackingMaturityRevenuesLeft = Math.max(5 - revenues.length, 0);
  const trackingMaturityHelperText = MATURITY_COPY.getHelper(
    trackingMaturityRevenuesLeft,
  );
  const dashboardMaturityLevel = useMemo(() => {
    const hasTrackedExpenses = Number(computed?.monthlyExpenses || 0) > 0;
    const hasInvoiceTracking = visibleInvoices.length > 0;
    const hasEnoughReliableData = isFiscalProfileComplete && revenues.length >= 5;

    if (
      isFiscalProfileComplete &&
      revenues.length >= 7 &&
      (hasTrackedExpenses || hasInvoiceTracking) &&
      hasConfiguredReminders
    ) {
      return {
        level: "Suivi avancé",
        tone: "success",
        text: "Ton suivi est déjà complet et utile au quotidien.",
      };
    }

    if (hasEnoughReliableData) {
      return {
        level: "Suivi fiable",
        tone: "success",
        text: "Tes estimations deviennent stables et plus utiles.",
      };
    }

    if (isFiscalProfileComplete && revenues.length >= 2) {
      return {
        level: "En progrès",
        tone: "neutral",
        text: "Le tableau de bord devient plus parlant à mesure que tu l’alimentes.",
      };
    }

    return {
      level: "Démarrage",
      tone: "warning",
      text: "Les premiers repères sont en place. Encore un peu d’activité et le suivi gagnera vite en précision.",
    };
  }, [
    computed?.monthlyExpenses,
    hasConfiguredReminders,
    isFiscalProfileComplete,
    revenues.length,
    visibleInvoices.length,
  ]);
  const dashboardTrustState = useMemo(() => {
    if (!isFiscalProfileComplete && revenues.length > 0) {
      return {
        icon: "🛡️",
        text:
          "Tes revenus sont bien enregistrés. Les calculs liés au profil resteront partiels tant qu’il n’est pas complété.",
      };
    }

    if (revenues.length < 5) {
      return {
        icon: "🛡️",
        text:
          "Le mois en cours devient lisible. Les repères longs se précisent avec plus d’activité.",
      };
    }

    if (
      dashboardMaturityLevel.level === "En progrès" ||
      dashboardMaturityLevel.level === "Suivi fiable"
    ) {
      return {
        icon: "🛡️",
        text:
          "Ton suivi devient fiable pour piloter le mois.",
      };
    }

    return {
      icon: "🛡️",
      text: "Tes repères mensuels sont bien installés.",
    };
  }, [dashboardMaturityLevel.level, isFiscalProfileComplete, revenues.length]);

  const fiscalTimeline = useMemo(() => {
    return [
      {
        key: "declaration",
        icon: "📅",
        label: FISCAL_MARKERS_COPY.declaration.label,
        value:
          computed?.nextDeclarationLabel ||
          FISCAL_MARKERS_COPY.declaration.fallbackValue,
        hint:
          computed?.deadlineLabel || FISCAL_MARKERS_COPY.declaration.fallbackHint,
        action:
          !hasProfileCore ||
          computed?.nextDeclarationLabel === "Profil à compléter" ||
          computed?.deadlineLabel === "Complète ton profil fiscal"
            ? {
                label: "Compléter mon profil",
                onClick: handleEditProfile,
              }
            : null,
      },
      {
        key: "charges",
        icon: "💰",
        label: FISCAL_MARKERS_COPY.charges.label,
        value: isFiscalProfileComplete
          ? dashboardChargesDisplay
          : FISCAL_MARKERS_COPY.charges.profileIncompleteValue,
        hint:
          isFiscalProfileComplete
            ? revenues.length > 0
              ? FISCAL_MARKERS_COPY.charges.withRevenueHint
              : FISCAL_MARKERS_COPY.charges.withoutRevenueHint
            : FISCAL_MARKERS_COPY.charges.incompleteHint,
        action: !isFiscalProfileComplete
          ? {
              label: "Compléter mon profil",
              onClick: handleEditProfile,
            }
          : null,
      },
      {
        key: "tva",
        icon: "🧾",
        label: FISCAL_MARKERS_COPY.tva.label,
        value: normalizedTvaStatusLabel || FISCAL_MARKERS_COPY.tva.fallbackValue,
        hint: tvaStatusHelper,
        action:
          !normalizedTvaStatusLabel || normalizedTvaStatusLabel === "À confirmer"
            ? {
                label: "Configurer la TVA",
                onClick: handleOpenTvaConfiguration,
              }
            : null,
      },
    ];
  }, [
    computed,
    dashboardChargesDisplay,
    handleEditProfile,
    hasProfileCore,
    isFiscalProfileComplete,
    normalizedTvaStatusLabel,
    revenues.length,
    tvaStatusHelper,
  ]);
  const smartAlertEstimatedCharges =
    fiscalSummaryVisibleSlice.finalContributionAmount;
  const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
  const smartAlerts = useMemo(
    () =>
      buildSmartAlerts({
        computed,
        revenues,
        invoices: visibleInvoices,
        reminderPrefs,
        estimatedCharges: smartAlertEstimatedCharges,
        currentMonthTotal: smartAlertRevenueTotal,
      }),
    [
      computed,
      revenues,
      visibleInvoices,
      reminderPrefs,
      smartAlertEstimatedCharges,
      smartAlertRevenueTotal,
    ],
  );
  const smartPriorities = useMemo(() => {
    return buildSmartPriorities({
      ...computed,
      recommendedReserve: availableAmount,
    });
  }, [availableAmount, computed]);
  const premiumTriggerContext = useMemo(
    () =>
      getPremiumTriggerContext({
        computed,
        smartPriorities,
        trialDaysLeft,
        isEarlyAccessEndingToday,
        isPostEarlyAccessTrial,
      }),
    [
      computed,
      smartPriorities,
      trialDaysLeft,
      isEarlyAccessEndingToday,
      isPostEarlyAccessTrial,
    ],
  );

  // LOT 10.2B shadow integration: computes the canonical obligation/action
  // priority model alongside the legacy urgency systems above and records
  // parity evidence. Read-only -- does not affect fiscalSummaryShadow,
  // smartAlerts, smartPriorities, premiumTriggerContext, or any rendered UI.
  useMemo(() => {
    if (!ACTION_PRIORITY_SHADOW_ENABLED || !hasProfileCore || !fiscalSummaryShadow) {
      return null;
    }

    try {
      const prioritizedActions = getPrioritizedActions({
        fiscalProfile: {
          activity_type: dashboardAnswers.activity_type,
          acre: dashboardAnswers.acre,
          acre_start_date: dashboardAnswers.acre_start_date,
          business_start_date: dashboardAnswers.business_start_date,
          declaration_frequency: dashboardAnswers.declaration_frequency,
        },
        revenues,
        referenceDate: getTodayIsoDate(),
      });
      const actionPriorityLegacySnapshot = buildLegacyActionPrioritySnapshot({
        computed,
        premiumTriggerContext,
      });
      const actionPriorityCanonicalSnapshot = buildCanonicalActionPrioritySnapshot(prioritizedActions);
      const actionPriorityParityEvidence = createActionPriorityParityEvidence({
        scenarioId: "app.dashboard.action-priority",
        legacyActionSnapshot: actionPriorityLegacySnapshot,
        canonicalActionSnapshot: actionPriorityCanonicalSnapshot,
        observedAt: getTodayIsoDate(),
      });
      ACTION_PRIORITY_PARITY_EVIDENCE_STORE.record(actionPriorityParityEvidence);

      return { prioritizedActions, actionPriorityParityEvidence };
    } catch {
      return null;
    }
  }, [
    dashboardAnswers.activity_type,
    dashboardAnswers.acre,
    dashboardAnswers.acre_start_date,
    dashboardAnswers.business_start_date,
    dashboardAnswers.declaration_frequency,
    revenues,
    hasProfileCore,
    fiscalSummaryShadow,
    computed,
    premiumTriggerContext,
  ]);

  const sessionTriggerKey = premiumTriggerContext?.triggerType
    ? `microassist_premium_trigger_session_${premiumTriggerContext.triggerType}`
    : null;
  const smartPrioritiesCountLimit =
    accessProfile?.features?.smart_priorities_count === "all"
      ? "all"
      : typeof accessProfile?.features?.smart_priorities_count === "number"
        ? accessProfile.features.smart_priorities_count
        : 0;
  const visibleSmartPriorities =
    smartPrioritiesCountLimit === "all"
      ? smartPriorities
      : smartPriorities.slice(0, Math.max(0, smartPrioritiesCountLimit));
  const hasLockedSmartPriorities =
    smartPrioritiesCountLimit !== "all" &&
    smartPriorities.length > Math.max(0, smartPrioritiesCountLimit);
  useEffect(() => {
    console.info("[smart-priorities]", smartPriorities);
  }, [smartPriorities]);
  useEffect(() => {
    console.info("[premium-gating]", {
      billingUiState,
      isEarlyFullAccess,
      hasPremiumLikeAccess,
      smartPrioritiesCount: smartPriorities.length,
    });
  }, [
    billingUiState,
    hasPremiumLikeAccess,
    isEarlyFullAccess,
    smartPriorities.length,
  ]);
  useEffect(() => {
    console.info("[access-profile]", {
      accessProfileKey,
      accessProfile,
    });
  }, [accessProfile, accessProfileKey]);
  useEffect(() => {
    console.info("[access-gating]", {
      accessProfileKey,
      features: accessProfile?.features,
    });
  }, [accessProfile?.features, accessProfileKey]);
  useEffect(() => {
    if (!isEarlyFullAccess) return;
    console.info("[early-access] active");
  }, [isEarlyFullAccess]);
  useEffect(() => {
    if (isGuest) {
      console.info("[early-access-ui] guest");
      return;
    }

    if (isEarlyAccessEndingToday) {
      console.info("[early-access-ui] ending-today");
      return;
    }

    if (isEarlyFullAccess) {
      console.info("[early-access-ui] discovery");
      return;
    }

    if (isPostEarlyAccessTrial) {
      console.info("[early-access-ui] post-discovery-trial");
    }
  }, [
    isEarlyAccessEndingToday,
    isEarlyFullAccess,
    isGuest,
    isPostEarlyAccessTrial,
  ]);
  useEffect(() => {
    console.info("[founder]", isFounder);
  }, [isFounder]);
  const smartTipsZoneClass = smartAlerts.some(
    (alert) => alert.level === "danger" || alert.level === "warning",
  )
    ? "dashboardSectionZone dashboardSectionZoneAmber"
    : "dashboardSectionZone dashboardSectionZoneSuccess";
  const savingsProgress = useMemo(() => {
    // Épargne actuelle = disponible estimé
    return availableAmount;
  }, [availableAmount]);
  const fiscalCoachingSavingsGoal = Math.max(
    fiscalSummaryVisibleSlice.finalContributionAmount * 3,
    500,
  );
  const pdfSavingsGoal = Math.max(
    fiscalSummaryVisibleSlice.finalContributionAmount * 3,
    500,
  );
  const fiscalCoachingCard = useMemo(() => {
    const smartAlertIds = new Set(smartAlerts.map((alert) => alert.id));
    const sortedRevenueDates = revenues
      .map((item) => parseIsoDate(item?.date))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());
    const latestRevenueDate = sortedRevenueDates[0] || null;
    const previousRevenueDate = sortedRevenueDates[1] || null;

    if (latestRevenueDate && previousRevenueDate) {
      const gapDays = Math.ceil(
        (latestRevenueDate.getTime() - previousRevenueDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (revenues.length >= 2 && gapDays >= 45) {
        return {
          text: roleBasedTips.dailyFiscalTip.irregularRevenue,
          cta: DAILY_FISCAL_TIP_COPY.irregularRevenueCta,
          onClick: handleOpenRevenuePopup,
        };
      }
    }

    if (
      !smartAlertIds.has("tva-threshold") &&
      (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded")
    ) {
      return {
        text: roleBasedTips.dailyFiscalTip.tvaWatch,
        cta: DAILY_FISCAL_TIP_COPY.tvaWatchCta,
        onClick: () => openExplanationModal("tva"),
      };
    }

    if (
      isFiscalProfileComplete &&
      revenues.length > 0 &&
      Number(computed?.monthlyExpenses || 0) === 0
    ) {
        return {
          text: roleBasedTips.dailyFiscalTip.missingExpenses,
          helperStyle: true,
        };
      }

    if (computed?.urgency === "late" || computed?.urgency === "soon") {
        return {
          text: roleBasedTips.dailyFiscalTip.deadline,
          cta: DAILY_FISCAL_TIP_COPY.deadlineCta,
          onClick: () => openReminderManager("coaching_deadline"),
        };
      }

    // LOT 5.79A coaching boundary: source-only denominator migration.
    if (
      !smartAlertIds.has("reserve-low") &&
      fiscalCoachingSavingsGoal > 0 &&
      savingsProgress < fiscalCoachingSavingsGoal * 0.35
    ) {
      return {
        text: roleBasedTips.dailyFiscalTip.lowReserve,
      };
    }

    if (
      !smartAlertIds.has("acre-ending") &&
      computed?.acreStatus === "active" &&
      computed?.acreEndDate
    ) {
      // LOT 10.1D: derives from the canonical, reform-aware acreEndDate
      // (computed via computeObligations) instead of independently
      // recomputing a flat +12-month guess from acre_start_date.
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - parseIsoDate(getTodayIsoDate()).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysLeft > 0 && daysLeft <= 90) {
        return {
          text: roleBasedTips.dailyFiscalTip.acreEnding,
        };
      }
    }

    if (!user && revenues.length >= 3) {
      return {
        text: roleBasedTips.dailyFiscalTip.guestHistory,
        cta: DAILY_FISCAL_TIP_COPY.guestHistoryCta,
        onClick: () => openAuthModal("signup"),
      };
    }

    if (revenues.length > 0 && visibleInvoices.length === 0) {
      return {
        text: roleBasedTips.dailyFiscalTip.firstInvoice,
        cta: DAILY_FISCAL_TIP_COPY.firstInvoiceCta,
        onClick: handleOpenInvoiceGenerator,
      };
    }

    return null;
  }, [
    smartAlerts,
    revenues,
    computed,
    isFiscalProfileComplete,
    fiscalCoachingSavingsGoal,
    savingsProgress,
    dashboardAnswers,
    user,
    visibleInvoices.length,
    roleBasedTips,
    handleOpenRevenuePopup,
    handleOpenInvoiceGenerator,
    openAuthModal,
    openExplanationModal,
  ]);
  const isHelperStyledCoachingCard = Boolean(fiscalCoachingCard?.helperStyle);
  const dashboardNextStep = useMemo(() => {
    if (revenues.length === 0) {
      return {
        title: "Action recommandée",
        text: "Ajoute ton premier revenu pour débloquer un suivi fiscal concret et des repères plus utiles.",
        cta: "Ajoute ton premier revenu",
        onClick: handleOpenRevenuePopup,
      };
    }

    if (revenues.length > 0 && !isFiscalProfileComplete) {
      return {
        title: "Profil encore partiel",
        text: "Tes revenus sont bien pris en compte, mais les calculs liés au profil restent partiels tant que celui-ci n’est pas complété.",
        cta: "Compléter mon profil fiscal",
        onClick: handleEditProfile,
      };
    }

    if (!user && (revenues.length > 0 || guestInvoices.length > 0)) {
      return null;
    }

    if (billingUiState === "trial_active") {
      return {
        title: "Phase de test active",
        text: "Ton compte te permet déjà de retrouver ton espace. Les rappels email restent accessibles gratuitement pendant la phase de test.",
        cta: "Gérer mes rappels",
        onClick: () => openPremiumModal("dashboard_next_step_trial"),
      };
    }

    return null;
  }, [
    guestInvoices.length,
    handleEditProfile,
    handleOpenRevenuePopup,
    billingUiState,
    isFiscalProfileComplete,
    openAuthModal,
    revenues.length,
    user,
  ]);
  const dashboardPrimaryAction = useMemo(() => {
    if (dashboardNextStep) return dashboardNextStep;

    if (isFiscalProfileComplete) {
      return {
        title: "Continuer le suivi",
        text: "Le moyen le plus simple de garder ton cockpit utile est d’ajouter régulièrement un nouveau revenu.",
        cta: "Ajouter un revenu",
        onClick: handleOpenRevenuePopup,
      };
    }

    return null;
  }, [dashboardNextStep, handleOpenRevenuePopup, isFiscalProfileComplete]);
  const dashboardRecommendation = useMemo(() => {
    if (computed?.tvaStatus === "exceeded" || computed?.tvaStatus === "soon") {
      return {
        title:
          computed?.tvaStatus === "exceeded"
            ? "TVA active : prochaine étape"
            : "TVA proche : rester vigilant",
        text:
          computed?.tvaStatus === "exceeded"
            ? "Ton activité demande maintenant une action concrète pour préparer la facturation TVA et la suite déclarative."
            : "Ton activité approche d’une zone où un simple contrôle TVA permet de rester serein.",
        cta: "Voir le diagnostic",
        onClick: () => setShowTVADiagnosticModal(true),
      };
    }

    if (revenues.length > 0 && visibleInvoices.length === 0) {
      return {
        title: "Première facture à poser",
        text: "Une facture rend le suivi plus clair pour tes clients, tes encaissements et la lecture TVA à venir.",
        cta: "Créer une facture",
        onClick: handleOpenInvoiceGenerator,
      };
    }

    if (!user && (revenues.length > 0 || guestInvoices.length > 0)) {
      return null;
    }

    if (revenues.length > 0 && revenues.length < 3) {
      return {
        title: "Fiabilise tes repères",
        text: "Ajoute encore quelques revenus pour rendre les estimations plus stables et plus utiles.",
        cta: "Ajouter un revenu",
        onClick: handleOpenRevenuePopup,
      };
    }

    if (billingUiState === "trial_active") {
      return dashboardNextStep?.cta === "Gérer mes rappels"
        ? null
        : {
            title: "Pendant la phase de test",
            text: "Teste les rappels email, les exports et l’historique avant l’arrivée des options avancées.",
            cta: "Gérer mes rappels",
            onClick: () => openPremiumModal("dashboard_recommendation_premium"),
          };
    }

    return null;
  }, [
    computed?.tvaStatus,
    dashboardNextStep?.cta,
    guestInvoices.length,
    handleOpenInvoiceGenerator,
    handleOpenRevenuePopup,
    billingUiState,
    openAuthModal,
    revenues.length,
    user,
    visibleInvoices.length,
  ]);
  const dashboardLaunchAnchors = useMemo(() => {
    const anchors = [];

    if (isQaPremium) {
      anchors.push({
        key: "qa",
        tone: "accent",
        label: "Premium QA",
        text: "Mode de test local activé",
      });
    }

    if (saveNotice) {
      anchors.push({
        key: "saved",
        tone: "success",
        label: "Profil sauvé",
        text:
          typeof saveNotice === "string"
            ? saveNotice
            : saveNotice.title || "Modifications enregistrées",
      });
    }

    return anchors;
  }, [isQaPremium, saveNotice]);
  const dashboardFloatingAction = useMemo(() => {
    if (dashboardPrimaryAction) return dashboardPrimaryAction;

    if (isFiscalProfileComplete) {
      return {
        cta: "Ajouter un revenu",
        onClick: handleOpenRevenuePopup,
      };
    }

    return null;
  }, [dashboardPrimaryAction, handleOpenRevenuePopup, isFiscalProfileComplete]);
  const activeReminderItems = useMemo(() => {
    const items = [];
    const reminderChannel =
      reminderPrefs.sms && hasSmsPremiumAccess
        ? "Email + SMS"
        : reminderPrefs.email
          ? "Email"
          : "Canal à activer";

    if (
      reminderPrefs.declaration &&
      computed?.deadlineLabel &&
      computed.deadlineLabel !== "—" &&
      computed.deadlineLabel !== "Profil à compléter" &&
      computed.deadlineLabel !== "Complète ton profil fiscal"
    ) {
      items.push({
        key: "declaration",
        title: "Déclaration URSSAF",
        text: computed.deadlineLabel,
        urgent: computed?.urgency === "late" || computed?.urgency === "soon",
        channel: reminderChannel,
        actions: [
          {
            label: "Déclarer",
            kind: "link",
            href: "https://autoentrepreneur.urssaf.fr",
          },
          {
            label: "Configurer",
            kind: "button",
            onClick: () => openReminderManager("reminder_declaration"),
          },
        ],
      });
    }

    if (
      reminderPrefs.tva &&
      (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded")
    ) {
      items.push({
        key: "tva",
        title: "TVA",
        text:
          computed?.tvaStatus === "exceeded"
            ? "Seuil TVA dépassé"
            : "Seuil TVA à surveiller",
        urgent: true,
        channel: reminderChannel,
        actions: [
          {
            label: "Voir le diagnostic",
            kind: "button",
            onClick: () => setShowTVADiagnosticModal(true),
          },
          {
            label: "Comprendre",
            kind: "button",
            onClick: () => openExplanationModal("tva"),
          },
        ],
      });
    }

    if (reminderPrefs.cfe && computed?.cfeAlert?.show) {
      items.push({
        key: "cfe",
        title: "CFE",
        text: "🏛️ Rappel CFE actif",
        urgent: true,
        channel: reminderChannel,
        actions: [
          {
            label: "Comprendre",
            kind: "button",
            onClick: () => openExplanationModal("cfe"),
          },
          {
            label: "Configurer",
            kind: "button",
            onClick: () => openReminderManager("reminder_cfe"),
          },
        ],
      });
    }

    if (reminderPrefs.cfe && !computed?.cfeAlert?.show) {
      items.push({
        key: "cfe",
        title: "CFE",
        text: "🏛️ Rappel CFE actif",
        urgent: false,
        channel: reminderChannel,
        actions: [
          {
            label: "Comprendre",
            kind: "button",
            onClick: () => openExplanationModal("cfe"),
          },
          {
            label: "Configurer",
            kind: "button",
            onClick: () => openReminderManager("reminder_cfe"),
          },
        ],
      });
    }

    if (reminderPrefs.acre && computed?.acreStatus === "active" && computed?.acreEndDate) {
      // LOT 10.1D: canonical, reform-aware acreEndDate (computeObligations)
      // instead of an independent flat +12-month guess from acre_start_date.
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      if (daysLeft > 0 && daysLeft <= 90) {
        const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
        items.push({
          key: "acre",
          title: "Fin ACRE",
          text: `Fin estimée dans ${monthsLeft} mois.`,
          urgent: true,
          channel: reminderChannel,
          actions: [
            {
              label: "Comprendre",
              kind: "button",
              onClick: () => openExplanationModal("acre"),
            },
            {
              label: "Modifier mon profil",
              kind: "button",
              onClick: () => handleEditProfile(),
            },
            {
              label: "Configurer",
              kind: "button",
              onClick: () => openReminderManager("reminder_acre"),
            },
          ],
        });
      } else if (daysLeft > 90) {
        const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
        items.push({
          key: "acre-active",
          title: "ACRE active",
          text: `Fin estimée dans ${monthsLeft} mois.`,
          urgent: false,
          channel: reminderChannel,
          actions: [
            {
              label: "Comprendre",
              kind: "button",
              onClick: () => openExplanationModal("acre"),
            },
            {
              label: "Modifier mon profil",
              kind: "button",
              onClick: () => handleEditProfile(),
            },
          ],
        });
      }
    }

    if (reminderPrefs.email || (reminderPrefs.sms && hasSmsPremiumAccess)) {
      items.push({
        key: "channel",
        title: "Canal",
        text: reminderChannel,
        urgent: false,
        channel: reminderChannel,
        actions: [
          {
            label: "Configurer",
            kind: "button",
            onClick: () => openReminderManager("reminder_channel"),
          },
        ],
      });
    }

    return items;
  }, [
    computed,
    handleEditProfile,
    hasSmsPremiumAccess,
    openExplanationModal,
    openReminderManager,
    reminderPrefs,
  ]);
  const hasDeclarationReminderActive = activeReminderItems.some(
    (item) => item.key === "declaration",
  );
  const urgentReminderSignature = useMemo(
    () =>
      activeReminderItems
        .filter((item) => item.urgent)
        .map((item) => `${item.key}:${item.text}`)
        .join("|"),
    [activeReminderItems],
  );
  const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice.effectiveRate;
  const dashboardWeeklyRecap = useMemo(() => {
    const today = parseIsoDate(getTodayIsoDate());

    if (!today) return null;

    const weekStart = new Date(today);
    const dayOfWeek = weekStart.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weeklyRevenueEntries = revenues.filter((revenue) => {
      const revenueDate = parseIsoDate(revenue.date);
      return revenueDate && revenueDate >= weekStart && revenueDate <= today;
    });

    const weeklyRevenueCount = weeklyRevenueEntries.length;
    const weeklyRevenueTotal = weeklyRevenueEntries.reduce(
      (sum, revenue) => sum + (Number(revenue.amount) || 0),
      0,
    );
    const estimatedRate = resolveWeeklyEstimatedRate({
      effectiveRate: weeklyRecapEffectiveRate,
      legacyFallbackRate: getEstimatedRate(dashboardAnswers.activity_type),
    });
    const weeklyEstimatedCharges =
      weeklyRevenueCount > 0 && Number.isFinite(estimatedRate)
        ? Math.round(weeklyRevenueTotal * estimatedRate)
        : null;
    const weeklyInvoicesCreated = visibleInvoices.filter((invoice) => {
      const invoiceDate = parseIsoDate(invoice.invoice_date);
      return invoiceDate && invoiceDate >= weekStart && invoiceDate <= today;
    }).length;
    const reminderCount = activeReminderItems.length;
    const nextActionLabel = dashboardRecommendation?.cta || dashboardNextStep?.cta;
    const hasUsefulWeeklyData =
      weeklyRevenueCount > 0 || weeklyInvoicesCreated > 0 || reminderCount > 0;

    if (!hasUsefulWeeklyData) return null;

    return {
      subtitle:
        revenues.length < 5
          ? "L’essentiel de la semaine."
          : "Vue rapide de la semaine.",
      items: [
        {
          key: "revenues",
          label: "Revenus ajoutés cette semaine",
          value:
            weeklyRevenueCount > 0
              ? `${weeklyRevenueCount} revenu${weeklyRevenueCount > 1 ? "s" : ""}`
              : "Pas encore de nouveau revenu",
          helper:
            weeklyRevenueCount > 0
              ? `${weeklyRevenueTotal.toLocaleString("fr-FR")} € enregistrés`
              : "Ajoute une entrée pour garder le rythme.",
        },
        {
          key: "charges",
          label: "Charges estimées de la semaine",
          value:
            weeklyEstimatedCharges !== null
              ? `${weeklyEstimatedCharges.toLocaleString("fr-FR")} €`
              : "En attente d’activité",
          helper:
            weeklyEstimatedCharges !== null
              ? "Repère basé sur cette semaine."
              : "S’affiche dès qu’un revenu est saisi.",
        },
        {
          key: "invoices",
          label: "Factures créées",
          value:
            weeklyInvoicesCreated > 0
              ? `${weeklyInvoicesCreated} facture${weeklyInvoicesCreated > 1 ? "s" : ""}`
              : "Aucune nouvelle facture",
          helper:
            weeklyInvoicesCreated > 0
              ? "Le suivi client avance aussi."
              : "Tu peux en créer une quand tu veux.",
        },
        {
          key: "reminders",
          label: "Rappels à venir",
          value:
            reminderCount > 0
              ? `${reminderCount} rappel${reminderCount > 1 ? "s" : ""}`
              : "Aucun rappel prioritaire",
          helper:
            reminderCount > 0
              ? activeReminderItems[0]?.title || "Un point mérite ton attention."
              : "Rien d’urgent pour l’instant.",
        },
      ],
      nextActionLabel,
      helper:
        revenues.length < 5
          ? "Quelques saisies en plus rendront ce récap plus utile."
          : null,
    };
  }, [
    activeReminderItems,
    dashboardAnswers.activity_type,
    dashboardNextStep?.cta,
    dashboardRecommendation?.cta,
    revenues,
    visibleInvoices,
    weeklyRecapEffectiveRate,
  ]);
  const dashboardThisWeekInsight = useMemo(() => {
    const hasDeclarationDeadline =
      computed?.urgency === "soon" &&
      computed?.deadlineLabel &&
      computed.deadlineLabel !== "—" &&
      computed.deadlineLabel !== "Profil à compléter" &&
      computed.deadlineLabel !== "Complète ton profil fiscal";

    if (hasDeclarationDeadline) {
      return "Le point principal reste la déclaration à venir.";
    }

    if (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded") {
      return "Vérifie la TVA avant les prochains revenus.";
    }

    if (!user && visibleInvoices.length > 0) {
      return "Pense à sécuriser ton compte pour conserver les factures.";
    }

    if (revenues.length > 0 && revenues.length < 5) {
      return "Encore quelques revenus et tes repères seront plus stables.";
    }

    if (!user && shouldShowGuestLocalMessage) {
      return "Ton suivi tourne bien en local. Un compte gratuit te permettra juste de le retrouver plus tard.";
    }

    return "La semaine est sous contrôle.";
  }, [
    computed?.deadlineLabel,
    computed?.tvaStatus,
    computed?.urgency,
    revenues.length,
    shouldShowGuestLocalMessage,
    user,
    visibleInvoices.length,
  ]);
  const dashboardPositiveMomentum = useMemo(() => {
    const today = parseIsoDate(getTodayIsoDate());

    if (!today) return null;

    const weekStart = new Date(today);
    const dayOfWeek = weekStart.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weeklyRevenueCount = revenues.filter((revenue) => {
      const revenueDate = parseIsoDate(revenue.date);
      return revenueDate && revenueDate >= weekStart && revenueDate <= today;
    }).length;

    if (revenues.length >= 2) {
      return {
        title: "Bravo, tu progresses",
        text:
          weeklyRevenueCount >= 2
            ? `2 revenus saisis cette semaine.`
            : "Ton suivi prend un bon rythme.",
      };
    }

    if (visibleInvoices.length > 0) {
      return {
        title: "Première facture créée",
        text: "Ton suivi client commence à se structurer.",
      };
    }

    if (isFiscalProfileComplete && hasConfiguredReminders) {
      return {
        title: "Très bon rythme",
        text: "Ton suivi devient vraiment solide.",
      };
    }

    return null;
  }, [
    hasConfiguredReminders,
    isFiscalProfileComplete,
    revenues,
    visibleInvoices.length,
  ]);
  const dashboardWeeklyRhythmText =
    revenues.length >= 2
      ? "Tu avances à un bon rythme. Continue ainsi pour fiabiliser tes repères fiscaux."
      : "Le rythme se met en place. Quelques revenus supplémentaires rendront les repères plus précis.";
  const dashboardTrackingStreak = useMemo(() => {
    const trackingDays = new Set();

    revenues.forEach((revenue) => {
      const revenueDate = normalizeDateValue(revenue?.date);
      if (revenueDate) trackingDays.add(revenueDate);
    });

    visibleInvoices.forEach((invoice) => {
      const invoiceDate = normalizeDateValue(invoice?.invoice_date);
      if (invoiceDate) trackingDays.add(invoiceDate);
    });

    const uniqueDays = Array.from(trackingDays).sort();

    if (uniqueDays.length < 2) return null;

    const firstDay = parseIsoDate(uniqueDays[0]);
    const lastDay = parseIsoDate(uniqueDays[uniqueDays.length - 1]);
    const activeSpanDays =
      firstDay && lastDay
        ? Math.max(
            1,
            Math.round(
              (lastDay.getTime() - firstDay.getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1,
          )
        : uniqueDays.length;

    let text = `${uniqueDays.length} jours avec au moins une action sur ton cockpit`;

    if (uniqueDays.length >= 14) {
      text = `${Math.floor(uniqueDays.length / 7)} semaines avec un suivi régulier`;
    } else if (activeSpanDays >= 7) {
      text = `Ton suivi est actif depuis ${activeSpanDays} jours`;
    }

    return {
      title: "Série de suivi",
      text,
      helper: "Continue pour consolider tes repères.",
    };
  }, [revenues, visibleInvoices]);
  const dashboardNextMonthPrep = useMemo(() => {
    if (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded") {
      return roleBasedTips.nextMonth.tva;
    }

    if (!user && shouldShowGuestLocalMessage) {
      return roleBasedTips.nextMonth.guest;
    }

    if (revenues.length > 0 && revenues.length < 5) {
      return roleBasedTips.nextMonth.earlyHistory;
    }

    if (!hasConfiguredReminders) {
      return roleBasedTips.nextMonth.reminders;
    }

    return roleBasedTips.nextMonth.ready;
  }, [
    computed?.tvaStatus,
    hasConfiguredReminders,
    revenues.length,
    roleBasedTips,
    shouldShowGuestLocalMessage,
    user,
  ]);
  useEffect(() => {
    if (!showTVADiagnosticModal) return;

    setBetaMicroFeedbackState((prev) => {
      if (prev.triggers?.tva) return prev;

      const next = {
        ...prev,
        triggers: {
          ...prev.triggers,
          tva: {
            seenAt: new Date().toISOString(),
          },
        },
      };

      return writeBetaMicroFeedbackState(next);
    });
  }, [showTVADiagnosticModal]);
  
useEffect(() => {
    if (!dashboardNextMonthPrep) return;

    setBetaMicroFeedbackState((prev) => {
      if (prev.triggers?.planning) return prev;

      const next = {
        ...prev,
        triggers: {
          ...prev.triggers,
          planning: {
            seenAt: new Date().toISOString(),
          },
        },
      };

      return writeBetaMicroFeedbackState(next);
    });
  }, [dashboardNextMonthPrep]);
  const dashboardDailyInsight = useMemo(() => {
    if (computed?.tvaStatus === "exceeded" || computed?.tvaStatus === "soon") {
      return {
        icon: "🧾",
        text:
          computed?.tvaStatus === "exceeded"
            ? roleBasedTips.pointOfDay.tvaExceeded
            : roleBasedTips.pointOfDay.tvaSoon,
      };
    }

    if (revenues.length > 0 && !isFiscalProfileComplete) {
      return {
        icon: "📝",
        text: roleBasedTips.pointOfDay.incompleteProfile,
      };
    }

    if (
      isFiscalProfileComplete &&
      revenues.length > 0 &&
      Number(computed?.monthlyExpenses || 0) === 0
    ) {
      return {
        icon: "💡",
        text: roleBasedTips.pointOfDay.missingExpenses,
      };
    }

    if (revenues.length > 0 && revenues.length < 5) {
      return {
        icon: "📈",
        text: roleBasedTips.pointOfDay.lowHistory,
      };
    }

    if (!user && shouldShowGuestLocalMessage) {
      return null;
    }

    return {
      icon: "✨",
      text: roleBasedTips.pointOfDay.allGood,
    };
  }, [
    computed?.monthlyExpenses,
    computed?.tvaStatus,
    isFiscalProfileComplete,
    revenues.length,
    roleBasedTips,
    shouldShowGuestLocalMessage,
    user,
  ]);
  const primarySmartAlertId = smartAlerts[0]?.id || null;
  const invoiceSectionSummary = useMemo(() => {
    const unpaidCount = visibleInvoices.filter(
      (invoice) => getInvoicePaymentStatus(invoice) === "unpaid",
    ).length;

    return {
      count: visibleInvoices.length,
      unpaidCount,
    };
  }, [visibleInvoices]);
  const fiscalRecommendationCard = useMemo(() => {
    if (
      primarySmartAlertId !== "tva-threshold" &&
      computed?.tvaStatus === "exceeded" &&
      visibleInvoices.length === 0
    ) {
      return "💡 Astuce : crée tes factures pour mieux suivre la TVA collectée.";
    }

    if (
      Number(computed?.monthlyExpenses || 0) === 0 &&
      revenues.length > 0
    ) {
      return "💡 Astuce : ajoute tes dépenses pour piloter ta marge réelle.";
    }

    if (
      primarySmartAlertId !== "acre-ending" &&
      computed?.acreStatus === "active" &&
      computed?.acreEndDate
    ) {
      // LOT 10.1D: canonical, reform-aware acreEndDate (computeObligations)
      // instead of an independent flat +12-month guess from acre_start_date.
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const monthsLeft = daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : 0;

      if (monthsLeft > 0 && monthsLeft <= 2) {
        return "💡 Astuce : anticipe la hausse des cotisations après l’ACRE.";
      }
    }

    if (invoiceSectionSummary.unpaidCount > 0) {
      return "💡 Astuce : relance les paiements en retard pour sécuriser ta trésorerie.";
    }

    return null;
  }, [
    computed?.monthlyExpenses,
    computed?.tvaStatus,
    computed?.acreStatus,
    computed?.acreEndDate,
    invoiceSectionSummary.unpaidCount,
    primarySmartAlertId,
    revenues.length,
    visibleInvoices.length,
  ]);
  const fiscalScore = useMemo(() => {
    let score = 0;

    if (revenues.length >= 3) score += 20;
    if (visibleInvoices.length > 0) score += 20;
    if (Number(computed?.monthlyExpenses || 0) > 0) score += 20;
    if (computed?.tvaStatus !== "exceeded") score += 20;
    if (activeReminderItems.length >= 3) score += 20;

    const interpretation = SCORE_COPY.getInterpretation(score);

    return { value: score, interpretation };
  }, [
    activeReminderItems.length,
    computed?.monthlyExpenses,
    computed?.tvaStatus,
    revenues.length,
    visibleInvoices.length,
  ]);
  const premiumBannerContent = useMemo(() => {
    if (isQaPremium) {
      return {
        line1: "🧪 Premium QA actif",
        line2: "Mode de test local activé.",
        line3: "",
        cta: "Voir les avantages Premium",
      };
    }

    switch (billingUiState) {
      case "guest":
        return {
          line1: "✨ Tester sans compte",
          line2: "Tu peux tester Microassist sans créer de compte.",
          line3: "Tes données restent sur cet appareil.",
          cta: "Créer mon compte",
        };
      case "trial_active":
        return {
          line1: "⏳ Phase de test active",
          line2:
            "Ton compte te permet déjà de retrouver ton espace et tes rappels email.",
          line3: trialEndsAtLabel
            ? `Les SMS et rappels avancés arriveront plus tard en Premium. Test ouvert jusqu’au ${trialEndsAtLabel}.`
            : "SMS et rappels avancés bientôt en Premium.",
          cta: "Gérer mes rappels",
        };
      case "trial_expired":
        return {
          line1: "🔓 Phase de test active",
          line2:
            "Ton espace reste disponible gratuitement : revenus, factures, exports et suivi de base.",
          line3:
            "SMS et rappels avancés bientôt en Premium.",
          cta: "Activer les rappels automatiques",
        };
      case "premium_active":
        return {
          line1: "⭐ Premium actif",
          line2: "Ton espace est synchronisé et Premium débloque les options avancées.",
          line3: "",
          cta: "Gérer mes rappels",
        };
      case "registered_free":
      default:
        return {
          line1: "⭐ Rappels en phase de test",
          line2:
            "Ton espace reste disponible gratuitement : revenus, factures, exports et suivi de base.",
          line3: "SMS et rappels avancés bientôt en Premium.",
          cta: "Gérer mes rappels",
        };
    }
  }, [billingUiState, isQaPremium, trialDaysLeft, trialEndsAtLabel]);
  const premiumModalContent = useMemo(() => {
    const normalizedSource = normalizePremiumTriggerType(premiumModalSource);

    if (normalizedSource === "tva_exceeded") {
      return {
        title: "Anticipe la TVA avec Premium",
        intro:
          "Tu as dépassé le seuil TVA. Premium t’aide à voir plus clair et à anticiper les prochaines étapes.",
        heroTitle: "TVA à anticiper",
        heroText:
          "Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
        firstBenefit: "✔ Alertes TVA et priorités complètes",
      };
    }

    if (normalizedSource === "declaration_urgent") {
      return {
        title: "Ne rate pas ton échéance",
        intro:
          "Ta déclaration approche. Premium te prévient avant les échéances importantes et t’aide à agir plus tôt.",
        heroTitle: "Échéance à préparer",
        heroText:
          "Garde une vue claire sur ce qui devient urgent avant qu’il ne soit trop tard.",
        firstBenefit: "✔ Alertes avant échéances importantes",
      };
    }

    if (normalizedSource === "multiple_priorities") {
      return {
        title: "Plusieurs priorités ont été détectées",
        intro:
          "Premium te donne une vision plus complète pour mieux anticiper et éviter les oublis.",
        heroTitle: "Priorités complètes",
        heroText:
          "Vois toutes tes priorités et avance avec une lecture plus proactive de ton espace fiscal.",
        firstBenefit: "✔ Smart Priorités complètes",
      };
    }

    if (normalizedSource === "smart_priorities_lock") {
      return {
        title: "Ne laisse pas une échéance te surprendre",
        intro:
          "Premium te montre toutes les priorités importantes et t’envoie des alertes avant les échéances.",
        heroTitle: "Priorités complètes + alertes",
        heroText:
          "Tu sais quoi faire, quand agir, et ce qu’il ne faut pas oublier.",
        firstBenefit: "✔ Toutes les Smart Priorités",
      };
    }

    if (normalizedSource === "early_access_ending") {
      return {
        title: "Ton accès complet se termine aujourd’hui",
        intro:
          "Certaines fonctionnalités vont devenir Premium. Active Premium pour garder toutes les alertes et priorités.",
        heroTitle: "Garde l’accès complet",
        heroText:
          "Continue à recevoir les alertes utiles au bon moment après ta période découverte.",
        firstBenefit: "✔ Alertes et priorités Premium conservées",
      };
    }

    if (normalizedSource === "post_early_access") {
      return {
        title: "Retrouve toutes les fonctionnalités",
        intro:
          "Premium te prévient automatiquement avant les échéances importantes pour éviter les oublis.",
        heroTitle: "Premium pour anticiper",
        heroText:
          "Retrouve les alertes automatiques, les priorités complètes et un accompagnement plus proactif.",
        firstBenefit: "✔ Alertes automatiques et Smart Priorités complètes",
      };
    }

    if (normalizedSource === "exports_limit") {
      return {
        title: "Premium pour exporter sans limite",
        intro:
          "Débloque les exports PDF et CSV illimités pour garder un suivi propre et partageable à tout moment.",
        heroTitle: "Exports illimités",
        heroText:
          "Un historique prêt pour ton comptable, avec archivage automatique et exports disponibles quand tu en as besoin.",
        firstBenefit: "✔ Exports PDF et CSV illimités",
      };
    }

    if (normalizedSource === "tva_context") {
      return {
        title: "Premium pour anticiper la TVA",
        intro:
          "Reçois des alertes email et des priorités plus visibles pour préparer ta facturation au bon moment.",
        heroTitle: "Alerte TVA prioritaire",
        heroText:
          "Un suivi plus direct pour anticiper l’activation TVA sans manquer une étape clé.",
        firstBenefit: "✔ Alertes TVA et priorités complètes",
      };
    }

    if (normalizedSource === "history_context") {
      return {
        title: "Premium pour piloter ton historique",
        intro:
          "Conserve un historique complet de ton activité et automatise tes exports quand ton suivi devient plus dense.",
        heroTitle: "Historique sans limite",
        heroText:
          "Retrouve tes données sur la durée et exporte-les plus facilement pour ton pilotage.",
        firstBenefit: "✔ Historique illimité de tes revenus",
      };
    }

    if (normalizedSource === "acre_context") {
      return {
        title: "Premium pour anticiper la fin ACRE",
        intro:
          "Prépare la sortie ACRE avec des alertes plus ciblées avant l’évolution de tes cotisations.",
        heroTitle: "Alerte ACRE personnalisée",
        heroText:
          "Des rappels plus précis pour anticiper la transition et ajuster ton suivi fiscal à temps.",
        firstBenefit: "✔ Alertes personnalisées avant la fin ACRE",
      };
    }

    if (normalizedSource === "unpaid_context") {
      return {
        title: "Premium pour suivre les factures en attente",
        intro:
          "Repère plus vite les factures à surveiller et structure ton suivi d’encaissement dans le temps.",
        heroTitle: "Suivi facture renforcé",
        heroText:
          "Une meilleure visibilité sur les relances et les paiements à surveiller.",
        firstBenefit: "✔ Suivi des factures impayées",
      };
    }

    return {
      title: "Premium pour anticiper",
      intro:
        "Premium te prévient automatiquement avant les échéances importantes pour éviter les oublis.",
      heroTitle: "Alertes et priorités",
      heroText:
        "Garde une vue claire sur ce qui compte vraiment avant les échéances importantes.",
      firstBenefit: "✔ Alertes email avant échéance",
    };
  }, [premiumModalSource]);
  const premiumModalPrimaryCtaLabel = useMemo(() => {
    const normalizedSource = normalizePremiumTriggerType(premiumModalSource);

    switch (normalizedSource) {
      case "tva_exceeded":
        return "Voir les options à venir";
      case "declaration_urgent":
        return "Activer les rappels automatiques";
      case "multiple_priorities":
      case "smart_priorities_lock":
        return "Activer les rappels automatiques";
      case "early_access_ending":
        return "Garder mes rappels actifs";
      case "post_early_access":
        return "Gérer mes rappels";
      default:
        return "Découvrir les rappels avancés";
    }
  }, [premiumModalSource]);
  const premiumModalBenefits = useMemo(
    () =>
      [
        premiumModalContent.firstBenefit,
        "✔ Alertes email avant échéance",
        "✔ Accompagnement proactif avant les échéances",
        "✔ Suivi TVA + ACRE + CFE intelligent",
        "✔ Smart Priorités complètes",
        "✔ Alertes intelligentes par email",
        "✔ Priorités et rappels avancés",
      ].filter((benefit, index, benefits) => benefit && benefits.indexOf(benefit) === index),
    [premiumModalContent.firstBenefit],
  );
  const revenueSectionTotal = useMemo(
    () =>
      filteredRevenues.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredRevenues],
  );
  const premiumContextualCTA = useMemo(() => {
    // LOT 10.1D: canonical, reform-aware acreEndDate (computeObligations)
    // instead of an independent flat +12-month guess from acre_start_date.
    // Fixes only the timing source -- Premium visibility/gating logic below
    // is unchanged.
    let acreMonthsLeft = null;

    if (computed?.acreStatus === "active" && computed?.acreEndDate) {
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      if (daysLeft > 0) {
        acreMonthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
      }
    }

    const candidates = [
      {
        visible:
          computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded",
        blockedBy: "tva-threshold",
        text: "Passe à Premium pour recevoir les alertes TVA et SMS automatiques",
        source: "premium_tva_context",
      },
      {
        visible: revenues.length >= 5,
        blockedBy: null,
        text: "Historique illimité + exports automatiques en Premium",
        source: "premium_history_context",
      },
      {
        visible: acreMonthsLeft !== null && acreMonthsLeft <= 2,
        blockedBy: "acre-ending",
        text: "Anticipe la fin ACRE avec alertes personnalisées Premium",
        source: "premium_acre_context",
      },
      {
        visible: invoiceSectionSummary.unpaidCount > 0,
        blockedBy: null,
        text: "Suivi des factures impayées en Premium",
        source: "premium_unpaid_context",
      },
    ];

    return (
      candidates.find(
        (candidate) =>
          candidate.visible &&
          (!candidate.blockedBy || candidate.blockedBy !== primarySmartAlertId),
      ) || null
    );
  }, [
    computed?.acreStatus,
    computed?.acreEndDate,
    computed?.tvaStatus,
    revenues.length,
    invoiceSectionSummary.unpaidCount,
    primarySmartAlertId,
  ]);
  const premiumTrackingSource = normalizePremiumTrackingSource(
    premiumContextualCTA?.source || "default",
  );
  const premiumBannerButtonLabel = premiumBannerContent.cta;
  const handleBillingBannerAction = useCallback(() => {
    if (billingUiState === "guest") {
      trackBetaEvent("save_follow_clicked", { source: "dashboard_top" });
      openAuthModal("signup");
      return;
    }

    openPremiumModal(premiumContextualCTA?.source || "dashboard_top");
  }, [
    billingUiState,
    openAuthModal,
    openPremiumModal,
    premiumContextualCTA?.source,
    trackBetaEvent,
  ]);
  useEffect(() => {
    if (billingUiState === "guest" || billingUiState === "premium_active") {
      return;
    }

    if (premiumTriggerContext?.triggerType && sessionTriggerKey) {
      console.info("[premium-trigger] detected", premiumTriggerContext);

      try {
        if (sessionStorage.getItem(sessionTriggerKey)) {
          return;
        }
      } catch {
        // ignore sessionStorage parsing issues
      }

      trackEvent("premium_modal_open", {
        triggerType: premiumTriggerContext.triggerType,
        priorityLevel: premiumTriggerContext.priorityLevel,
      });
      console.info("[premium-analytics]", {
        event: "premium_modal_open",
        triggerType: premiumTriggerContext.triggerType,
        priorityLevel: premiumTriggerContext.priorityLevel,
      });
      openPremiumModal(premiumTriggerContext.triggerType);

      try {
        sessionStorage.setItem(
          sessionTriggerKey,
          JSON.stringify({
            trigger: premiumTriggerContext.triggerType,
            at: Date.now(),
          }),
        );
      } catch {
        // ignore sessionStorage write issues
      }

      return;
    }

    if (!premiumTrigger) return;

    const storageKey = "microassist_premium_trigger_last";
    const cooldownMs = 24 * 60 * 60 * 1000;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.trigger === premiumTrigger &&
          typeof parsed?.at === "number" &&
          Date.now() - parsed.at < cooldownMs
        ) {
          return;
        }
      }
    } catch {
      // ignore storage parsing issues
    }

    openPremiumModal(premiumTrigger);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          trigger: premiumTrigger,
          at: Date.now(),
        }),
      );
    } catch {
      // ignore storage write issues
    }
  }, [
    billingUiState,
    openPremiumModal,
    premiumTrigger,
    premiumTriggerContext,
    sessionTriggerKey,
  ]);
  useEffect(() => {
    if (!user?.id || !user?.email) return;
    if (billingUiState !== "trial_active") return;
    if (!subscriptionLikeState?.trialEndsAt) return;
    if (getTrialDaysLeft(subscriptionLikeState.trialEndsAt) !== 7) return;
    const eventType = "trial_ending_j7";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      console.info("[trial-email-send] skipped", {
        eventType,
        reason: "recently_handled",
        userId: user.id,
      });
      return;
    }

    // LOT 10.1G: no recipient/subject/html/userId is sent to the server
    // anymore -- the Edge Function derives caller identity from the
    // authenticated session and looks up trial state itself.
    markEmailEventHandled(eventType, user.id, {
      trialEndsAt: subscriptionLikeState.trialEndsAt,
      pending: true,
    });

    console.info("[trial-email-send] start", {
      eventType,
      userId: user.id,
      email: user.email,
      trialEndsAt: subscriptionLikeState.trialEndsAt,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail();

        if (cancelled) return;

        if (result?.ok === true && result?.skipped === true) {
          console.info("[trial-email-send] skipped", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        if (result?.ok === true && result?.success === true) {
          console.info("[trial-email-send] success", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        console.warn("[trial-email-send] error", result);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn("[trial-email-send] error", error);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    billingUiState,
    sendTrialEndingEmail,
    subscriptionLikeState?.trialEndsAt,
    user?.email,
    user?.id,
  ]);
  useEffect(() => {
    if (!user?.id || !user?.email) return;
    if (billingUiState !== "trial_active") return;
    if (!subscriptionLikeState?.trialEndsAt) return;
    if (!shouldSendTrialEndingEmailJ2(subscriptionLikeState.trialEndsAt)) return;
    const eventType = "trial_ending_j2";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      console.info("[trial-email-send-j2] skipped", {
        eventType,
        reason: "recently_handled",
        userId: user.id,
      });
      return;
    }

    // LOT 10.1G: no recipient/subject/html/userId is sent to the server
    // anymore -- the Edge Function derives caller identity from the
    // authenticated session and looks up trial state itself.
    markEmailEventHandled(eventType, user.id, {
      trialEndsAt: subscriptionLikeState.trialEndsAt,
      pending: true,
    });

    console.info("[trial-email-send-j2] start", {
      eventType,
      userId: user.id,
      email: user.email,
      trialEndsAt: subscriptionLikeState.trialEndsAt,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail();

        if (cancelled) return;

        if (result?.ok === true && result?.skipped === true) {
          console.info("[trial-email-send-j2] skipped", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        if (result?.ok === true && result?.success === true) {
          console.info("[trial-email-send-j2] success", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        console.warn("[trial-email-send-j2] error", result);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn("[trial-email-send-j2] error", error);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    billingUiState,
    sendTrialEndingEmail,
    subscriptionLikeState?.trialEndsAt,
    user?.email,
    user?.id,
  ]);
  useEffect(() => {
    if (!user?.id || !user?.email) return;
    if (billingUiState === "premium_active") return;
    if (!subscriptionLikeState?.trialEndsAt) return;
    if (!shouldSendTrialExpiredEmail(subscriptionLikeState.trialEndsAt)) return;
    const eventType = "trial_expired";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      console.info("[trial-email-expired] skipped", {
        eventType,
        reason: "recently_handled",
        userId: user.id,
      });
      return;
    }

    // LOT 10.1G: no recipient/subject/html/userId is sent to the server
    // anymore -- the Edge Function derives caller identity from the
    // authenticated session and looks up trial state itself.
    markEmailEventHandled(eventType, user.id, {
      trialEndsAt: subscriptionLikeState.trialEndsAt,
      pending: true,
    });

    console.info("[trial-email-expired] start", {
      eventType,
      userId: user.id,
      email: user.email,
      trialEndsAt: subscriptionLikeState.trialEndsAt,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail();

        if (cancelled) return;

        if (result?.ok === true && result?.skipped === true) {
          console.info("[trial-email-expired] skipped", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        if (result?.ok === true && result?.success === true) {
          console.info("[trial-email-expired] success", result);
          markEmailEventHandled(eventType, user.id, {
            trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          });
          return;
        }

        console.warn("[trial-email-expired] error", result);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn("[trial-email-expired] error", error);
        markEmailEventHandled(eventType, user.id, {
          trialEndsAt: subscriptionLikeState?.trialEndsAt || null,
          error: true,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    billingUiState,
    sendTrialEndingEmail,
    subscriptionLikeState?.trialEndsAt,
    user?.email,
    user?.id,
  ]);
  useEffect(() => {
    const nextDeclarationDate = computed?.deadlineDate;

    if (!user?.id || !user?.email) return;
    if (accessProfile?.features?.declaration_email_j7 !== true) {
      console.info(
        "[email-gating] declaration_j7 skipped: no premium-like access",
      );
      return;
    }
    if (
      !(nextDeclarationDate instanceof Date) ||
      Number.isNaN(nextDeclarationDate.getTime())
    ) {
      return;
    }
    if (!shouldSendDeclarationReminderJ7(nextDeclarationDate)) return;
    const eventType = "declaration_j7";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      console.info("[declaration-email-j7] skipped", {
        eventType,
        reason: "recently_handled",
        userId: user.id,
      });
      return;
    }

    const emailPayload = buildDeclarationReminderEmailPayloadJ7({
      email: user.email,
      deadlineDate: nextDeclarationDate,
    });
    const requestBody = {
      userId: user.id,
      email: user.email,
      eventType,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
      declarationDate: nextDeclarationDate,
    };

    console.info("[declaration-email-j7] start", {
      eventType,
      userId: user.id,
      email: user.email,
      declarationDate: nextDeclarationDate,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail(requestBody);

        if (cancelled) return;

        if (result?.ok === true && result?.skipped === true) {
          console.info("[declaration-email-j7] skipped", result);
          markEmailEventHandled(eventType, user.id, {
            declarationDate: nextDeclarationDate.toISOString(),
          });
          return;
        }

        if (result?.ok === true && result?.success === true) {
          console.info("[declaration-email-j7] success", result);
          markEmailEventHandled(eventType, user.id, {
            declarationDate: nextDeclarationDate.toISOString(),
          });
          return;
        }

        console.warn("[declaration-email-j7] error", result);
      } catch (error) {
        if (cancelled) return;
        console.warn("[declaration-email-j7] error", error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    accessProfile?.features?.declaration_email_j7,
    computed?.deadlineDate,
    sendTrialEndingEmail,
    user?.email,
    user?.id,
  ]);
  useEffect(() => {
    const nextDeclarationDate = computed?.deadlineDate;

    if (!user?.id || !user?.email) return;
    if (accessProfile?.features?.declaration_email_j2 !== true) {
      console.info(
        "[email-gating] declaration_j2 skipped: no premium-like access",
      );
      return;
    }
    if (
      !(nextDeclarationDate instanceof Date) ||
      Number.isNaN(nextDeclarationDate.getTime())
    ) {
      return;
    }
    if (!shouldSendDeclarationReminderJ2(nextDeclarationDate)) return;
    const eventType = "declaration_j2";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      console.info("[declaration-email-j2] skipped", {
        eventType,
        reason: "recently_handled",
        userId: user.id,
      });
      return;
    }

    const emailPayload = buildDeclarationReminderEmailPayloadJ2({
      email: user.email,
      deadlineDate: nextDeclarationDate,
    });
    const requestBody = {
      userId: user.id,
      email: user.email,
      eventType,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
      declarationDate: nextDeclarationDate,
    };

    console.info("[declaration-email-j2] start", {
      eventType,
      userId: user.id,
      email: user.email,
      declarationDate: nextDeclarationDate,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail(requestBody);

        if (cancelled) return;

      if (result?.ok === true && result?.skipped === true) {
        console.info("[declaration-email-j2] skipped", result);
        markEmailEventHandled(eventType, user.id, {
          declarationDate: nextDeclarationDate.toISOString(),
        });
        return;
      }

      if (result?.ok === true && result?.success === true) {
        console.info("[declaration-email-j2] success", result);
        markEmailEventHandled(eventType, user.id, {
          declarationDate: nextDeclarationDate.toISOString(),
        });
        return;
      }

        console.warn("[declaration-email-j2] error", result);
      } catch (error) {
        if (cancelled) return;
        console.warn("[declaration-email-j2] error", error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    accessProfile?.features?.declaration_email_j2,
    computed?.deadlineDate,
    sendTrialEndingEmail,
    user?.email,
    user?.id,
  ]);
  useEffect(() => {
    if (!user?.id || !user?.email) return;
    if (accessProfile?.features?.smart_priority_email !== true) {
      console.info(
        "[email-gating] smart_priority_high skipped: no premium-like access",
      );
      return;
    }
    if (!Array.isArray(smartPriorities) || smartPriorities.length === 0) return;

    const firstVisiblePriority = smartPriorities[0] || null;
    const topHighPriority = getTopHighSmartPriority(smartPriorities);

    if (firstVisiblePriority?.level !== "high" || !topHighPriority) {
      return;
    }

    const eventType = "smart_priority_high";
    const priorityTitle = topHighPriority?.title || "";
    const priorityMessage = topHighPriority?.message || "";

    if (wasEmailEventHandledRecently(eventType, user.id)) {
      try {
        const raw = localStorage.getItem(
          getEmailEventStorageKey(eventType, user.id),
        );

        if (raw) {
          const parsed = JSON.parse(raw);

          if (
            parsed?.priorityTitle === priorityTitle &&
            parsed?.priorityMessage === priorityMessage
          ) {
            console.info("[smart-priority-email] skipped", {
              eventType,
              reason: "recently_handled_same_priority",
              userId: user.id,
              priorityTitle,
            });
            return;
          }
        }
      } catch {
        // ignore localStorage parsing issues for smart priority dedupe
      }
    }

    const emailPayload = buildSmartPriorityEmailPayload({
      email: user.email,
      priority: topHighPriority,
    });
    const requestBody = {
      userId: user.id,
      email: user.email,
      eventType,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
      priorityTitle,
      priorityMessage,
    };

    console.info("[smart-priority-email] start", {
      eventType,
      userId: user.id,
      email: user.email,
      priorityTitle,
      priorityMessage,
    });

    let cancelled = false;

    const run = async () => {
      try {
        const result = await sendTrialEndingEmail(requestBody);

        if (cancelled) return;

        if (result?.ok === true && result?.skipped === true) {
          console.info("[smart-priority-email] skipped", result);
          markEmailEventHandled(eventType, user.id, {
            priorityTitle,
            priorityMessage,
          });
          return;
        }

        if (result?.ok === true && result?.success === true) {
          console.info("[smart-priority-email] success", result);
          markEmailEventHandled(eventType, user.id, {
            priorityTitle,
            priorityMessage,
          });
          return;
        }

        console.warn("[smart-priority-email] error", result);
      } catch (error) {
        if (cancelled) return;
        console.warn("[smart-priority-email] error", error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    accessProfile?.features?.smart_priority_email,
    sendTrialEndingEmail,
    smartPriorities,
    user?.email,
    user?.id,
  ]);
  const dashboardTopNudge = useMemo(() => {
    const latestRevenueDate = revenues
      .map((item) => parseIsoDate(item?.date))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (latestRevenueDate) {
      const daysSinceLastRevenue = Math.floor(
        (Date.now() - latestRevenueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceLastRevenue >= 7) {
        return {
          type: "revenue_recency",
          text: "👋 Pense à ajouter ton revenu du mois pour garder tes prévisions à jour.",
        };
      }
    }

    if (
      primarySmartAlertId !== "tva-threshold" &&
      (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded")
    ) {
      return {
        type: "tva_watch",
        text: "⚠️ Ton seuil TVA évolue vite. Vérifie ton diagnostic cette semaine.",
      };
    }

    if (visibleInvoices.length === 0 && revenues.length >= 3) {
      return {
        type: "invoice_first",
        text: "🧾 Crée ta première facture pour suivre tes paiements.",
      };
    }

    if (
      primarySmartAlertId !== "acre-ending" &&
      computed?.acreStatus === "active" &&
      computed?.acreEndDate
    ) {
      // LOT 10.1D: canonical, reform-aware acreEndDate (computeObligations)
      // instead of an independent flat +12-month guess from acre_start_date.
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const monthsLeft = daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : 0;

      if (monthsLeft > 0 && monthsLeft <= 2) {
        return {
          type: "acre_ending",
          text: "⏳ Prépare la fin ACRE dès maintenant pour éviter le choc de charges.",
        };
      }
    }

    return null;
  }, [
    computed?.tvaStatus,
    computed?.acreStatus,
    computed?.acreEndDate,
    primarySmartAlertId,
    revenues,
    visibleInvoices.length,
  ]);
  const shouldShowDashboardTopNudge =
    dashboardTopNudge &&
    dashboardTopNudge.type !== dashboardTopNudgeDismissedType;
  const feedbackContextSnapshot = useMemo(() => {
    let acreMonthsRemaining = null;

    // LOT 10.1D: canonical, reform-aware acreEndDate (computeObligations)
    // instead of an independent flat +12-month guess from acre_start_date.
    if (computed?.acreStatus === "active" && computed?.acreEndDate) {
      const daysLeft = Math.ceil(
        (computed.acreEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      acreMonthsRemaining = daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : 0;
    } else if (computed?.acreStatus === "expired") {
      acreMonthsRemaining = 0;
    }

    
    return {
      totalRevenues: currentMonthTotal || 0,
      revenuesCount: revenues.length || 0,
      invoicesCount: visibleInvoices.length || 0,
      activePriorityType: primarySmartAlertId || null,
      premiumSource: premiumTrackingSource || "default",
      remindersCount: activeReminderItems.length || 0,
      projectedAnnual:
        typeof computed?.annualRevenue === "number" ? computed.annualRevenue : null,
      tvaThresholdState: computed?.tvaStatus || null,
      acreMonthsRemaining,
    };
  }, [
    computed?.acreStatus,
    computed?.acreEndDate,
    currentMonthTotal,
    revenues.length,
    visibleInvoices.length,
    primarySmartAlertId,
    premiumTrackingSource,
    activeReminderItems.length,
    computed?.annualRevenue,
    computed?.tvaStatus,
  ]);
  const betaMicroFeedbackPrompt = useMemo(() => {
    const feedbackAnswers = betaMicroFeedbackState?.answers || {};
    const feedbackTriggers = betaMicroFeedbackState?.triggers || {};

    if (feedbackTriggers.tva && !feedbackAnswers.tva && !showTVADiagnosticModal) {
      return {
        context: "tva",
        placement: "top",
        title: "Retour rapide sur la TVA",
        question: "Le diagnostic TVA t’aide-t-il à savoir quoi faire ensuite ?",
      };
    }

    if (visibleInvoices.length >= 1 && !feedbackAnswers.invoices) {
      return {
        context: "invoices",
        placement: "invoices",
        title: "Retour rapide sur les factures",
        question: "Le suivi des factures te semble-t-il clair pour démarrer ?",
      };
    }

    if (feedbackTriggers.planning && !feedbackAnswers.planning) {
      return {
        context: "planning",
        placement: "planning",
        title: "Retour rapide sur le mois prochain",
        question: "Le bloc “Le mois prochain” t’aide-t-il à anticiper ?",
      };
    }

    if (revenues.length >= 3 && !feedbackAnswers.revenues) {
      return {
        context: "revenues",
        placement: "revenues",
        title: "Retour rapide sur les revenus",
        question: "Le suivi des revenus t’aide-t-il à y voir plus clair ?",
      };
    }

    return null;
  }, [
    betaMicroFeedbackState,
    revenues.length,
    showTVADiagnosticModal,
    visibleInvoices.length,
  ]);
  const handleBetaMicroFeedback = useCallback(
    (context, sentiment, placement) => {
      if (!context || !sentiment) return;

      const choiceLabel =
        sentiment === "yes"
          ? "Oui"
          : sentiment === "medium"
            ? "Moyen"
            : "Pas encore";

      const nextState = writeBetaMicroFeedbackState({
        answers: {
          ...(betaMicroFeedbackState?.answers || {}),
          [context]: {
            sentiment,
            submittedAt: new Date().toISOString(),
          },
        },
        triggers: {
          ...(betaMicroFeedbackState?.triggers || {}),
        },
      });

      setBetaMicroFeedbackState(nextState);
      trackEvent("beta_micro_feedback_submit", {
        ...feedbackContextSnapshot,
        feedbackContext: context,
        feedbackSentiment: sentiment,
      });

      if (betaMicroFeedbackThanksTimeoutRef.current) {
        clearTimeout(betaMicroFeedbackThanksTimeoutRef.current);
      }

      setBetaMicroFeedbackThanks({
        context,
        label: choiceLabel,
        placement,
      });

      betaMicroFeedbackThanksTimeoutRef.current = window.setTimeout(() => {
        setBetaMicroFeedbackThanks(null);
        betaMicroFeedbackThanksTimeoutRef.current = null;
      }, 3200);
    },
    [betaMicroFeedbackState, feedbackContextSnapshot],
  );
  const renderBetaMicroFeedbackCard = useCallback(
    (placement) => {
      const isPromptVisible =
        betaMicroFeedbackPrompt && betaMicroFeedbackPrompt.placement === placement;
      const isThankYouVisible =
        betaMicroFeedbackThanks?.placement === placement &&
        (!isPromptVisible ||
          betaMicroFeedbackThanks?.context !== betaMicroFeedbackPrompt.context);

      if (!isPromptVisible && !isThankYouVisible) {
        return null;
      }

      if (isThankYouVisible) {
        return (
          <div className="dashboardBetaFeedbackCard">
            <div className="dashboardBetaFeedbackTitle">Retour enregistré</div>
            <div className="dashboardBetaFeedbackHelper">
              Merci 🙏 ton retour améliore la bêta Microassist
            </div>
          </div>
        );
      }

      return (
        <div className="dashboardBetaFeedbackCard">
          <div className="dashboardBetaFeedbackTitle">
            {betaMicroFeedbackPrompt.title}
          </div>
          <div className="dashboardBetaFeedbackQuestion">
            {betaMicroFeedbackPrompt.question}
          </div>
          {isThankYouVisible ? (
            <div className="dashboardBetaFeedbackHelper">
              Merci 🙏 ton retour améliore la bêta Microassist
            </div>
          ) : (
            <>
              <div className="dashboardBetaFeedbackChoices">
                <button
                  className="btn btnActionSecondary btnSmall"
                  type="button"
                  onClick={() =>
                    handleBetaMicroFeedback(
                      betaMicroFeedbackPrompt.context,
                      "yes",
                      betaMicroFeedbackPrompt.placement,
                    )
                  }
                >
                  👍 Oui
                </button>
                <button
                  className="btn btnActionSecondary btnSmall"
                  type="button"
                  onClick={() =>
                    handleBetaMicroFeedback(
                      betaMicroFeedbackPrompt.context,
                      "medium",
                      betaMicroFeedbackPrompt.placement,
                    )
                  }
                >
                  👌 Moyen
                </button>
                <button
                  className="btn btnActionSecondary btnSmall"
                  type="button"
                  onClick={() =>
                    handleBetaMicroFeedback(
                      betaMicroFeedbackPrompt.context,
                      "no",
                      betaMicroFeedbackPrompt.placement,
                    )
                  }
                >
                  👎 Pas encore
                </button>
              </div>
              <div className="dashboardBetaFeedbackHelper">
                Merci 🙏 ton retour améliore la bêta Microassist
              </div>
            </>
          )}
        </div>
      );
    },
    [betaMicroFeedbackPrompt, betaMicroFeedbackThanks, handleBetaMicroFeedback],
  );

const invoicesThisMonth = useMemo(() => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return visibleInvoices.filter((invoice) => {
    if (!invoice.invoice_date) return false;
    const d = new Date(`${invoice.invoice_date}T00:00:00`);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;
}, [visibleInvoices]);
  const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
  const monthlyReflectionChargesAmount =
    fiscalSummaryVisibleSlice.finalContributionAmount;
  const dashboardMonthlyReflection = useMemo(() => {
    if (revenues.length === 0) return null;

    const invoiceLabel = `${invoicesThisMonth} facture${invoicesThisMonth > 1 ? "s" : ""}`;
    const reminderLabel = `${activeReminderItems.length} rappel${activeReminderItems.length > 1 ? "s" : ""} actif${activeReminderItems.length > 1 ? "s" : ""}`;
    const tvaHelper =
      computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded"
        ? `TVA : ${normalizedTvaStatusLabel || "à surveiller"}.`
        : null;

    return {
      title: "📅 Bilan du mois",
      text: `Tu as enregistré ${monthlyReflectionRevenueTotal.toLocaleString("fr-FR")} € de revenus, prévu ${monthlyReflectionChargesAmount.toLocaleString("fr-FR")} € de charges et créé ${invoiceLabel}.`,
      helper: [reminderLabel, tvaHelper, "Tu vois plus clairement ton mois en cours."]
        .filter(Boolean)
        .join(" "),
    };
  }, [
    activeReminderItems.length,
    computed?.tvaStatus,
    invoicesThisMonth,
    monthlyReflectionChargesAmount,
    monthlyReflectionRevenueTotal,
    normalizedTvaStatusLabel,
    revenues.length,
  ]);

useEffect(() => {
  if (appView !== "dashboard") return;
  if (premiumCTAViewSourceRef.current === premiumTrackingSource) return;

  trackEvent("premium_cta_view", { source: premiumTrackingSource });
  premiumCTAViewSourceRef.current = premiumTrackingSource;
}, [appView, premiumTrackingSource]);

  const triggerFirstRevenueOnboarding = useCallback(() => {
    if (firstRevenueOnboardingSeenRef.current) {
      return;
    }

    firstRevenueOnboardingSeenRef.current = true;
    writeFirstRevenueOnboardingSeen(true);
    setShowFirstRevenueOnboarding(true);
    goToView("assistant", { push: true, focus: true });
    setAssistantCollapsed(true);

    window.setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, [goToView]);

  const handleStartFirstRevenueOnboarding = useCallback(() => {
    setShowFirstRevenueOnboarding(false);
    setAssistantCollapsed(false);

    window.setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      inputRef.current?.focus();
    }, 80);
  }, []);

  const handleDismissFirstRevenueOnboarding = useCallback(() => {
    setShowFirstRevenueOnboarding(false);
    goToDashboard({ scroll: false });
  }, [goToDashboard]);

  useEffect(() => {
  const pendingAuthSuccess = localStorage.getItem(PENDING_AUTH_SUCCESS_KEY);

  if (authLoading || !pendingAuthSuccess || !user || isRecoveryFlow) return;

  let cancelled = false;

  async function finalizeAuthSuccess() {
    const migrated = await migrateLocalDataToSupabase({ silent: true });

    await Promise.all([
      refreshRevenues(),
      refreshFiscalProfile(),
      refreshInvoices(),
    ]);

    if (cancelled) return;

    localStorage.removeItem(PENDING_AUTH_SUCCESS_KEY);
    localStorage.setItem(BETA_SEEN_KEY, "1");
    setShowBetaNotice(false);

    const hasAuthCallbackParams =
      window.location.hash ||
      ["mode", "token_hash", "type", "error", "error_code"].some((param) =>
        new URLSearchParams(window.location.search).has(param),
      );

    if (hasAuthCallbackParams) {
      cleanAuthCallbackUrl();
    }

    if (isRecoveryFlow) return;

    if (deepLinkViewPendingRef.current) {
      const deepLinkView = deepLinkViewPendingRef.current;
      goToView(deepLinkView, { push: false, focus: false });
      deepLinkViewPendingRef.current = null;
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          appView: deepLinkView,
        },
        "",
        window.location.pathname,
      );
      console.log(`[deep-link] ${deepLinkView} opened from query param`);
      return;
    }

    goToDashboard({ scroll: false });

    showSaveNotice(
      pendingAuthSuccess === "email_confirmed"
        ? "Ton compte est confirmé"
        : profileConflictState.open
          ? "Connexion réussie ✅ Un choix de profil est nécessaire avant toute synchronisation."
        : migrated
          ? "Connexion réussie ✅ Tes données ont été importées et ton espace fiscal est prêt."
          : "Connexion réussie ✅ Ton espace fiscal est prêt.",
      5000,
    );
  }

  finalizeAuthSuccess();

  return () => {
    cancelled = true;
  };
}, [
  user,
  authLoading,
  isRecoveryFlow,
  migrateLocalDataToSupabase,
  refreshRevenues,
  refreshFiscalProfile,
  refreshInvoices,
  goToView,
  goToDashboard,
  showSaveNotice,
  profileConflictState.open,
]);

  const handleUseRemoteProfile = useCallback(() => {
    const remoteAnswers = getAssistantAnswersFromProfile(
      profileConflictState.remoteProfile,
    );

    setAnswers(remoteAnswers);
    setHasDraft(Boolean(remoteAnswers && Object.keys(remoteAnswers).length > 0));
    setProfileSyncBlocked(false);
    writeProfileConflictStrategy("use_remote");
    setProfileConflictState({
      open: false,
      localAnswers: null,
      remoteProfile: null,
    });
    showSaveNotice("Le profil du compte a été appliqué sur cet appareil.", 4000);
  }, [profileConflictState.remoteProfile, showSaveNotice]);

  const handleKeepLocalDraft = useCallback(() => {
    if (profileConflictState.localAnswers) {
      setAnswers(profileConflictState.localAnswers);
      setHasDraft(true);
    }

    setProfileSyncBlocked(true);
    writeProfileConflictStrategy("keep_local");
    setProfileConflictState({
      open: false,
      localAnswers: null,
      remoteProfile: null,
    });
    showSaveNotice(
      "Le brouillon local est conservé sans synchronisation automatique.",
      4000,
    );
  }, [profileConflictState.localAnswers, showSaveNotice]);

  const handleResumeDraft = useCallback(() => {
    setAppView("assistant");
    setFocusMode(true);
    setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, []);

  const toggleDashboardSection = useCallback((sectionKey) => {
    setDashboardSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }, []);

  useEffect(() => {
    if (!urgentReminderSignature) return;

    setDashboardRemindersDismissed(false);

    try {
      localStorage.removeItem(DASHBOARD_REMINDERS_DISMISSED_KEY);
    } catch {
      // Ignore localStorage failures in dashboard UI state.
    }
  }, [urgentReminderSignature]);

function handleReminderToggle(key) {
  if (key === "sms") {
    setReminderPrefs((prev) => {
      const next = {
        ...prev,
        sms: false,
      };
      localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(next));
      return next;
    });
    return;
  }

  setReminderPrefs((prev) => {
    const next = {
      ...prev,
      [key]: !prev[key],
    };

    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(next));
    return next;
  });
}

  // Centralizes UI gating for monetized features.
  function guardPremiumAccess(feature, source = "unknown") {
    const featureChecks = {
      revenue_limit: () => revenues.length >= currentPlanLimits.revenues,
      invoice_limit: () =>
        invoicesThisMonth >= currentPlanLimits.invoicesPerMonth,
      pdf_export_limit: () => isExportLimitReached,
      sms_premium: () => reminderPrefs.sms && !hasSmsPremiumAccess,
    };

    const isBlocked = featureChecks[feature]?.() ?? false;

    if (isBlocked) {
      handleOpenSaveModal(source || feature);
      return false;
    }

    return true;
  }

  function resetRevenueForm() {
    setRevenueForm({
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      revenue_category: "",
      client: "",
      invoice: "",
      note: "",
    });
    setShowRevenueDetails(false);
  }

function handleOpenRevenuePopup() {
  if (accessProfile?.features?.revenue_tracking !== true) {
    alert("Le suivi des revenus n’est pas disponible pour ce profil.");
    return;
  }

  trackBetaEvent("add_revenue_clicked", { source: "open_revenue_form" });
  setShowAddRevenue(true);
}

  function handleCloseRevenuePopup() {
    setShowAddRevenue(false);
    resetRevenueForm();
  }

function handleOpenInvoiceGenerator() {
  if (!guardPremiumAccess("invoice_limit", "invoice_limit")) {
    return;
  }

  // Keep every invoice entry point behind the same premium gate.
  trackBetaEvent("invoice_modal_opened", { source: "invoice_entry_point" });
  setInvoiceInitialValues(null);
  setShowInvoiceGenerator(true);
}

function handleOpenInvoiceFromLatestRevenue() {
  if (!guardPremiumAccess("invoice_limit", "invoice_limit")) {
    return;
  }

  const latestRevenue = revenues[0];
  const revenueAmount = Number(latestRevenue?.amount || 0);
  const revenueDate = latestRevenue?.date || new Date().toISOString().slice(0, 10);

  trackBetaEvent("invoice_modal_opened", { source: "latest_revenue_link" });
  setInvoiceInitialValues({
    client_name: latestRevenue?.client || "",
    description:
      latestRevenue?.note ||
      latestRevenue?.invoice ||
      "Prestation liée au revenu enregistré",
    unit_price: revenueAmount > 0 ? String(revenueAmount) : "",
    quantity: "1",
    invoice_date: revenueDate,
    due_date: addInvoiceDueDate(revenueDate, 30),
  });
  setShowInvoiceGenerator(true);
}

async function handleMarkInvoicePaid(invoice) {
  if (!invoice?.id) return;

  const paidAt = new Date().toISOString();
  const markPaid = (items) =>
    items.map((item) =>
      item.id === invoice.id ||
      item.invoice_number === invoice.invoice_number ||
      item.invoiceNumber === invoice.invoiceNumber
        ? { ...item, status: "paid", paid_at: item.paid_at || paidAt }
        : item,
    );

  if (invoice.localOnly || !user) {
    setGuestInvoices((prev) => {
      const next = markPaid(prev);
      localStorage.setItem(GUEST_INVOICES_KEY, JSON.stringify(next));
      return next;
    });
    setInvoiceNotice("Facture marquée comme payée ✅");
    return;
  }

  setInvoices((prev) => markPaid(prev));

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", invoice.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Invoice payment status update error:", error.message);
    setInvoiceNotice("Impossible de mettre à jour le statut de paiement.");
    refreshInvoices();
    return;
  }

  setInvoiceNotice("Facture marquée comme payée ✅");
}

function openReminderManager(source = "default") {
  trackEvent("reminder_manage", {
    source,
    totalRevenues: revenues.length,
    invoiceCount: visibleInvoices.length,
  });
  setShowReminderModal(true);
}

  // ==================== ФУНКЦИИ УДАЛЕНИЯ И СБРОСА ====================
  const handleDeleteRevenue = useCallback(
    async (id) => {
      if (!window.confirm("Supprimer ce revenu ?")) {
        return;
      }

      if (!user) {
        const nextRevenues = revenues.filter((item) => item.id !== id);
        setRevenues(nextRevenues);
        localStorage.setItem(GUEST_REVENUES_KEY, JSON.stringify(nextRevenues));
        return;
      }

      const ok = await deleteRevenueFromSupabase(id);
      if (!ok) {
        alert("Impossible de supprimer ce revenu.");
        return;
      }
      await refreshRevenues();
    },
    [deleteRevenueFromSupabase, refreshRevenues, revenues, user],
  );

  function resetAssistantSession(message = "Bonjour 👋 On recommence. Réponds simplement.") {
    setStepIndex(0);
    setAnswers({});
    setInput("");
    setUserName("");
    setHelpOpen(false);
    setAssistantFieldError("");
    setIsTyping(false);
    setFocusMode(false);
    setHasDraft(false);
    setLastSavedAt(null);
    setRestoredAt(null);
    setAssistantCollapsed(false);
    setAssistantEditMode(false);
    setProfileEditMode("idle");
    setSelectedProfileField(null);
    setProfileEditDraft({});

    const [firstMessage, ...rest] = buildInitialAssistantMessages();
    setMessages([
      {
        ...firstMessage,
        text: message,
      },
      ...rest,
    ]);
  }

  function resetDashboardState() {
    setSelectedMonth("all");
    setShowChart(true);
    setShowAddRevenue(false);
    setShowRevenueDetails(false);
    setShowInvoiceGenerator(false);
    setShowReminderModal(false);
    setShowPricingModal(false);
    setExplanationModalType(null);
    setInvoiceNotice(null);
    setSaveNotice(null);
    resetRevenueForm();
  }

function clearLocalStorageKeys(keys) {
    keys.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  function collectB2CLocalStorageKeys() {
    const explicitKeys = new Set([
      ...FULL_RESET_LOCAL_STORAGE_KEYS,
      LS_KEY,
      SIMPLE_PROFILE_KEY,
      GUEST_REVENUES_KEY,
      GUEST_INVOICES_KEY,
      REMINDER_PREFS_KEY,
      DASHBOARD_REMINDERS_DISMISSED_KEY,
      DASHBOARD_SECTIONS_KEY,
      DASHBOARD_TOP_NUDGE_DISMISSED_KEY,
      DASHBOARD_CHECKLIST_COLLAPSED_KEY,
      FIRST_REVENUE_ONBOARDING_SEEN_KEY,
      BETA_MICRO_FEEDBACK_KEY,
      CHART_KEY,
    ]);

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith("microassist_") && !key.includes("expert")) {
        explicitKeys.add(key);
      }
      if (key.startsWith(EMAIL_EVENT_KEY_PREFIX)) {
        explicitKeys.add(key);
      }
    }

    return Array.from(explicitKeys);
  }

useEffect(() => {
  if (authLoading) return;

  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const isRecoveryUrl = hasRecoveryUrlState();

  const currentUserId = user?.id ?? null;
  const previousUserId = previousUserIdRef.current;

  if (previousUserId === currentUserId) {
    return;
  }

  previousUserIdRef.current = currentUserId;

  const keepRecoveryModalOpen = isRecoveryFlow || isRecoveryUrl;

  console.log("[RECOVERY DEBUG]", {
    currentUserId,
    previousUserId,
    isRecoveryFlow,
    isRecoveryUrl,
    search,
    hash,
  });

  if (!keepRecoveryModalOpen) {
    closeAuthModal("auth user change effect");
  }

  setFiscalProfile(null);
  setFiscalProfileLoaded(false);
  fiscalProfileFetchRef.current = {
    inFlight: null,
    userId: null,
    lastFetchedAt: 0,
    lastData: null,
  };
  guestMigrationRef.current = {
    inFlight: null,
    userId: null,
    completedForUserId: null,
  };
  setRevenues([]);
  setInvoices([]);

  if (currentUserId) {
    setGuestInvoices([]);
  } else {
    try {
      setGuestInvoices(
        JSON.parse(localStorage.getItem(GUEST_INVOICES_KEY) || "[]"),
      );
    } catch {
      setGuestInvoices([]);
    }
  }

  setReminderPrefs(DEFAULT_REMINDER_PREFS);
  setSelectedMonth("all");
  setAnswers({});
  setStepIndex(0);
  setMessages(buildInitialAssistantMessages());
  setInput("");
  setAssistantFieldError("");
  setHasDraft(false);
  setLastSavedAt(null);
  setRestoredAt(null);
  setShowAddRevenue(false);
  setShowRevenueDetails(false);
  setShowInvoiceGenerator(false);
  setShowReminderModal(false);
  setInvoiceNotice(null);
  setSaveNotice(null);
  setUserName("");
  setAssistantEditMode(false);
  setProfileEditMode("idle");
  setSelectedProfileField(null);
  setProfileEditDraft({});
}, [authLoading, user?.id, isRecoveryFlow]);

  async function resetFiscalProfileData() {
    if (!user) return true;

    const { error } = await supabase
      .from("fiscal_profiles")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Fiscal profile reset error:", error.message);
      return false;
    }

    return true;
  }

  async function deleteUserRecords(table) {
    if (!user) return true;

    const { error } = await supabase.from(table).delete().eq("user_id", user.id);

    if (error) {
      console.error(`Delete ${table} error:`, error.message);
      return false;
    }

    return true;
  }

  async function handleProfileOnlyReset() {
    if (resetInProgress) return;

    setResetInProgress(true);

    try {
      if (user) {
        const didResetProfile = await resetFiscalProfileData();

        if (!didResetProfile) {
          showSaveNotice("Impossible de réinitialiser le profil fiscal.", 4000);
          return;
        }
      }

      localStorage.removeItem(LS_KEY);
      resetAssistantSession();
      setAppView("assistant");
      await refreshFiscalProfile();

      showSaveNotice(
        "Profil fiscal réinitialisé ✅ Tes revenus, factures et rappels sont conservés.",
        4500,
      );
      setShowResetModal(false);

      setTimeout(() => {
        assistantRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } finally {
      setResetInProgress(false);
    }
  }

  async function handleFullReset() {
    if (resetInProgress) return;

    setResetInProgress(true);

    try {
      if (user) {
        const results = await Promise.all([
          resetFiscalProfileData(),
          deleteUserRecords("revenues"),
          deleteUserRecords("invoices"),
          deleteUserRecords("reminders"),
        ]);

        if (results.some((result) => result === false)) {
          showSaveNotice("Impossible de réinitialiser tout l’espace.", 4000);
          return;
        }
      }

      clearLocalStorageKeys(FULL_RESET_LOCAL_STORAGE_KEYS);
      setRevenues([]);
      setInvoices([]);
      setGuestInvoices([]);
      setReminderPrefs(EMPTY_REMINDER_PREFS);
      setFiscalProfile(null);
      setFiscalProfileLoaded(Boolean(user));
      resetDashboardState();
      resetAssistantSession();
      setAppView("assistant");

      if (!user) {
        setHydrated(true);
      } else {
        await Promise.all([
          refreshRevenues(),
          refreshInvoices(),
          refreshFiscalProfile(),
        ]);
      }

      showSaveNotice("Espace fiscal réinitialisé ✅ Aucun ancien calcul n’est conservé.", 5000);
      setShowResetModal(false);

      setTimeout(() => {
        assistantRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } finally {
      setResetInProgress(false);
    }
  }

  function handleReset() {
    setShowResetModal(true);
  }

  function handleLocalProfileRestart() {
    if (
      !window.confirm(
        "Cela va effacer les données locales de test et recommencer le parcours. Continuer ?",
      )
    ) {
      return;
    }

    const hadOnlineFiscalData = Boolean(fiscalProfile);
    const keysToClear = collectB2CLocalStorageKeys();
    clearLocalStorageKeys(keysToClear);
    console.log("RESET LOCAL DATA keys cleared", keysToClear);

    fiscalProfileFetchRef.current = {
      inFlight: null,
      userId: user?.id || null,
      lastFetchedAt: Date.now(),
      lastData: null,
    };
    guestMigrationRef.current = {
      inFlight: null,
      userId: user?.id || null,
      completedForUserId: user?.id || null,
    };
    firstRevenueOnboardingSeenRef.current = false;
    setFiscalProfile(null);
    setFiscalProfileLoaded(true);
    setSimpleAssistantProfile(null);
    setTvaConfigDraft("unknown");
    setRevenues([]);
    setInvoices([]);
    setGuestInvoices([]);
    setReminderPrefs(DEFAULT_REMINDER_PREFS);
    setSelectedMonth("all");
    setDashboardRemindersDismissed(false);
    setDashboardTopNudgeDismissedType("");
    setDashboardChecklistCollapsed(false);
    setDashboardSections(DEFAULT_DASHBOARD_SECTIONS);
    setShowFirstRevenueOnboarding(false);
    resetDashboardState();
    resetAssistantSession();
    setAppView("assistant");
    trackBetaEvent("onboarding_started", { source: "reset" });
    setShowSimpleOnboarding(true);
    setSimpleOnboardingStep(0);
    setSimpleOnboardingDraft({
      activity_type: "services",
      declaration_frequency: "mensuel",
      business_start_date: "",
      acre: "unknown",
      tva_status: "unknown",
    });
    setHydrated(true);
    console.log("RESET STATE DONE");
    showSaveNotice(
      user && hadOnlineFiscalData
        ? "Données locales réinitialisées. Vous pouvez recommencer le parcours. Des données de compte existent encore en ligne. La réinitialisation locale ne les supprime pas."
        : "Données locales réinitialisées. Vous pouvez recommencer le parcours.",
      6000,
    );

    setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  // Оставьте только goToView и используйте везде
  const goToAssistant = useCallback(() => {
    if (user && fiscalProfile) {
      setAnswers(getAssistantAnswersFromProfile(fiscalProfile));
      setStepIndex(0);
      setInput("");
      setHelpOpen(false);
      setAssistantFieldError("");
    }
    setAssistantEditMode(false);

    goToView("assistant", { push: true, focus: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        assistantRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }, [user, fiscalProfile, goToView]);

  // А в handleTipAction используйте goToAssistant
  // Вместо текущей неполной функции, вставьте эту:
  function handleTipAction(action) {
    if (action === "add") {
      handleOpenRevenuePopup();
      return;
    }
    if (action === "profile") {
      goToAssistant();
      return;
    }
    if (action === "deadline") {
      fiscalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSmartAlertAction(action) {
    if (action === "add_revenue") {
      handleOpenRevenuePopup();
      return;
    }

    if (action === "cash_impact") {
      setShowCashImpactModal(true);
      return;
    }

    if (action === "tva") {
      setShowTVADiagnosticModal(true);
      return;
    }

    if (action === "tva_info") {
      openExplanationModal("tva");
      return;
    }

    if (action === "reminders") {
      openReminderManager("smart_priority");
      return;
    }

    if (action === "invoices") {
      document
        .getElementById("invoices-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    handleTipAction(action);
  }

  function handleRevenueFieldChange(field, value) {
    setRevenueForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function deleteRevenueFromSupabase(id) {
    const { error } = await supabase.from("revenues").delete().eq("id", id);

    if (error) {
      console.error("Revenue delete error:", error.message);
      return false;
    }

    return true;
  }

  async function saveRevenueToSupabase(revenue) {
    if (!user?.id) {
      console.error("User not authenticated.");
      return null;
    }

    const payload = {
      user_id: user.id,
      amount: Number(revenue.amount),
      revenue_date: revenue.date,
      revenue_category:
        revenue.revenue_category && revenue.revenue_category !== ""
          ? revenue.revenue_category
          : null,
      client: revenue.client || null,
      invoice: revenue.invoice || null,
      note: revenue.note || null,
    };

    const { data, error } = await supabase
      .from("revenues")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Revenue insert error:", error.message);
      return null;
    }

    console.log("Revenue saved ✅");
    return data;
  }

  async function saveRevenueEntry() {
    const wasFirstRevenue = revenues.length === 0;
    const shouldTriggerProfileOnboarding =
      wasFirstRevenue && !isFiscalProfileComplete;
    const amount = Number(String(revenueForm.amount).replace(",", "."));
    const isMixedActivity = isMixedActivityValue(dashboardAnswers.activity_type);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Merci d’indiquer un montant valide.");
      return;
    }

    if (isMixedActivity && !revenueForm.revenue_category) {
      alert(
        "Pour une activité mixte, choisis si ce revenu vient du commerce ou d’un service.",
      );
      return;
    }

    const entry = {
      amount,
      date: revenueForm.date || new Date().toISOString().slice(0, 10),
      revenue_category:
        isMixedActivity
          ? revenueForm.revenue_category || ""
          : "",
      client: revenueForm.client.trim(),
      invoice: revenueForm.invoice.trim(),
      note: revenueForm.note.trim(),
    };

    const savedEntry = await saveRevenueToSupabase(entry);

    if (!savedEntry) {
      alert("Impossible d’enregistrer ce revenu.");
      return;
    }

    await refreshRevenues();
    trackBetaEvent("revenue_created", {
      source: user ? "authenticated" : "guest",
      totalRevenues: revenues.length + 1,
    });
    trackEvent("revenue_add", {
      source: user ? "authenticated" : "guest",
      totalRevenues: revenues.length + 1,
      invoiceCount: visibleInvoices.length,
    });
    showSuccessToast("✅ Revenu ajouté. Tes projections sont à jour.", 4000);

    const rate = getRevenueContributionRate(
      entry,
      dashboardAnswers.activity_type,
      computed?.rate,
    );
    const charges = Math.round(amount * rate);
    const disponible = Math.max(0, amount - charges);

    showSaveNotice(
      `Revenu enregistré • charges estimées : ${charges.toLocaleString("fr-FR")} € • disponible estimé : ${disponible.toLocaleString("fr-FR")} €`,
      2500,
    );

    setShowAddRevenue(false);
    resetRevenueForm();

    if (shouldTriggerProfileOnboarding) {
      triggerFirstRevenueOnboarding();
      return;
    }

    setTimeout(() => {
      fiscalRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
  }

  async function handleSaveRevenue() {
    const isMixedActivity = isMixedActivityValue(dashboardAnswers.activity_type);

    if (!user) {
      const isFirstRevenue = revenues.length === 0;
      if (isMixedActivity && !revenueForm.revenue_category) {
        alert(
          "Pour une activité mixte, choisis si ce revenu vient du commerce ou d’un service.",
        );
        return;
      }
      // Сохраняем в localStorage для неавторизованных
      const newRevenue = {
        id: Date.now(),
        amount: revenueAmount,
        date: revenueForm.date,
        revenue_category:
          isMixedActivity
            ? revenueForm.revenue_category || ""
            : "",
        client: revenueForm.client,
        invoice: revenueForm.invoice,
        note: revenueForm.note,
      };

      const updatedRevenues = [newRevenue, ...revenues];
      setRevenues(updatedRevenues);
      localStorage.setItem(GUEST_REVENUES_KEY, JSON.stringify(updatedRevenues));

      setShowAddRevenue(false);
      resetRevenueForm();
      trackBetaEvent("revenue_created", {
        source: "guest",
        totalRevenues: updatedRevenues.length,
      });
      trackEvent("revenue_add", {
        source: "guest",
        totalRevenues: updatedRevenues.length,
        invoiceCount: visibleInvoices.length,
      });
      showSuccessToast("✅ Revenu ajouté. Tes projections sont à jour.", 4000);

      showSaveNotice(
        `Revenu enregistré localement • ${revenueAmount.toLocaleString("fr-FR")} €`,
        2500,
      );

      if (isFirstRevenue && !isFiscalProfileComplete) {
        triggerFirstRevenueOnboarding();
      }

      return;
    }

    await saveRevenueEntry();
  }

  function formatRevenueDate(dateStr) {
    if (!dateStr) return "";

    const d = new Date(`${dateStr}T00:00:00`);

    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

function handleExportCSV() {
  if (filteredRevenues.length === 0 || isExportingCsv) return;
  if (!canExportCsv) {
    openPremiumModal("exports_limit");
    return;
  }

  setIsExportingCsv(true);

  try {
    const headers = ["Date", "Montant", "Client", "Facture", "Note"];

    const rows = filteredRevenues.map((item) => [
      item.date || "",
      item.amount || "",
      item.client || "",
      item.invoice || "",
      item.note || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    const fileName =
      selectedMonth === "all"
        ? "revenus_microassist.csv"
        : `revenus_${selectedMonth}.csv`;

    link.setAttribute("download", fileName);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    trackEvent("export_csv", {
      source: "revenues",
      totalRevenues: filteredRevenues.length,
      invoiceCount: visibleInvoices.length,
    });
    showSuccessToast("✅ Export prêt. Ton suivi est sauvegardé.", 4000);
  } finally {
    setIsExportingCsv(false);
  }
}

function incrementMonthlyExportUsage(type) {
  const usageType = type === "pdf" ? "pdf" : "csv";
  const currentUsage = readMonthlyExportUsage();
  const nextUsage = normalizeMonthlyExportUsage({
    ...currentUsage,
    [usageType]: currentUsage[usageType] + 1,
    total: currentUsage.total + 1,
  });

  setMonthlyExportUsage(nextUsage);
  writeMonthlyExportUsage(nextUsage);
}

function syncMonthlyExportUsage() {
  const normalizedUsage = readMonthlyExportUsage();
  setMonthlyExportUsage(normalizedUsage);
  writeMonthlyExportUsage(normalizedUsage);
  return normalizedUsage;
}

function handleExportLimitHit(currentUsage = monthlyExportUsage) {
  const remaining = Math.max(
    0,
    FREE_EXPORTS_PER_MONTH - Number(currentUsage?.total || 0)
  );

  trackEvent("export_limit_hit", {
    source: "exports_limit",
    usedExports: Number(currentUsage?.total || 0),
    remainingExports: remaining,
    totalRevenues: filteredRevenues.length,
    invoiceCount: visibleInvoices.length,
  });
  openPremiumModal("exports_limit");
}

const handleExportPDF = useCallback(async () => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    let y = 22;

    // Palette sérieuse
    const navy = [30, 41, 59];        // slate-800
    const dark = [17, 24, 39];        // gray-900
    const muted = [75, 85, 99];       // gray-600
    const border = [229, 231, 235];   // gray-200
    const soft = [249, 250, 251];     // gray-50
    const softBlue = [241, 245, 249]; // slate-100

    const cleanPdfText = (text) =>
      String(text || "")
        .split("")
        .filter((char) => char.charCodeAt(0) <= 0x7f)
        .join("")
        .replace(/\s+/g, " ")
        .trim();

    const ensureSpace = (needed = 24) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const drawTitle = (title) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...dark);
      doc.text(title, margin, y);
      y += 8;
    };

    const drawLine = (label, value) => {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...dark);
      doc.text(`${label} :`, margin, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);

      const text = cleanPdfText(value || "—");
      const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2 - 38);
      doc.text(wrapped, margin + 34, y);
      y += Math.max(7, wrapped.length * 5.5);
    };

    const drawBox = (title, lines = [], fill = soft) => {
      const lineHeight = 6;
      const wrappedLines = lines.map((line) =>
        doc.splitTextToSize(cleanPdfText(line), pageWidth - margin * 2 - 14)
      );
      const contentHeight =
        wrappedLines.reduce((sum, arr) => sum + arr.length * lineHeight, 0) + 18;

      ensureSpace(contentHeight + 8);

      doc.setFillColor(...fill);
      doc.setDrawColor(...border);
      doc.roundedRect(
        margin,
        y,
        pageWidth - margin * 2,
        contentHeight,
        3,
        3,
        "FD"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...dark);
      doc.text(title, margin + 6, y + 8);

      let innerY = y + 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...muted);

      wrappedLines.forEach((arr) => {
        doc.text(arr, margin + 6, innerY);
        innerY += arr.length * lineHeight;
      });

      y += contentHeight + 8;
    };

  // HEADER
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("MICROASSIST", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Rapport fiscal simplifie", margin, 21);

  doc.setFontSize(8.5);
  doc.text(
    `Genere le ${new Date().toLocaleDateString("fr-FR")}`,
    pageWidth - margin - 28,
    21
  );

  y = 38;

  // PROFIL
  drawTitle("1. Profil");
  drawLine("Activite", activityLabel || "Non renseignee");
  drawLine("Periodicite", freqLabel || "Non renseignee");
  drawLine(
    "ACRE",
    dashboardAnswers?.acre === "yes"
      ? "Oui"
      : dashboardAnswers?.acre === "no"
        ? "Non"
        : "Non renseignee"
  );

  // RESUME
  y += 2;
  drawTitle("2. Resume du mois");

  const tvaLine = cleanPdfText(
    normalizedTvaStatusLabel || computed?.tvaHint || "Non renseigne"
  );

  const cfeLine = computed?.cfeAlert?.show
    ? computed?.cfeAlert?.estimatedAmount
      ? `${cleanPdfText(computed.cfeAlert.message)} • estimation : ${computed.cfeAlert.estimatedAmount} €`
      : cleanPdfText(computed.cfeAlert.message)
    : computed?.isFirstYear
      ? "Exonere la premiere annee"
      : "A confirmer selon la date de debut d activite";

  drawBox(
    "Vue d ensemble",
    hasAnyDashboardData
      ? [
          hasRevenueData
            ? `Revenus cumulés : ${getDisplayValue(currentMonthTotal, "money")}`
            : `CA estime : ${getDisplayValue(cockpitEstimate.revenue, "money")} - ${provisionalCaHelperText}`,
          `Charges estimees : ${dashboardChargesDisplay}`,
          `Disponible estime : ${dashboardAvailableDisplay}`,
          hasRevenueData
            ? `Moyenne mensuelle : ${getDisplayValue(
                revenueStats.monthlyAverage,
                "money",
              )}`
            : "Moyenne mensuelle : Pas encore assez de données",
          `Nombre d entrees : ${revenueStats.count}`,
        ]
      : [
          "Ajoute ton premier revenu",
          "Pas encore assez de données",
          estimateHelperText,
        ],
    soft
  );

  drawBox(
    "Reperes fiscaux",
    [
      `Prochaine declaration : ${cleanPdfText(computed?.nextDeclarationLabel || "—")}`,
      `Date limite : ${cleanPdfText(computed?.deadlineLabel || "—")}`,
      `TVA : ${tvaLine}`,
      `CFE : ${cfeLine}`,
    ],
    softBlue
  );

  // ANALYSE
  drawTitle("3. Analyse");
  drawBox(
    "Projection",
    [
      `Projection annuelle : ${
        computed?.annualNet !== null && computed?.annualNet !== undefined
          ? getDisplayValue(computed.annualNet, "money")
          : "Pas encore assez de données"
      }`,
      `Taux estime : ${computed?.rate ? Math.round(computed.rate * 100) : 0}%`,
      // LOT 5.86A PDF boundary: source-only denominator migration.
      `Objectif d epargne : ${
        typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0
          ? `${Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)}%`
          : "Pas encore assez de données"
      }`,
    ],
    soft
  );

  // ACTIONS
  drawTitle("4. Actions recommandees");

  const actionLines = hasAnyDashboardData
    ? [
        `Mettre de cote environ ${dashboardChargesDisplay} pour eviter les surprises.`,
        `Verifier la prochaine echeance : ${cleanPdfText(
          computed?.deadlineLabel || "Pas encore assez de données",
        )}.`,
      ]
    : ["Ajoute ton premier revenu pour activer les estimations."];

  if (computed?.tvaStatus === "soon" || computed?.tvaStatus === "exceeded") {
    actionLines.push("Surveiller le seuil TVA et anticiper la facturation.");
  }

  if (computed?.cfeAlert?.show) {
    actionLines.push("Prevoir la CFE pour eviter une charge tardive en fin d annee.");
  }

  if (computed?.acreHint) {
    actionLines.push(cleanPdfText(computed.acreHint));
  }

  drawBox("A faire maintenant", actionLines, softBlue);

  // DISCLAIMER
  ensureSpace(18);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  const disclaimer = doc.splitTextToSize(
    "Document simplifie fourni a titre indicatif. Microassist ne remplace pas un expert-comptable.",
    pageWidth - margin * 2
  );
  doc.text(disclaimer, margin, y);
  y += disclaimer.length * 5 + 6;

  // FOOTER SIGNATURE
  doc.setDrawColor(...border);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "Microassist • Rapport fiscal premium • France micro-entreprise",
    margin,
    pageHeight - 10
  );

  // PAGE 2 - HISTORIQUE
  if (revenues.length > 0) {
    doc.addPage();

    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 22, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("Historique des revenus", margin, 14);

    const tableData = revenues.slice(0, 30).map((r) => [
      formatRevenueDate(r.date),
      `${Number(r.amount).toLocaleString("fr-FR")} €`,
      r.client || "-",
      r.invoice || "-",
    ]);

    autoTable(doc, {
      startY: 30,
      head: [["Date", "Montant", "Client", "Facture"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: dark,
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: soft,
      },
      styles: {
        lineColor: border,
        lineWidth: 0.1,
      },
      margin: { left: margin, right: margin },
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      "Microassist • Historique des revenus",
      margin,
      pageHeight - 10
    );
  }

    doc.save(
      `rapport_microassist_${new Date().toISOString().split("T")[0]}.pdf`
    );
    return true;
  } catch (error) {
    console.error("Erreur export PDF:", error);
    return false;
  }
}, [
  activityLabel,
  freqLabel,
  dashboardAnswers,
  currentMonthTotal,
  revenueStats,
  estimatedCharges,
  availableAmount,
  computed,
  revenues,
  formatRevenueDate,
  pdfSavingsGoal,
  savingsProgress,
]);

async function handleExportPDFWithLimit() {
  if (isExportingPdf) {
    return;
  }

  setIsExportingPdf(true);
  try {
    const exportCompleted = await handleExportPDF();

    if (exportCompleted) {
      incrementMonthlyExportUsage("pdf");
      trackEvent("export_pdf", {
        source: "revenues",
        totalRevenues: revenues.length,
        invoiceCount: visibleInvoices.length,
      });
      showSuccessToast("✅ Export prêt. Ton suivi est sauvegardé.", 4000);
    }
  } finally {
    setIsExportingPdf(false);
  }
}
  

  function handleSend() {
    if (!canSend || isTyping) return;

    const key = step?.key;
    const normalizedValue =
      key === "business_start_date" || key === "acre_start_date"
        ? normalizeDateValue(input)
        : input.trim();
    const nextAnswers = key
      ? { ...answers, [key]: normalizedValue }
      : { ...answers };
    const validationMessage = getCurrentStepValidationMessage(key, nextAnswers);

    if (validationMessage) {
      setAssistantFieldError(validationMessage);
      return;
    }

    setAssistantFieldError("");
    setInput("");

    submitAnswer({ chatText: normalizedValue, value: normalizedValue });
  }

  function submitAnswer({ chatText, value }) {
    addMessage("user", chatText);

    const key = step?.key;
    let updatedAnswers = key ? { ...answers, [key]: value } : { ...answers };
    let forcedNextIndex = null;

    if (key === "entry_status" && value === "micro_no") {
      setAnswers(updatedAnswers);

      addAssistant(
        "Pour l’instant, Microassist couvre surtout la micro-entreprise (URSSAF). " +
          "Une version SAS/EI/EURL est en préparation. " +
          "Tu peux laisser ton besoin dans la section “Prochainement”.",
      );

      scrollToSection("prochainement");
      return;
    }

    if (key === "entry_status" && value === "micro_yes") {
      updatedAnswers = { ...updatedAnswers, status: "auto_entrepreneur" };
    }

    if (key === "acre" && value !== "yes") {
      updatedAnswers = {
        ...updatedAnswers,
        acre_start_date: null,
      };
    }

    setAnswers(updatedAnswers);

    if (key === "declaration_frequency") {
      const dashIndex = getIndexByKey("fiscal_dashboard");
      if (dashIndex !== -1) {
        forcedNextIndex = dashIndex;
      }
    }

    // В submitAnswer, после setAnswers(updatedAnswers)
    if (key === "acre") {
      console.log("🔍 ACRE selected:", value);
      console.log("🔍 Answers after ACRE:", updatedAnswers);
    }

    setTimeout(() => {
      goNext(forcedNextIndex, updatedAnswers);
    }, 250);
  }

  function handleSelectOption(opt) {
    if (isTyping) return;
    setAssistantFieldError("");
    submitAnswer({ chatText: opt.label, value: opt.value });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  function handleDownloadTxt() {
    const content =
      buildFiscalSummary(answers, computed) +
      "\n\n" +
      buildFiscalChecklist(computed);

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-action-mvp.txt";
    a.click();

    URL.revokeObjectURL(url);
  }

  function handleNewSession() {
    handleReset();
    setTimeout(() => {
      scrollToTopSection("assistant");
    }, 120);
  }

  const goToLandingSection = useCallback((section) => {
    if (section === "contact") {
      trackEvent("feedback_open", { feedbackMoment: "landing_contact" });
      window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
      return;
    }

    setAppView("landing");
    setFocusMode(false);

    setTimeout(() => {
      const refs = {
        home: heroRef,
        services: servicesRef,
        security: securityRef,
      };

      refs[section]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }, []);

async function handleOpenSaveModal(source = "unknown", options = {}) {
  const { inlineStatusOnly = false } = options;
  const triggerType = normalizePremiumTriggerType(source);
  const trackingSource = normalizePremiumTrackingSource(triggerType);
  trackEvent("premium_cta_click", { source: trackingSource });
  trackPremiumEvent(triggerType, "modal_open");
  track("pricing_modal_opened", { source: triggerType });
  setPremiumModalSource(triggerType);
  setPremiumWaitlistEmail(user?.email?.trim().toLowerCase() ?? "");
  setPremiumWaitlistError("");

  if (triggerType === "future_advanced_features") {
    trackEvent("premium_modal_open", { source: trackingSource });
    setShowPricingModal(false);
    setShowFutureAdvancedModal(true);
    return;
  }

  if (user?.email?.trim()) {
    await joinPremiumWaitlist({
      email: user.email,
      source,
      isAuthenticatedEmail: true,
      inlineStatusOnly,
    });
    return;
  }

  trackEvent("premium_modal_open", { source: trackingSource });
  setShowPricingModal(true);
}

const closePremiumModal = useCallback((sourceOverride) => {
  const triggerType = normalizePremiumTriggerType(
    sourceOverride || premiumModalSource || "unknown",
  );
  const source = normalizePremiumTrackingSource(triggerType);
  trackEvent("premium_modal_close", { source });
  trackPremiumEvent(triggerType, "dismiss");
  setShowPricingModal(false);
}, [premiumModalSource]);

const closeFutureAdvancedModal = useCallback((sourceOverride) => {
  const triggerType = normalizePremiumTriggerType(
    sourceOverride || premiumModalSource || "future_advanced_features",
  );
  const source = normalizePremiumTrackingSource(triggerType);
  trackEvent("premium_modal_close", { source });
  trackPremiumEvent(triggerType, "dismiss");
  setShowFutureAdvancedModal(false);
}, [premiumModalSource]);

function openPremiumModal(source = "unknown") {
  const triggerType = normalizePremiumTriggerType(source);
  const trackingSource = normalizePremiumTrackingSource(triggerType);
  trackBetaEvent("premium_clicked", { source: trackingSource });
  trackEvent("premium_cta_click", { source: trackingSource });
  trackPremiumEvent(triggerType, "modal_open");
  track("pricing_modal_opened", { source: triggerType });
  trackEvent("premium_modal_open", { source: trackingSource });
  setPremiumModalSource(triggerType);
  setPremiumWaitlistEmail(user?.email?.trim().toLowerCase() ?? "");
  setPremiumWaitlistError("");
  if (triggerType === "future_advanced_features") {
    setShowPricingModal(false);
    setShowFutureAdvancedModal(true);
    return;
  }
  setShowPricingModal(true);
}

const saveOfferInterest = useCallback(
  async ({
    email,
    userId,
    offerType,
    source,
    phone = null,
    smsConsent = false,
  }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !offerType) {
      return {
        data: null,
        error: new Error("missing_offer_interest_fields"),
      };
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: SUPABASE_UNAVAILABLE_ERROR };
    }

    const normalizedPhone = String(phone || "").trim() || null;
    const normalizedSmsConsent = Boolean(smsConsent);
    const payload = {
      email: normalizedEmail,
      user_id: userId || null,
      offer_type: offerType,
      source: normalizePremiumTriggerType(source),
      status: "new",
      phone: normalizedPhone,
      phone_verified: false,
      sms_consent: normalizedSmsConsent,
      sms_consent_at: normalizedSmsConsent ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("offer_interest")
      .upsert(payload, {
        onConflict: "email,offer_type",
      })
      .select("id, email, offer_type, source, status")
      .maybeSingle();

    return { data, error };
  },
  [],
);


const joinPremiumWaitlist = useCallback(
  async ({ email, source, isAuthenticatedEmail = false, inlineStatusOnly = false }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const triggerType = normalizePremiumTriggerType(source);
    const trackingSource = normalizePremiumTrackingSource(triggerType);
    const offerType = getOfferTypeFromTriggerType(triggerType);

    if (!normalizedEmail) {
      setPremiumWaitlistError("Merci d’indiquer ton email.");
      trackEvent("premium_waitlist_submit", {
        source: trackingSource,
        success: false,
        reason: "missing_email",
      });
      return false;
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValidEmail) {
      setPremiumWaitlistError("Merci d’indiquer un email valide.");
      trackEvent("premium_waitlist_submit", {
        source: trackingSource,
        success: false,
        reason: "invalid_email",
      });
      return false;
    }

    try {
      setIsJoiningPremiumWaitlist(true);
      setPremiumWaitlistError("");

      const {
        data: offerInterestData,
        error: offerInterestError,
      } = await saveOfferInterest({
        email: normalizedEmail,
        userId: user?.id ?? null,
        offerType,
        source: triggerType,
      });

      if (offerInterestError) {
        console.error("Offer interest save error:", offerInterestError.message);
        if (offerType === "future_advanced") {
          showSaveNotice(
            "Merci 🙌 Nous te tiendrons informé(e) dès que cette offre sera disponible.",
            5000,
          );
        } else {
          showSaveNotice("Impossible de rejoindre la liste Premium.", 4000);
        }
        trackEvent("premium_waitlist_submit", {
          source: trackingSource,
          success: false,
          reason: "offer_interest_error",
        });
        return false;
      }

      if (offerType === "future_advanced") {
        trackEvent("premium_waitlist_submit", {
          source: trackingSource,
          success: true,
          status: offerInterestData?.status || "new",
        });
        trackPremiumEvent(triggerType, "waitlist_submit");
        setPremiumWaitlistJoined(true);
        setPremiumWaitlistEmail("");
        setPremiumWaitlistError("");
        if (showFutureAdvancedModal) {
          closeFutureAdvancedModal(triggerType);
        }
        if (!inlineStatusOnly) {
          showSaveNotice(
            isAuthenticatedEmail
              ? "Ton email connecté a bien été ajouté à cette offre avancée."
              : "✨ Tu seras informée quand cette offre avancée sera disponible.",
            8000,
          );
        }
        return true;
      }

      const { data, error } = isSupabaseConfigured
        ? await supabase.rpc("join_premium_waitlist", {
            p_email: normalizedEmail,
            p_user_id: user?.id ?? null,
            p_source: triggerType,
          })
        : { data: null, error: SUPABASE_UNAVAILABLE_ERROR };

      if (error) {
        console.error("Premium waitlist RPC error:", error.message);
        showSaveNotice("Impossible de rejoindre la liste Premium.", 4000);
        trackEvent("premium_waitlist_submit", {
          source: trackingSource,
          success: false,
          reason: "rpc_error",
        });
        return false;
      }

      const status = Array.isArray(data) ? data[0]?.status : data?.status;
      const grantsPremiumAccess = [
        "approved",
        "activated",
        "active",
        "premium_active",
      ].includes(String(status || "").toLowerCase());

      trackEvent("premium_waitlist_submit", {
        source: trackingSource,
        success: true,
        status: status || "submitted",
      });
      trackPremiumEvent(triggerType, "waitlist_submit");

      if (showPricingModal) {
        closePremiumModal(triggerType);
      } else {
        setShowPricingModal(false);
      }
      setPremiumWaitlistEmail("");
      setPremiumWaitlistError("");

      if (status === "already_exists") {
        setPremiumWaitlistJoined(true);
        if (!inlineStatusOnly) {
          showSaveNotice(
            isAuthenticatedEmail
              ? "Ton email connecté est déjà sur la liste Premium."
              : "✨ Tu es déjà sur la liste Premium.",
            8000,
          );
        }
      } else {
        setPremiumWaitlistJoined(true);
        if (!inlineStatusOnly) {
          showSaveNotice(
            isAuthenticatedEmail
              ? "Ton email connecté a bien été ajouté à la liste Premium."
              : "✨ Tu es bien sur la liste Premium. Nous te préviendrons au lancement.",
            8000,
          );
        }
      }

      if (grantsPremiumAccess) {
        await persistPremiumStatus(true);
      }

      if (!inlineStatusOnly) {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }

      return true;
    } catch (error) {
      console.error("Unexpected premium waitlist error:", error);
      showSaveNotice("Impossible de rejoindre la liste Premium.", 4000);
      trackEvent("premium_waitlist_submit", {
        source: trackingSource,
        success: false,
        reason: "unexpected_error",
      });
      return false;
    } finally {
      setIsJoiningPremiumWaitlist(false);
    }
  },
  [
    closeFutureAdvancedModal,
    closePremiumModal,
    persistPremiumStatus,
    saveOfferInterest,
    showFutureAdvancedModal,
    showPricingModal,
    showSaveNotice,
    user,
  ],
);

const handlePremiumWaitlistCTA = useCallback(async (sourceOverride) => {
  const triggerType = normalizePremiumTriggerType(
    sourceOverride ||
      premiumModalSource ||
      (billingUiState === "trial_expired" ? "premium_after_trial" : "pricing_modal"),
  );

  trackEvent("premium_modal_cta_click", {
    triggerType,
  });
  console.info("[premium-analytics]", {
    event: "premium_modal_cta_click",
    triggerType,
  });
  track("signup_cta_clicked", { source: triggerType });
  await joinPremiumWaitlist({
    email: premiumWaitlistEmail,
    source: triggerType,
  });
}, [
  billingUiState,
  joinPremiumWaitlist,
  premiumModalSource,
  premiumWaitlistEmail,
]);

  function renderBillingIdentitySection() {
    return (
      <div className="assistantSummaryBox" style={{ marginTop: 14 }}>
        <div className="dashboardSectionHeader" style={{ marginBottom: 10 }}>
          <div className="dashboardSectionHeaderMain">
            <h3>Identité de facturation</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Le SIRET peut être complété dès réception pour créer des factures
              conformes.
            </p>
          </div>
        </div>

        <div className="formGrid">
          <label className="field">
            <span>SIRET — à compléter dès réception</span>
            <input
              type="text"
              value={billingIdentityDraft.siret}
              onChange={(event) =>
                setBillingIdentityDraft((prev) => ({
                  ...prev,
                  siret: event.target.value,
                }))
              }
              placeholder="À compléter dès réception"
            />
          </label>

          <label className="field">
            <span>Raison sociale</span>
            <input
              type="text"
              value={billingIdentityDraft.legal_name}
              onChange={(event) =>
                setBillingIdentityDraft((prev) => ({
                  ...prev,
                  legal_name: event.target.value,
                }))
              }
              placeholder="Optionnel"
            />
          </label>

          <label className="field fieldFull">
            <span>Adresse</span>
            <input
              type="text"
              value={billingIdentityDraft.address}
              onChange={(event) =>
                setBillingIdentityDraft((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              placeholder="Optionnel"
            />
          </label>
        </div>

        <div className="miniActions" style={{ marginTop: 12 }}>
          <button
            className="btn btnActionSecondary btnSmall"
            type="button"
            onClick={saveBillingIdentity}
          >
            Enregistrer l’identité
          </button>
        </div>
      </div>
    );
  }

  const activityOptions =
    FISCAL_STEPS.find((candidate) => candidate.key === "activity_type")?.options || [];
  const acreOptions =
    FISCAL_STEPS.find((candidate) => candidate.key === "acre")?.options || [];
  const acreEditOptions = acreOptions.filter((opt) => opt.value !== "unknown");
  const declarationOptions =
    FISCAL_STEPS.find((candidate) => candidate.key === "declaration_frequency")?.options || [];

  function updateProfileEditDraft(nextValues) {
    setProfileEditDraft((prev) => ({
      ...prev,
      ...nextValues,
    }));
  }

  function handleProfileEditChoice(field, value) {
    if (field === "acre") {
      updateProfileEditDraft({
        acre: value,
        acre_start_date: value === "yes" ? profileEditDraft.acre_start_date || "" : "",
      });
      return;
    }

    updateProfileEditDraft({
      [field]: field === "activity_type" ? normalizeActivityType(value) : value,
    });
  }

  function handleProfileEditDateChange(field, value) {
    updateProfileEditDraft({
      [field]: normalizeDateValue(value),
    });
  }

  function buildProfileEditDraftFromAnswers(sourceAnswers = answers) {
    return {
      activity_type: sourceAnswers?.activity_type
        ? normalizeActivityType(sourceAnswers.activity_type)
        : "",
      acre: sourceAnswers?.acre || "",
      business_start_date: normalizeDateValue(
        sourceAnswers?.business_start_date || "",
      ),
      acre_start_date: normalizeDateValue(sourceAnswers?.acre_start_date || ""),
      declaration_frequency: sourceAnswers?.declaration_frequency || "",
      tva_status: normalizeTvaConfigStatus(
        sourceAnswers?.tva_status ||
          simpleAssistantProfile?.tva_status ||
          dashboardAnswers?.tva_status ||
          "unknown",
      ),
    };
  }

  function handleProfileEditCancel() {
    setProfileEditMode("pick_field");
    setAssistantFieldError("");
    setInput("");
    setProfileEditDraft({});
    setPendingStructuredProfileEdit(null);
  }

  function handleCloseProfileEdit() {
    setAssistantEditMode(false);
    setProfileEditMode("idle");
    setSelectedProfileField(null);
    setAssistantFieldError("");
    setInput("");
    setProfileEditDraft({});
    setPendingStructuredProfileEdit(null);
  }

  function handleSaveProfileFieldEdit() {
    if (selectedProfileField === "tva") {
      const nextValue = normalizeTvaConfigStatus(profileEditDraft.tva_status);
      setAssistantFieldError("");
      saveTvaConfigValue(nextValue);
      finishSelectiveEdit();
      return;
    }

    const nextAnswers = sanitizeFiscalAnswers({
      ...answers,
      activity_type:
        selectedProfileField === "activity_type"
          ? profileEditDraft.activity_type
          : answers.activity_type,
      acre:
        selectedProfileField === "acre"
          ? profileEditDraft.acre
          : answers.acre,
      business_start_date:
        selectedProfileField === "dates"
          ? profileEditDraft.business_start_date
          : answers.business_start_date,
      acre_start_date:
        selectedProfileField === "acre"
          ? profileEditDraft.acre === "yes"
            ? profileEditDraft.acre_start_date
            : null
          : selectedProfileField === "dates"
            ? answers.acre === "yes"
              ? profileEditDraft.acre_start_date
              : null
            : answers.acre_start_date,
      declaration_frequency:
        selectedProfileField === "declaration_frequency"
          ? profileEditDraft.declaration_frequency
          : answers.declaration_frequency,
    });

    const targetKeys =
      selectedProfileField === "activity_type"
        ? ["activity_type"]
        : selectedProfileField === "acre"
          ? ["acre", "acre_start_date"]
          : selectedProfileField === "dates"
            ? ["business_start_date", "acre_start_date"]
            : selectedProfileField === "declaration_frequency"
              ? ["declaration_frequency"]
              : [];

    const firstError = targetKeys
      .map((key) => getCurrentStepValidationMessage(key, nextAnswers))
      .find(Boolean);

    if (firstError) {
      setAssistantFieldError(firstError);
      return;
    }

    if (haveStructuredFiscalFieldsChanged(answers, nextAnswers)) {
      setAssistantFieldError("");
      setPendingStructuredProfileEdit({
        nextAnswers,
      });
      return;
    }

    setAssistantFieldError("");
    fiscalProfileSaveSourceRef.current = "manual_profile_edit";
    setAnswers(nextAnswers);
    showSaveNotice(
      "Profil mis à jour. Les estimations ont été recalculées.",
      3000,
    );
    finishSelectiveEdit();
  }

  function handleEditProfile() {
    trackBetaEvent("profile_view", { source: "edit_profile" });
    setAppView("assistant");
    setAssistantEditMode(true);
    setAssistantCollapsed(false);
    setProfileEditMode("pick_field");
    setSelectedProfileField(null);
    setProfileEditDraft({});
    setStepIndex(0);
    setHelpOpen(false);
    setInput("");
    setAssistantFieldError("");

    setAnswers(
      user && fiscalProfile
        ? getAssistantAnswersFromProfile(fiscalProfile)
        : sanitizeFiscalAnswers({
            entry_status: dashboardAnswers.entry_status || "micro_yes",
            status: dashboardAnswers.status || "auto_entrepreneur",
            activity_type: dashboardAnswers.activity_type,
            declaration_frequency: dashboardAnswers.declaration_frequency,
            acre: dashboardAnswers.acre,
            acre_start_date: dashboardAnswers.acre_start_date,
            business_start_date: dashboardAnswers.business_start_date,
          }),
    );

    setMessages([
      {
        role: "bot",
        text: user && fiscalProfile
          ? "Profil chargé ✅ Tu peux mettre à jour un champ ciblé."
          : "Bonjour 👋 On va mettre à jour ton profil fiscal. Réponds simplement.",
      },
    ]);

    setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  function handleOpenTvaConfiguration() {
    setAppView("assistant");
    setAssistantEditMode(false);
    setAssistantCollapsed(false);
    setProfileEditMode("idle");
    setSelectedProfileField(null);
    setAssistantFieldError("");
    setInput("");

    window.setTimeout(() => {
      tvaProfileConfigRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  function openSelectiveEditStep(stepKey) {
    if (stepKey === "tva") {
      setAssistantEditMode(true);
      setProfileEditMode("edit_step");
      setSelectedProfileField("tva");
      setProfileEditDraft(buildProfileEditDraftFromAnswers(answers));
      setAssistantCollapsed(false);
      setHelpOpen(false);
      setAssistantFieldError("");
      setInput("");

      setTimeout(() => {
        assistantRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
      return;
    }

    const firstStepKey =
      stepKey === "dates" ? "business_start_date" : stepKey;
    const targetStepIndex = getIndexByKey(firstStepKey);

    if (targetStepIndex === -1) {
      return;
    }

    setAssistantEditMode(true);
    setProfileEditMode("edit_step");
    setSelectedProfileField(stepKey);
    setProfileEditDraft(buildProfileEditDraftFromAnswers(answers));
    setAssistantCollapsed(false);
    setHelpOpen(false);
    setAssistantFieldError("");
    setStepIndex(targetStepIndex);
    setInput(
      firstStepKey === "business_start_date" || firstStepKey === "acre_start_date"
        ? normalizeDateValue(answers?.[firstStepKey] || "")
        : "",
    );

    setTimeout(() => {
      assistantRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }

  function finishSelectiveEdit() {
    setAssistantEditMode(false);
    setProfileEditMode("idle");
    setSelectedProfileField(null);
    setProfileEditDraft({});
    setPendingStructuredProfileEdit(null);
    setInput("");
    setHelpOpen(false);
    setAssistantFieldError("");
    setMessages([
      {
        role: "bot",
        text: "Profil chargé ✅ Le champ a été mis à jour.",
      },
    ]);
  }

  function handleConfirmStructuredProfileEdit() {
    if (!pendingStructuredProfileEdit?.nextAnswers) {
      return;
    }

    fiscalProfileSaveSourceRef.current = "manual_profile_edit";
    setAnswers(pendingStructuredProfileEdit.nextAnswers);
    showSaveNotice("Calculs mis à jour selon ton profil actuel", 3000);
    finishSelectiveEdit();
  }

  function handleCancelStructuredProfileEdit() {
    setPendingStructuredProfileEdit(null);
    setProfileEditDraft(buildProfileEditDraftFromAnswers(answers));
    setAssistantFieldError("");
  }

  function handleSimpleOnboardingChange(field, value) {
    setSimpleOnboardingDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function handleSimpleOnboardingOptionSelect(field, value) {
    if (field === "activity_type") {
      trackBetaEvent("onboarding_activity_selected", {
        source: "simple_onboarding",
        value,
      });
    }
    if (field === "declaration_frequency") {
      trackBetaEvent("onboarding_declaration_selected", {
        source: "simple_onboarding",
        value,
      });
    }
    handleSimpleOnboardingChange(field, value);

    if (field === "business_start_date") {
      return;
    }

    if (simpleOnboardingAdvanceTimeoutRef.current) {
      clearTimeout(simpleOnboardingAdvanceTimeoutRef.current);
    }

    simpleOnboardingAdvanceTimeoutRef.current = window.setTimeout(() => {
      setSimpleOnboardingStep((currentStep) => Math.min(currentStep + 1, 4));
      simpleOnboardingAdvanceTimeoutRef.current = null;
    }, 150);
  }

  function handleSimpleOnboardingBack() {
    if (simpleOnboardingAdvanceTimeoutRef.current) {
      clearTimeout(simpleOnboardingAdvanceTimeoutRef.current);
      simpleOnboardingAdvanceTimeoutRef.current = null;
    }
    setSimpleOnboardingStep((currentStep) => Math.max(currentStep - 1, 0));
  }

  function handleCloseSimpleOnboarding() {
    if (simpleOnboardingAdvanceTimeoutRef.current) {
      clearTimeout(simpleOnboardingAdvanceTimeoutRef.current);
      simpleOnboardingAdvanceTimeoutRef.current = null;
    }

    setShowSimpleOnboarding(false);
    setShowOnboardingConfirmation(false);
    goToView("dashboard", { push: false, focus: true });
  }

  useEffect(() => {
    if (!showSimpleOnboarding) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCloseSimpleOnboarding();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSimpleOnboarding]);

  function handleSimpleOnboardingSave() {
    const finalActivity = normalizeActivityType(
      simpleOnboardingDraft.activity_type,
    );
    const businessStartDate = normalizeDateValue(
      simpleOnboardingDraft.business_start_date,
    );
    const acreStatus = simpleOnboardingDraft.acre || "unknown";
    const tvaStatus = normalizeTvaConfigStatus(simpleOnboardingDraft.tva_status);

    if (!businessStartDate) {
      showSuccessToast("Indique ta date de début d’activité.", 3000);
      return;
    }

    const fiscalDateErrors = getFiscalDateErrors({
      business_start_date: businessStartDate,
      acre: acreStatus,
    });

    if (fiscalDateErrors.business_start_date) {
      showSuccessToast(fiscalDateErrors.business_start_date, 3000);
      return;
    }

    trackBetaEvent("onboarding_profile_filled", {
      source: "simple_onboarding",
      acreStatus,
      tvaStatus,
    });

    console.log("ONBOARDING FINAL ACTIVITY", finalActivity);
    const nextProfile = {
      activity_type: finalActivity,
      declaration_frequency:
        simpleOnboardingDraft.declaration_frequency || "mensuel",
      monthly_revenue: simpleAssistantProfile?.monthly_revenue ?? null,
      starter_monthly_revenue:
        simpleAssistantProfile?.starter_monthly_revenue ??
        simpleAssistantProfile?.monthly_revenue ??
        null,
      data_quality: "starter_profile",
      tva_status: tvaStatus,
      tva_configured: tvaStatus !== "unknown",
      updated_at: new Date().toISOString(),
    };
    const nextAnswers = sanitizeFiscalAnswers({
      ...answers,
      entry_status: answers.entry_status || "micro_yes",
      status: answers.status || "auto_entrepreneur",
      activity_type: finalActivity,
      declaration_frequency:
        simpleOnboardingDraft.declaration_frequency ||
        answers.declaration_frequency ||
        "mensuel",
      acre: acreStatus,
      business_start_date: businessStartDate,
      acre_start_date: answers.acre_start_date || null,
      tva_status: tvaStatus,
    });

    localStorage.setItem(SIMPLE_PROFILE_KEY, JSON.stringify(nextProfile));
    fiscalProfileSaveSourceRef.current = "starter_onboarding";
    setAnswers(nextAnswers);
    setSimpleAssistantProfile(nextProfile);
    setShowSimpleOnboarding(false);
    setShowOnboardingConfirmation(true);
    setSimpleOnboardingStep(0);
    if (simpleOnboardingAdvanceTimeoutRef.current) {
      clearTimeout(simpleOnboardingAdvanceTimeoutRef.current);
      simpleOnboardingAdvanceTimeoutRef.current = null;
    }
    setAssistantEditMode(false);
    setAssistantCollapsed(false);
    trackBetaEvent("onboarding_completed", {
      source: "simple_onboarding",
      dataQuality: nextProfile.data_quality,
    });
    goToView("dashboard", { push: true, focus: true });
  }

  function handleProfileMissingAcreChange(value) {
    const nextAcre = value || null;
    setAnswers((currentAnswers) =>
      sanitizeFiscalAnswers({
        ...currentAnswers,
        entry_status: currentAnswers.entry_status || "micro_yes",
        status: currentAnswers.status || "auto_entrepreneur",
        activity_type:
          currentAnswers.activity_type || dashboardAnswers.activity_type,
        declaration_frequency:
          currentAnswers.declaration_frequency ||
          dashboardAnswers.declaration_frequency,
        acre: nextAcre,
        acre_start_date:
          nextAcre === "yes"
            ? currentAnswers.acre_start_date ||
              dashboardAnswers.acre_start_date ||
              null
            : null,
      }),
    );
  }

  function handleProfileMissingDateChange(field, value) {
    const normalizedDate = normalizeDateValue(value);
    setAnswers((currentAnswers) =>
      sanitizeFiscalAnswers({
        ...currentAnswers,
        entry_status: currentAnswers.entry_status || "micro_yes",
        status: currentAnswers.status || "auto_entrepreneur",
        activity_type:
          currentAnswers.activity_type || dashboardAnswers.activity_type,
        declaration_frequency:
          currentAnswers.declaration_frequency ||
          dashboardAnswers.declaration_frequency,
        [field]: normalizedDate || null,
      }),
    );
  }

  function openSimpleOnboardingEdit() {
    trackBetaEvent("onboarding_started", { source: "edit_profile" });
    setSimpleOnboardingDraft({
      activity_type: normalizeActivityType(
        dashboardAnswers?.activity_type ||
          answers.activity_type ||
          simpleAssistantProfile?.activity_type ||
          "services",
      ),
      declaration_frequency:
        dashboardAnswers?.declaration_frequency ||
        answers.declaration_frequency ||
        simpleAssistantProfile?.declaration_frequency ||
        "mensuel",
      business_start_date:
        dashboardAnswers?.business_start_date || answers.business_start_date || "",
      acre: dashboardAnswers?.acre || answers.acre || "unknown",
      tva_status:
        dashboardAnswers?.tva_status ||
        answers.tva_status ||
        simpleAssistantProfile?.tva_status ||
        "unknown",
    });
    setSimpleOnboardingStep(0);
    setShowSimpleOnboarding(true);
  }

  function handleSelectTvaConfig(value) {
    const nextValue = normalizeTvaConfigStatus(value);
    console.log("TVA CONFIG SELECTED", nextValue);
    setTvaConfigDraft(nextValue);
  }

  function saveTvaConfigValue(value) {
    const normalizedTvaConfigDraft = normalizeTvaConfigStatus(value);
    console.log("TVA CONFIG SAVED", normalizedTvaConfigDraft);
    const nextProfile = {
      ...(simpleAssistantProfile || {}),
      activity_type:
        normalizeActivityType(
          simpleAssistantProfile?.activity_type ||
            dashboardAnswers?.activity_type ||
            "services",
        ) ||
        "services",
      monthly_revenue: simpleAssistantProfile?.monthly_revenue ?? null,
      starter_monthly_revenue:
        simpleAssistantProfile?.starter_monthly_revenue ??
        simpleAssistantProfile?.monthly_revenue ??
        null,
      tva_status: normalizedTvaConfigDraft,
      tva_configured: true,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(SIMPLE_PROFILE_KEY, JSON.stringify(nextProfile));
    setSimpleAssistantProfile(nextProfile);
    setAnswers((currentAnswers) =>
      sanitizeFiscalAnswers({
        ...currentAnswers,
        tva_status: normalizedTvaConfigDraft,
      }),
    );
    showSuccessToast(
      "TVA configurée. Tes alertes et factures seront adaptées.",
      3000,
    );
    setIsEditingTVA(false);
  }

  function handleSaveTvaConfig() {
    saveTvaConfigValue(tvaConfigDraft);
  }

  async function handleCopyExpertShareLink() {
    trackBetaEvent("share_with_advisor_clicked", {
      source: "dashboard_advisor_share",
    });
    const shareUrl = `${window.location.origin}/expert-view?demo=1`;

    try {
      try {
        localStorage.setItem(
          EXPERT_VIEW_DEMO_KEY,
          JSON.stringify({
            profile: {
              activity_type:
                dashboardAnswers.activity_type ||
                simpleAssistantProfile?.activity_type ||
                "services",
              declaration_frequency:
                dashboardAnswers.declaration_frequency ||
                simpleAssistantProfile?.declaration_frequency ||
                "mensuel",
              tva_status:
                simpleAssistantProfile?.tva_status ||
                dashboardAnswers.tva_status ||
                "unknown",
              acre: dashboardAnswers.acre,
              business_start_date: dashboardAnswers.business_start_date,
            },
            answers: {
              acre: dashboardAnswers.acre,
              declaration_frequency: dashboardAnswers.declaration_frequency,
            },
            revenues: revenues.map((revenue) => ({
              amount: Number(revenue?.amount || 0),
              date: revenue?.date || null,
            })),
            created_at: new Date().toISOString(),
          }),
        );
      } catch {
        // The share link still opens the demo advisor view if local storage fails.
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      showSaveNotice(
        "Lien copié. Tu peux l’envoyer à ton conseiller.",
        3500,
      );
    } catch {
      showSaveNotice(
        "Impossible de copier le lien pour le moment.",
        3500,
      );
    }
  }

  useEffect(() => {
    const isAnyModalOpen = Boolean(
        showBetaNotice ||
        showSimpleOnboarding ||
        showOnboardingConfirmation ||
        authOpen ||
        profileConflictState.open ||
        pendingStructuredProfileEdit ||
        showCGU ||
        showPrivacy ||
        showPricingModal ||
        showFutureAdvancedModal ||
        showResetModal ||
        showCashImpactModal ||
        showTVADiagnosticModal ||
        explanationModalType ||
        showReminderModal ||
        showAddRevenue ||
        showInvoiceGenerator,
    );

    document.body.style.overflow = isAnyModalOpen ? "hidden" : "";
    document.documentElement.style.overflow = isAnyModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [
    authOpen,
    explanationModalType,
    pendingStructuredProfileEdit,
    profileConflictState.open,
    showAddRevenue,
    showBetaNotice,
    showCGU,
    showCashImpactModal,
    showFutureAdvancedModal,
    showInvoiceGenerator,
    showOnboardingConfirmation,
    showPricingModal,
    showPrivacy,
    showReminderModal,
    showResetModal,
    showSimpleOnboarding,
    showTVADiagnosticModal,
  ]);

  const legalPage = LEGAL_PAGES[currentPath];

  if (legalPage) {
    return <LegalPage page={legalPage} path={currentPath} />;
  }

  if (window.location.pathname === "/expert-view") {
    return <ExpertView />;
  }

  return (
    <>
      {showBetaNotice && (
        <div className="modalOverlay">
          <div className="modalCard">
            <h3>🚧 Version bêta</h3>
            <p style={{ marginBottom: "12px" }}>
              Cet outil est actuellement en phase de test.
            </p>
            <ul style={{ paddingLeft: "18px", marginBottom: "12px" }}>
              <li>Ajouter vos revenus</li>
              <li>Estimation des charges</li>
              <li>Comprendre vos obligations</li>
            </ul>
            <p style={{ fontSize: "13px", opacity: 0.8 }}>
              Certaines fonctionnalités sont limitées.
            </p>
            <p style={{ marginTop: "10px", fontSize: "13px" }}>
              🙏 Merci pour votre retour — il nous aidera à améliorer le
              produit.
            </p>
            <button
              className="btn btnPrimary"
              style={{ marginTop: "12px" }}
              onClick={() => {
                localStorage.setItem(BETA_SEEN_KEY, "1");
                trackBetaEvent("beta_modal_started", { source: "beta_notice" });
                if (showSimpleOnboarding) {
                  trackBetaEvent("onboarding_started", {
                    source: "beta_notice",
                  });
                }
                setShowBetaNotice(false);
              }}
            >
              Commencer
            </button>
          </div>
        </div>
      )}

      {showSimpleOnboarding && !showBetaNotice && (
        <div className="modalOverlay">
          <div className="modalCard simpleOnboardingModal">
            <button
              className="simpleOnboardingClose"
              type="button"
              aria-label="Fermer l’onboarding"
              onClick={handleCloseSimpleOnboarding}
            >
              ×
            </button>
            <div className="sectionHead">
              <div>
                <h3>Configurer ton profil fiscal</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Cinq questions rapides pour préparer ton espace.
                </p>
              </div>
            </div>

            <div className="simpleOnboardingSteps">
              {[0, 1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`simpleStepDot ${
                    simpleOnboardingStep === step ? "isActive" : ""
                  }`}
                />
              ))}
            </div>

            {simpleOnboardingStep === 0 && (
              <div className="simpleOnboardingBody">
                <h4>Activité principale</h4>
                <div className="simpleChoiceGrid">
                  {[
                    { value: "services", label: "Services" },
                    { value: "commerce", label: "Commerce" },
                    { value: "mixte", label: "Mixte" },
                  ].map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={`simpleChoiceButton ${
                        simpleOnboardingDraft.activity_type === choice.value
                          ? "isSelected"
                          : ""
                      }`}
                      onClick={() =>
                        handleSimpleOnboardingOptionSelect(
                          "activity_type",
                          choice.value,
                        )
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {simpleOnboardingStep === 1 && (
              <div className="simpleOnboardingBody">
                <h4>Rythme de déclaration</h4>
                <div className="simpleChoiceGrid">
                  {[
                    { value: "mensuel", label: "Mensuelle" },
                    { value: "trimestriel", label: "Trimestrielle" },
                  ].map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={`simpleChoiceButton ${
                        simpleOnboardingDraft.declaration_frequency ===
                        choice.value
                          ? "isSelected"
                          : ""
                      }`}
                      onClick={() =>
                        handleSimpleOnboardingOptionSelect(
                          "declaration_frequency",
                          choice.value,
                        )
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {simpleOnboardingStep === 2 && (
              <div className="simpleOnboardingBody">
                <h4>Date de début d’activité</h4>
                <label className="field">
                  <span>Début d’activité</span>
                  <input
                    type="date"
                    value={simpleOnboardingDraft.business_start_date}
                    onChange={(event) =>
                      handleSimpleOnboardingChange(
                        "business_start_date",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <p className="muted" style={{ margin: 0 }}>
                  Cette date aide à fiabiliser les rappels et les repères fiscaux.
                </p>
              </div>
            )}

            {simpleOnboardingStep === 3 && (
              <div className="simpleOnboardingBody">
                <h4>Statut ACRE</h4>
                <div className="simpleChoiceGrid">
                  {[
                    { value: "to_request", label: "À demander" },
                    { value: "requested", label: "Demandée" },
                    { value: "yes", label: "Acceptée" },
                    { value: "no", label: "Non concerné" },
                    { value: "unknown", label: "Je ne sais pas" },
                  ].map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={`simpleChoiceButton ${
                        simpleOnboardingDraft.acre === choice.value
                          ? "isSelected"
                          : ""
                      }`}
                      onClick={() =>
                        handleSimpleOnboardingOptionSelect("acre", choice.value)
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {simpleOnboardingStep === 4 && (
              <div className="simpleOnboardingBody">
                <h4>Statut TVA</h4>
                <div className="simpleChoiceGrid">
                  {[
                    { value: "franchise", label: "Franchise en base" },
                    { value: "active", label: "TVA active" },
                    { value: "unknown", label: "Je ne sais pas" },
                  ].map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={`simpleChoiceButton ${
                        simpleOnboardingDraft.tva_status === choice.value
                          ? "isSelected"
                          : ""
                      }`}
                      onClick={() =>
                        handleSimpleOnboardingChange("tva_status", choice.value)
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {simpleOnboardingStep > 0 && (
            <div className="miniActions" style={{ marginTop: 18 }}>
              {simpleOnboardingStep > 0 && (
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={handleSimpleOnboardingBack}
                >
                  Retour
                </button>
              )}
              {simpleOnboardingStep === 2 && (
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => {
                    if (!normalizeDateValue(simpleOnboardingDraft.business_start_date)) {
                      showSuccessToast("Indique ta date de début d’activité.", 3000);
                      return;
                    }
                    setSimpleOnboardingStep(3);
                  }}
                >
                  Continuer
                </button>
              )}
              {simpleOnboardingStep === 4 && (
                <>
                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={() => handleSimpleOnboardingSave()}
                  >
                    Valider
                  </button>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {showOnboardingConfirmation && !showBetaNotice && (
        <div className="modalOverlay">
          <div className="modalCard simpleOnboardingModal">
            <div className="sectionHead">
              <div>
                <h3>Ton espace fiscal est prêt</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Tu peux maintenant sauvegarder ton suivi et retrouver ton espace plus tard.
                </p>
              </div>
            </div>
            <div className="onboardingSummaryList">
              <div>
                <span>Activité</span>
                <strong>{getSimpleActivityLabel(dashboardAnswers.activity_type)}</strong>
              </div>
              <div>
                <span>Déclaration</span>
                <strong>
                  {dashboardAnswers.declaration_frequency === "trimestriel"
                    ? "Trimestrielle"
                    : "Mensuelle"}
                </strong>
              </div>
              <div>
                <span>Début d’activité</span>
                <strong>{dashboardAnswers.business_start_date || "À compléter"}</strong>
              </div>
              <div>
                <span>ACRE</span>
                <strong>{getAcreStatusLabel(dashboardAnswers.acre)}</strong>
              </div>
              <div>
                <span>TVA</span>
                <strong>{getTvaConfigLabel(dashboardAnswers.tva_status)}</strong>
              </div>
            </div>
            <div className="miniActions" style={{ marginTop: 18 }}>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  setShowOnboardingConfirmation(false);
                  openAuthModal("signup");
                }}
              >
                Créer mon compte
              </button>
              <button
                className="btn btnGhost"
                type="button"
                onClick={() => {
                  setShowOnboardingConfirmation(false);
                  goToDashboard({ scroll: false });
                }}
              >
                Continuer sans compte
              </button>
            </div>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
              Tes données restent temporaires tant que ton compte n’est pas créé.
            </p>
          </div>
        </div>
      )}

      <AppShell
        header={
          <MainNavigation
            appView={appView}
            connectedAccountLabel={connectedAccountLabel}
            feedbackFormUrl={FEEDBACK_FORM_URL}
            isLocalhostQa={isLocalhostQa}
            localPremiumStatus={localPremiumStatus}
            logoutPending={logoutPending}
            onGoToAssistant={goToAssistant}
            onGoToDashboard={goToDashboard}
            onGoToInvoices={() => {
              setAppView("dashboard");
              setTimeout(() => {
                document
                  .getElementById("invoices-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 150);
            }}
            onGoToLandingHome={() => goToLandingSection("home")}
            onGoToLandingServices={() => goToLandingSection("services")}
            onGoToPricing={goToPricing}
            onLogout={handleLogout}
            onToggleLocalPremiumQa={toggleLocalPremiumQa}
            profileLine={profileLine}
            topbarGreetingLabel={topbarGreetingLabel}
            user={user}
            viewLabel={viewLabel}
          />
        }
      >

        <main className={`container ${focusMode ? "focusMode" : ""}`}>
        {saveNotice && (
  <div
    className="floatingStatusNotice floatingStatusNoticePrimary"
    role="status"
    aria-live="polite"
    style={{
      position: "fixed",
      top: 88,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 3000,
      width: "min(720px, calc(100vw - 24px))",
      padding: "14px 16px",
      borderRadius: 14,
      background: "#f0fdf4",
      border: "1px solid #86efac",
      color: "#166534",
      boxShadow: "0 16px 40px rgba(22, 101, 52, 0.14)",
    }}
  >
    {typeof saveNotice === "string" ? (
      <div style={{ fontWeight: 600 }}>{saveNotice}</div>
    ) : (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{saveNotice.title}</div>
        <div>{saveNotice.body}</div>
        {saveNotice.cta === "auth" && (
          <div>
            <button
              className="btn btnActionSecondary btnSmall"
              type="button"
              onClick={() => openAuthModal("signup")}
            >
              Créer mon compte
            </button>
          </div>
        )}
      </div>
    )}
  </div>
)}
        {successToast && !showPricingModal && (
  <div
    className="floatingStatusNotice floatingStatusNoticeSuccess"
    role="status"
    aria-live="polite"
    style={{
      position: "fixed",
      top: 88,
      right: 16,
      zIndex: 3001,
      width: "min(360px, calc(100vw - 24px))",
      padding: "12px 14px",
      borderRadius: 14,
      background: "#f3fbf6",
      border: "1px solid #bfe7c8",
      color: "#166534",
      boxShadow: "0 16px 36px rgba(22, 101, 52, 0.12)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
      {successToast}
    </div>
    <button
      className="iconBtn"
      type="button"
      aria-label="Masquer la notification"
      onClick={() => {
        if (successToastTimeoutRef.current) {
          clearTimeout(successToastTimeoutRef.current);
          successToastTimeoutRef.current = null;
        }
        setSuccessToast(null);
      }}
      style={{ padding: "4px 8px", minWidth: "auto" }}
    >
      ✕
    </button>
  </div>
)}
        {mode === "expert" ? (
          <ExpertDashboard />
        ) : (
          <>
          {appView === "landing" && (
            <section id="home" ref={heroRef} className="card hero heroSaaS">
              <div className="heroGrid">
                <div className="heroLeft">
                  <div className="heroBadge">MVP en test</div>
                  <div className="heroProductName">Microassist</div>
                  <h1>
                    Ne rate plus jamais une déclaration URSSAF
                    <br />
                    et sache combien mettre de côté chaque mois
                  </h1>

                  <div className="heroLead">
                    <p>
                      Assistant fiscal simple pour micro-entrepreneurs.
                    </p>
                  </div>

                  <p className="assistantIntro">
                    Accès libre pendant la phase de test. Aucun paiement demandé.
                  </p>

                  <div className="heroActions">
                    <button
                      className="btn btnPrimary"
                      onClick={() => {
                        track("click_tester_simulateur");
                        goToView("assistant", { push: true, focus: true });

                        setTimeout(() => {
                          scrollToRef(assistantRef);
                        }, 80);
                      }}
                      type="button"
                    >
                      Découvrir mon suivi
                    </button>

                    <button
                      className="btn btnGhost"
                      onClick={handleOpenInvoiceGenerator}
                      type="button"
                    >
                      Créer une facture
                    </button>

                  </div>
                </div>

                <div className="heroRight">
                  <div className="heroPanel">
                    <div className="heroPanelTitle">Suivi simple</div>
                    <p className="muted" style={{ margin: 0 }}>
                      Revenus, charges, factures et TVA au même endroit.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {!focusMode && appView === "landing" && (
            <section ref={servicesRef} className="card">
              <div className="sectionHead">
                <h2>Pour qui ?</h2>
              </div>
              <ul className="roadmaplist">
                <li>Micro-entrepreneurs débutants</li>
                <li>Freelances perdus avec l’administratif</li>
                <li>Indépendants qui veulent éviter les erreurs URSSAF et TVA</li>
              </ul>
            </section>
          )}

          {!focusMode && appView === "landing" && (
            <section className="card">
              <div className="sectionHead">
                <h2>Ce que tu obtiens</h2>
              </div>
              <div className="heroKpis">
                <div className="kpi">
                  <div className="kpiLabel">URSSAF</div>
                  <div className="kpiValue">Échéance et montant à prévoir</div>
                </div>
                <div className="kpi">
                  <div className="kpiLabel">Factures</div>
                  <div className="kpiValue">PDF prêt et suivi de paiement</div>
                </div>
                <div className="kpi">
                  <div className="kpiLabel">TVA</div>
                  <div className="kpiValue">Vigilance claire</div>
                </div>
              </div>
            </section>
          )}

          {!focusMode && appView === "landing" && (
            <section className="card pricingAccessSection">
              <div className="sectionHead" style={{ marginBottom: 14 }}>
                <div>
                  <h2>Tarifs & accès</h2>
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    Accès gratuit pendant la phase de test. Aucun paiement demandé.
                  </p>
                </div>
              </div>

              <div className="pricingAccessGrid">
                <div className="pricingAccessCard">
                  <div className="pricingAccessTop">
                    <div className="pricingAccessTitle">Gratuit</div>
                    <div className="pricingAccessPrice">Sans compte</div>
                  </div>
                  <ul className="pricingAccessList">
                    <li>Assistant fiscal</li>
                    <li>Estimation des charges</li>
                    <li>Création PDF facture</li>
                    <li>Historique local navigateur</li>
                  </ul>
                </div>

                <div className="pricingAccessCard">
                  <div className="pricingAccessTop">
                    <div className="pricingAccessTitle">Compte gratuit</div>
                    <div className="pricingAccessPrice">0€ / mois</div>
                  </div>
                  <ul className="pricingAccessList">
                    <li>Historique sécurisé</li>
                    <li>Synchronisation multi-appareils</li>
                    <li>Récupération après refresh</li>
                    <li>Mon espace fiscal personnel</li>
                  </ul>
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={() => openAuthModal("signup")}
                  >
                    Créer mon compte
                  </button>
                </div>

                <div className="pricingAccessCard pricingAccessCardPremium">
                  <div className="pricingAccessBadge">Le plus complet</div>
                  <div className="pricingAccessTop">
                    <div className="pricingAccessTitle">SMS et rappels avancés</div>
                    <div className="pricingAccessPrice">Bientôt Premium</div>
                  </div>
                  <ul className="pricingAccessList">
                    <li>SMS et rappels avancés bientôt en Premium</li>
                    <li>Rappels URSSAF</li>
                    <li>Alerte TVA / ACRE / CFE</li>
                    <li>Historique illimité</li>
                    <li>Exports avancés</li>
                    <li>Assistant proactif</li>
                  </ul>
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={() => handleOpenSaveModal("pricing_access_block")}
                  >
                    Découvrir les options à venir
                  </button>
                </div>
              </div>
            </section>
          )}

          {!focusMode && appView === "landing" && (
            <section ref={securityRef} className="card">
              <div className="sectionHead">
                <h2>🔒 Sécurité</h2>
              </div>

              <div className="securityGrid">
                <div className="securityItem">
                  <strong>Données protégées</strong>
                  <p className="muted">Ton espace reste personnel.</p>
                </div>
                <div className="securityItem">
                  <strong>Aucun paiement demandé</strong>
                  <p className="muted">Pas de carte bancaire pendant le test.</p>
                </div>
                <div className="securityItem">
                  <strong>Pas de déclaration automatique</strong>
                  <p className="muted">Tu gardes la main sur URSSAF et impôts.</p>
                </div>
              </div>
            </section>
          )}

          {focusMode && appView === "landing" && (
            <div className="focusBar">
              <div className="focusLeft">
                <strong>Mode démo</strong>
              </div>

              <div className="focusLinks">
                <button
                  className="btn btnGhost btnSmall"
                  onClick={openSecuritySection}
                >
                  🔒 Sécurité
                </button>

                <button
                  className="btn btnGhost btnSmall"
                  onClick={() => {
                    trackEvent("feedback_open", feedbackContextSnapshot);
                    window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
                  }}
                >
                  ⭐ Avis
                </button>

                <button
                  className="btn btnGhost btnSmall"
                  onClick={() => {
                    setFocusMode(false);
                    setAppView("landing");
                  }}
                >
                  Page complète
                </button>
              </div>
            </div>
          )}

          {appView === "assistant" ? (
            <section id="assistant" ref={assistantRef} className="card">
              <div className="assistantHeader">
                <div>
                  <div className="assistantTitleRow">
                    <h2>
                      {isFiscalProfileCreateMode
                        ? "Créer mon profil fiscal"
                        : isFiscalProfileEditMode
                          ? "Modifier mon profil fiscal"
                          : "Mon profil fiscal"}
                    </h2>

                    <div className="profileStatus">
                      {isFiscalProfileEditMode ? (
                        <span className="statusOk">🟢 Mode édition</span>
                      ) : isFiscalProfileSummaryMode ? (
                        <span className="statusOk">
                          🟢 Profil configuré
                        </span>
                      ) : (
                        <span className="statusWarn">
                          🟡 Profil à compléter
                        </span>
                      )}
                    </div>

                    {isFiscalProfileCreateMode && revenues.length > 0 && (
                      <button
                        className="btn btnGhost btnSmall"
                        onClick={() => setAssistantCollapsed((v) => !v)}
                        type="button"
                      >
                        {assistantCollapsed ? "Afficher" : "Réduire"}
                      </button>
                    )}
                  </div>
                  {isFiscalProfileSummaryMode && (
                    <p className="muted assistantIntro" style={{ marginTop: 6 }}>
                      Tu peux compléter ton profil à tout moment pour améliorer la précision.
                    </p>
                  )}

                  <div className="topActions">
                  
                   
                    {isFiscalProfileEditMode && (
                      <button
                        className="btn btnGhost btnSmall"
                        onClick={handleCloseProfileEdit}
                        type="button"
                      >
                        Retour au résumé
                      </button>
                    )}
                    {hasDraft && isFiscalProfileCreateMode && (
                      <button
                        className="btn btnGhost btnSmall"
                        onClick={handleResumeDraft}
                        type="button"
                      >
                        Reprendre
                      </button>
                    )}
                    <button
                      className="btn btnSubtle btnSmall"
                      onClick={handleLocalProfileRestart}
                      type="button"
                    >
                      Réinitialiser et recommencer
                    </button>
                  </div>


                  {isFiscalProfileCreateMode && (
                    <ul className="assistantBenefits">
                      <li>une estimation simple de tes charges</li>
                      <li>un repère sur ta prochaine échéance</li>
                      <li>une vision claire de ta TVA</li>
                      <li>
                        un accès à ton espace fiscal pour suivre tes revenus
                      </li>
                    </ul>
                  )}

                </div>

                {isFiscalProfileCreateMode && (
                  <div className="progress">
                    <div className="progressBar">
                      <div
                        className="progressFill"
                        style={{
                          width: `${((stepIndex + 1) / FISCAL_STEPS.length) * 100}%`,
                        }}
                      />
                    </div>

                    {(hasDraft || lastSavedAt) && (
                      <div className="savedHint">
                        💾{" "}
                        {lastSavedAt
                          ? `Sauvegardé à ${new Date(
                              lastSavedAt,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Sauvegarde trouvée"}
                        {restoredAt && " — restauré ✅"}
                        <div className="savedActions">
                          <button
                            className="btn btnGhost"
                            onClick={handleNewSession}
                            type="button"
                          >
                            Recommencer
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      Étape{" "}
                      <strong>
                        {Math.min(stepIndex + 1, FISCAL_STEPS.length)}
                      </strong>{" "}
                      / {FISCAL_STEPS.length}
                    </div>
                  </div>
                )}
              </div>

              {showFirstRevenueOnboarding && isFiscalProfileCreateMode && (
                <div
                  style={{
                    marginTop: 18,
                    marginBottom: 8,
                    padding: 18,
                    borderRadius: 18,
                    background:
                      "linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(250, 245, 255, 0.95))",
                    border: "1px solid rgba(196, 181, 253, 0.4)",
                    boxShadow: "0 14px 34px rgba(148, 163, 184, 0.12)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#312e81",
                    }}
                  >
                    🎯 Super, ton premier revenu est enregistré.
                  </div>
                  <p
                    className="assistantIntro"
                    style={{
                      marginTop: 10,
                      marginBottom: 0,
                      color: "#4338ca",
                      maxWidth: 760,
                    }}
                  >
                    Pour calculer correctement tes charges, tes alertes TVA et
                    tes échéances, j’ai besoin de quelques informations sur ton
                    activité.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 16,
                    }}
                  >
                    <button
                      className="btn btnPrimary"
                      type="button"
                      onClick={handleStartFirstRevenueOnboarding}
                    >
                      Commencer mon profil
                    </button>
                    <button
                      className="btn btnGhost"
                      type="button"
                      onClick={handleDismissFirstRevenueOnboarding}
                    >
                      Plus tard
                    </button>
                  </div>
                </div>
              )}

              {isFiscalProfileCreateMode && renderBillingIdentitySection()}

              {isFiscalProfileSummaryMode ? (
                <>
                  <div className="assistantCompletionBanner">
                    <div className="assistantCompletionTitle">
                      Ton profil est prêt
                    </div>
                    <p className="muted assistantIntro">
                      Tout est en place. Vérifie simplement ces informations
                      avant d’ouvrir ton espace fiscal.
                    </p>
                    <div className="miniActions" style={{ marginTop: 16 }}>
  <button
    className="btn btnPrimary"
    type="button"
    onClick={goToDashboard}
  >
    Accéder à mon espace fiscal
  </button>

</div>
                    {!isProfileComplete && (
                      <div className="dashboardTrustCard" style={{ marginTop: 14 }}>
                        <div className="dashboardRecommendationTitle">
                          Profil configuré
                        </div>
                        <div className="dashboardRecommendationText">
                          Tu peux compléter ton profil à tout moment pour améliorer la précision.
                        </div>
                        <div className="dashboardRecommendationActions">
                          <button
                            className="btn btnActionSecondary btnSmall"
                            type="button"
                            onClick={handleEditProfile}
                          >
                            Compléter mon profil
                          </button>
                        </div>
                      </div>
                    )}
                    <div ref={profileReviewRef} style={{ scrollMarginTop: 100 }}>
                      <div className="assistantSummaryBox" style={{ marginTop: 14 }}>
                        <h3>Mon profil</h3>
                        <button
                          className="btn btnActionSecondary btnSmall"
                          type="button"
                          onClick={openSimpleOnboardingEdit}
                        >
                          Modifier
                        </button>
                        <ul className="assistantSummaryList" style={{ marginTop: 14 }}>
                          <li>
                            <strong>Activité :</strong>{" "}
                            {labelFromOptions(
                              "activity_type",
                              answers.activity_type || dashboardAnswers.activity_type,
                            ) || "non renseigné"}
                          </li>
                          <li>
                            <strong>Déclaration :</strong>{" "}
                            {labelFromOptions(
                              "declaration_frequency",
                              answers.declaration_frequency ||
                                dashboardAnswers.declaration_frequency,
                            ) || "non renseigné"}
                          </li>
                          <li>
                            <strong>TVA :</strong> {profileConfirmationTvaLabel}
                          </li>
                          <li>
                            <strong>ACRE :</strong>{" "}
                            {hasProfileAcreValue
                              ? labelFromOptions("acre", dashboardAnswers.acre) ||
                                getAcreStatusLabel(dashboardAnswers.acre)
                              : "Je ne sais pas"}
                          </li>
                          <li>
                            <strong>Date de début :</strong>{" "}
                            {dashboardAnswers.business_start_date || "optionnelle"}
                          </li>
                          {dashboardAnswers.acre === "yes" && (
                            <li>
                              <strong>Début ACRE :</strong>{" "}
                              {dashboardAnswers.acre_start_date || "non renseigné"}
                            </li>
                          )}
                        </ul>
                      </div>
                      {renderBillingIdentitySection()}
                      <div
                        ref={tvaProfileConfigRef}
                        className="assistantSummaryBox tvaProfileConfigBox"
                        style={{ marginTop: 14, scrollMarginTop: 100 }}
                      >
                        {!savedTvaValue || isEditingTVA ? (
                          <>
                            <div className="dashboardSectionHeader" style={{ marginBottom: 10 }}>
                              <div className="dashboardSectionHeaderMain">
                                <h3>TVA</h3>
                                <p className="muted" style={{ marginTop: 6 }}>
                                  Choisis le statut le plus proche de ta situation.
                                </p>
                              </div>
                              <button
                                className="btn btnActionUtility btnSmall"
                                type="button"
                                onClick={() => openExplanationModal("tva")}
                              >
                                Comprendre la TVA
                              </button>
                            </div>
                            <div className="choiceRow" style={{ marginTop: 12 }}>
                              {TVA_CONFIG_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  className={`btn btnChoice ${
                                    normalizeTvaConfigStatus(tvaConfigDraft) === option.value
                                      ? "isSelected"
                                      : ""
                                  }`}
                                  type="button"
                                  onClick={() => handleSelectTvaConfig(option.value)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            <div className="miniActions" style={{ marginTop: 12 }}>
                              <button
                                className="btn btnActionSecondary btnSmall"
                                type="button"
                                onClick={handleSaveTvaConfig}
                              >
                                Enregistrer la TVA
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="dashboardSectionHeader" style={{ marginBottom: 0 }}>
                            <div className="dashboardSectionHeaderMain">
                              <h3>Modifier ma TVA</h3>
                              <p className="muted" style={{ marginTop: 6 }}>
                                TVA actuelle : {savedTvaLabel} ✅
                              </p>
                            </div>
                            <button
                              className="btn btnActionSecondary btnSmall"
                              type="button"
                              onClick={() => {
                                setTvaConfigDraft(normalizeTvaConfigStatus(savedTvaValue));
                                setIsEditingTVA(true);
                              }}
                            >
                              Modifier
                            </button>
                          </div>
                        )}
                      </div>
                      {!hasProfileAcreValue && (
                        <div className="assistantSummaryBox" style={{ marginTop: 14 }}>
                          <h3>ACRE</h3>
                          <div className="choiceRow" style={{ marginTop: 12 }}>
                            {acreEditOptions.map((opt) => (
                              <button
                                key={opt.value}
                                className="btn btnChoice"
                                type="button"
                                onClick={() => handleProfileMissingAcreChange(opt.value)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {!hasProfileStartDate && (
                        <div className="assistantSummaryBox" style={{ marginTop: 14 }}>
                          <h3>Date de début d’activité</h3>
                          <div className="chatInput" style={{ marginTop: 12 }}>
                            <input
                              value={dashboardAnswers.business_start_date || ""}
                              onChange={(event) =>
                                handleProfileMissingDateChange(
                                  "business_start_date",
                                  event.target.value,
                                )
                              }
                              aria-label="Date début activité"
                              type="date"
                              max={getTodayIsoDate()}
                            />
                          </div>
                        </div>
                      )}
                      {dashboardAnswers.acre === "yes" &&
                        !dashboardAnswers.acre_start_date && (
                          <div className="assistantSummaryBox" style={{ marginTop: 14 }}>
                            <h3>Date de début ACRE</h3>
                            <div className="chatInput" style={{ marginTop: 12 }}>
                              <input
                                value={dashboardAnswers.acre_start_date || ""}
                                onChange={(event) =>
                                  handleProfileMissingDateChange(
                                    "acre_start_date",
                                    event.target.value,
                                  )
                                }
                                aria-label="Date ACRE"
                                type="date"
                                max={getTodayIsoDate()}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                </>
              ) : isFiscalProfileEditMode ? (
                <>
                  <div className="assistantSummaryBox">
                    <h3>Profil actuel</h3>
                    <ul className="assistantSummaryList">
                      <li>
                        <strong>Activité :</strong>{" "}
                        {labelFromOptions(
                          "activity_type",
                          answers.activity_type || dashboardAnswers.activity_type,
                        ) || "non renseigné"}
                      </li>
                      <li>
                        <strong>Déclaration :</strong>{" "}
                        {labelFromOptions(
                          "declaration_frequency",
                          answers.declaration_frequency || dashboardAnswers.declaration_frequency,
                        ) || "non renseigné"}
                      </li>
                      <li>
                        <strong>TVA :</strong> {profileConfirmationTvaLabel}
                      </li>
                      <li>
                        <strong>ACRE :</strong>{" "}
                        {labelFromOptions(
                          "acre",
                          answers.acre || dashboardAnswers.acre,
                        ) || "Non"}
                      </li>
                      <li>
                        <strong>Date de début :</strong>{" "}
                        {answers.business_start_date ||
                          dashboardAnswers.business_start_date ||
                          "optionnelle"}
                      </li>
                      {(answers.acre === "yes" || dashboardAnswers.acre === "yes") && (
                        <li>
                          <strong>Début ACRE :</strong>{" "}
                          {answers.acre_start_date ||
                            dashboardAnswers.acre_start_date ||
                            "non renseigné"}
                        </li>
                      )}
                    </ul>
                  </div>

                  {renderBillingIdentitySection()}

                  <div className="assistantSummaryBox assistantEditSelector">
                    <h3>Que veux-tu modifier ?</h3>
                    <p className="muted" style={{ marginTop: 6 }}>
                      Choisis un bloc à ajuster. L’éditeur s’ouvre juste dessous.
                    </p>
                    <div className="choiceRow" style={{ marginTop: 12 }}>
                      <button
                        className="btn btnChoice"
                        type="button"
                        onClick={() => openSelectiveEditStep("activity_type")}
                      >
                        Activité
                      </button>
                      <button
                        className="btn btnChoice"
                        type="button"
                        onClick={() => openSelectiveEditStep("acre")}
                      >
                        ACRE
                      </button>
                      <button
                        className="btn btnChoice"
                        type="button"
                        onClick={() => openSelectiveEditStep("dates")}
                      >
                        Dates
                      </button>
                      <button
                        className="btn btnChoice"
                        type="button"
                        onClick={() => openSelectiveEditStep("declaration_frequency")}
                      >
                        Déclaration
                      </button>
                      <button
                        className="btn btnChoice"
                        type="button"
                        onClick={() => openSelectiveEditStep("tva")}
                      >
                        TVA
                      </button>
                    </div>
                  </div>

                  {showProfileTargetedStep && (
                    <div className="assistantSummaryBox assistantEditSelector">
                      <h3>
                        {selectedProfileField === "activity_type"
                          ? "Modifier ton activité"
                          : selectedProfileField === "acre"
                            ? "Mettre à jour l’ACRE"
                            : selectedProfileField === "dates"
                              ? "Mettre à jour les dates"
                              : selectedProfileField === "tva"
                                ? "Modifier ma TVA"
                              : "Mettre à jour la déclaration"}
                      </h3>
                      <p className="muted" style={{ marginTop: 6 }}>
                        {selectedProfileField === "activity_type"
                          ? "Choisis simplement l’activité qui correspond à ton profil actuel."
                          : selectedProfileField === "acre"
                            ? "Ajuste ton statut ACRE et sa date si elle s’applique."
                            : selectedProfileField === "dates"
                              ? "Mets à jour les dates utiles pour recalculer tes estimations."
                              : selectedProfileField === "tva"
                                ? "Choisis le statut TVA le plus proche de ta situation actuelle."
                              : "Choisis le rythme de déclaration qui te correspond."}
                      </p>

                      {selectedProfileField === "activity_type" && (
                        <div className="choiceRow" style={{ marginTop: 12 }}>
                          {activityOptions.map((opt) => (
                            <button
                              key={opt.value}
                              className="btn btnChoice"
                              type="button"
                              onClick={() => handleProfileEditChoice("activity_type", opt.value)}
                              aria-pressed={profileEditDraft.activity_type === opt.value}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedProfileField === "acre" && (
                        <>
                          <div className="choiceRow" style={{ marginTop: 12 }}>
                            {acreEditOptions.map((opt) => (
                              <button
                                key={opt.value}
                                className="btn btnChoice"
                                type="button"
                                onClick={() => handleProfileEditChoice("acre", opt.value)}
                                aria-pressed={profileEditDraft.acre === opt.value}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {profileEditDraft.acre === "yes" && (
                            <div className="chatInput" style={{ marginTop: 12 }}>
                              <input
                                ref={inputRef}
                                value={profileEditDraft.acre_start_date || ""}
                                onChange={(e) =>
                                  handleProfileEditDateChange("acre_start_date", e.target.value)
                                }
                                aria-label="Date ACRE"
                                type="date"
                                max={getTodayIsoDate()}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {selectedProfileField === "dates" && (
                        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                          <div className="chatInput">
                            <input
                              ref={inputRef}
                              value={profileEditDraft.business_start_date || ""}
                              onChange={(e) =>
                                handleProfileEditDateChange("business_start_date", e.target.value)
                              }
                              aria-label="Date début activité"
                              type="date"
                              max={getTodayIsoDate()}
                            />
                          </div>

                          {(answers.acre === "yes" || profileEditDraft.acre === "yes") && (
                            <div className="chatInput">
                              <input
                                value={profileEditDraft.acre_start_date || ""}
                                onChange={(e) =>
                                  handleProfileEditDateChange("acre_start_date", e.target.value)
                                }
                                aria-label="Date ACRE"
                                type="date"
                                max={getTodayIsoDate()}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {selectedProfileField === "declaration_frequency" && (
                        <div className="choiceRow" style={{ marginTop: 12 }}>
                          {declarationOptions.map((opt) => (
                            <button
                              key={opt.value}
                              className="btn btnChoice"
                              type="button"
                              onClick={() =>
                                handleProfileEditChoice("declaration_frequency", opt.value)
                              }
                              aria-pressed={profileEditDraft.declaration_frequency === opt.value}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedProfileField === "tva" && (
                        <>
                          <div className="choiceRow" style={{ marginTop: 12 }}>
                            {TVA_CONFIG_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                className={`btn btnChoice ${
                                  normalizeTvaConfigStatus(profileEditDraft.tva_status) ===
                                  option.value
                                    ? "isSelected"
                                    : ""
                                }`}
                                type="button"
                                onClick={() =>
                                  updateProfileEditDraft({
                                    tva_status: normalizeTvaConfigStatus(option.value),
                                  })
                                }
                                aria-pressed={
                                  normalizeTvaConfigStatus(profileEditDraft.tva_status) ===
                                  option.value
                                }
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <button
                            className="btn btnActionUtility btnSmall"
                            type="button"
                            onClick={() => openExplanationModal("tva")}
                            style={{ marginTop: 12 }}
                          >
                            Comprendre la TVA
                          </button>
                        </>
                      )}

                      {assistantFieldError && (
                        <div
                          role="alert"
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#fff1f2",
                            border: "1px solid #fecdd3",
                            color: "#be123c",
                            fontSize: 13,
                          }}
                        >
                          {assistantFieldError}
                        </div>
                      )}

                      <div className="miniActions" style={{ marginTop: 16 }}>
                        <button
                          className="btn btnGhost"
                          type="button"
                          onClick={handleProfileEditCancel}
                        >
                          Annuler
                        </button>
                        <button
                          className="btn btnPrimary"
                          type="button"
                          onClick={handleSaveProfileFieldEdit}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : assistantCollapsed ? (
                <div className="assistantCollapsedBox">
                  <p className="muted">Ton repère est prêt.</p>

                  <button
                    className="btn btnPrimary"
                    onClick={() => setAssistantCollapsed(false)}
                    type="button"
                  >
                    Afficher
                  </button>
                </div>
              ) : showCreateWizard ? (
                <div className="chat">
                  {step?.mode === "choice" ? (
                    <div className="choiceZone">
                      <div className="stepMiniHeader">
                        <span className="stepMiniBadge">
                          Étape {stepIndex + 1}
                        </span>
                        <span className="stepMiniTitle">{step?.title}</span>
                      </div>

                      <div className="choiceRow">
                        {step.options?.map((opt) =>
                          opt.value === "unknown" ? null : (
                            <button
                              key={opt.value}
                              className="btn btnChoice"
                              onClick={() => handleSelectOption(opt)}
                              disabled={isTyping}
                              type="button"
                            >
                              {opt.label}
                            </button>
                          ),
                        )}
                      </div>

                      {helpOpen && step.help && (
                        <div className="helpBox" role="note">
                          {step.help}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="chatInput">
                        <input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            const key = step?.key;
                            const normalizedValue =
                              key === "business_start_date" ||
                              key === "acre_start_date"
                                ? normalizeDateValue(nextValue)
                                : nextValue;

                            setInput(nextValue);

                            const validationMessage =
                              getCurrentStepValidationMessage(key, {
                                ...answers,
                                [key]: normalizedValue,
                              });

                            setAssistantFieldError(validationMessage);
                          }}
                          onKeyDown={handleKeyDown}
                          placeholder={step?.placeholder || "Écris ici…"}
                          aria-label="Message"
                          disabled={isTyping}
                          type={
                            step?.key === "business_start_date" ||
                            step?.key === "acre_start_date"
                              ? "date"
                              : "text"
                          }
                          max={
                            step?.key === "business_start_date" ||
                            step?.key === "acre_start_date"
                              ? getTodayIsoDate()
                              : undefined
                          }
                        />
                        <button
                          className="btn"
                          onClick={handleSend}
                          disabled={!canSubmitCurrentStep || isTyping}
                          type="button"
                        >
                          Envoyer
                        </button>
                      </div>

                      {assistantFieldError && (
                        <div
                          role="alert"
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#fff1f2",
                            border: "1px solid #fecdd3",
                            color: "#be123c",
                            fontSize: 13,
                          }}
                        >
                          {assistantFieldError}
                        </div>
                      )}

                      <div className="autoSaveHint" aria-live="polite">
                        {user
                          ? "✅ Ton espace est lié à ton compte."
                          : "💾 Progression enregistrée dans ce navigateur."}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>
          ) : appView === "pricing" ? (
            <PricingPage
              onClose={() => goToView("landing", { focus: false })}
              onTryWithoutAccount={() => goToView("landing", { focus: false })}
              onOpenFutureAdvanced={() =>
                openPremiumModal("future_advanced_features")
              }
              onSelectPlan={(plan) => {
                if (plan === "free") {
                  openAuthModal("signup");
                  return;
                }

                if (plan === "premium") {
                  openPremiumModal("pricing_page");
                  return;
                }

                goToView("landing", { focus: false });
              }}
            />
          ) : appView === "dashboard" ? (

            <section ref={fiscalRef} className="card dashboardCard">
              {isFounder && (
                <div
                  className="dashboardFounderBanner"
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "linear-gradient(180deg, #ecfeff 0%, #f0fdf4 100%)",
                    border: "1px solid #99f6e4",
                    color: "#0f766e",
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: "0 8px 18px rgba(20, 184, 166, 0.08)",
                  }}
                >
                  🎁 Offre fondateur — 3 mois Premium offerts
                </div>
              )}
              {!isPremiumUser && isGuest ? (
                <div className="discoveryBanner">
                  <div className="discoveryBannerTitle">
                    Session temporaire — crée ton compte pour sauvegarder ton suivi.
                  </div>
                  <div className="discoveryBannerText">
                    Tes données restent temporaires tant que ton compte n’est pas créé.
                  </div>
                  <div className="dashboardHelperText" style={{ marginTop: 8 }}>
                    Crée un compte pour retrouver ton espace plus tard.
                  </div>
                  <div className="discoveryBannerActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={() => openAuthModal("signup")}
                    >
                      Créer mon compte
                    </button>
                  </div>
                </div>
              ) : !isPremiumUser && isEarlyAccessEndingToday ? (
                <div className="discoveryBanner">
                  <div className="discoveryBannerTitle">
                    ⏳ Ton mode découverte se termine aujourd’hui
                  </div>
                  <div className="discoveryBannerText">
                    Ensuite, tu garderas l’essentiel. Les SMS et rappels
                    avancés arriveront plus tard en Premium :
                  </div>
                  <ul className="discoveryBannerList">
                    <li>Smart priorités avancées</li>
                    <li>alertes intelligentes</li>
                    <li>rappels automatiques</li>
                  </ul>
                  <div className="discoveryBannerActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={() => openPremiumModal("early_access_end")}
                    >
                      Voir les options à venir
                    </button>
                  </div>
                </div>
              ) : !isPremiumUser && isEarlyFullAccess ? (
                <div className="discoveryBanner">
                  <div className="discoveryBannerTitle">
                    ✨ Mode découverte activé
                  </div>
                  <div className="discoveryBannerText">
                    Pendant cette période découverte, tu vois aussi ce que
                    Premium ajoute pour t’aider à agir plus tôt.
                  </div>
                  <div className="dashboardHelperText" style={{ marginTop: 8 }}>
                    Découvre tes priorités dès maintenant.
                  </div>
                  <div className="discoveryBannerActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={handleOpenSmartPriorities}
                    >
                      Voir mes priorités
                    </button>
                  </div>
                </div>
              ) : !isPremiumUser && isPostEarlyAccessTrial ? (
                <div className="discoveryBanner">
                  <div className="discoveryBannerTitle">
                    🔒 Certaines fonctionnalités sont maintenant en Premium
                  </div>
                  <div className="discoveryBannerText">
                    Ton espace reste disponible gratuitement : revenus,
                    factures, exports et suivi de base.
                  </div>
                  <div className="dashboardHelperText" style={{ marginTop: 8 }}>
                    Les rappels email sont accessibles gratuitement pendant la
                    phase de test. SMS et rappels avancés bientôt en Premium.
                  </div>
                  <div className="discoveryBannerActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={() => openPremiumModal("early_access_end")}
                    >
                      Activer les rappels automatiques
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="sectionHead">
                <div>
                  <h2>Mon espace fiscal</h2>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Revenus, charges et échéances au même endroit.
                  </p>
                  <div
                    style={{
                      marginTop: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "10px 14px",
                      borderRadius: 14,
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      color: "#6d28d9",
                    }}
                  >
                    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {premiumBannerContent.line1}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {premiumBannerContent.line2}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        {premiumBannerContent.line3}
                      </div>
                    </div>
                    {premiumWaitlistJoined && (
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        ✔️ Accès prioritaire activé
                      </div>
                    )}
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={handleBillingBannerAction}
                    >
                      {premiumBannerButtonLabel}
                    </button>
                  </div>
                </div>
              </div>

              {(hasProfileCore || simpleAssistantProfile) && (
                <section className="dashboardCockpit">
                  <div
                    className={`dashboardHeroAction dashboardHeroAction--${simpleAssistantGuidance.tone}`}
                  >
                    <div>
                      <p className="dashboardHeroEyebrow">
                        Action prioritaire
                      </p>
                      <h2>
                        {revenues.length > 0
                          ? "Prépare ta déclaration URSSAF"
                          : "Commence ton suivi fiscal"}
                      </h2>
                      {revenues.length > 0 ? (
                        <div className="dashboardPriorityDetails">
                          <div>
                            <span>Montant estimé</span>
                            <strong>
                              {cockpitEstimate.isProvisional
                                ? getDisplayValue(cockpitEstimate.charges, "money")
                                : dashboardChargesDisplay}
                            </strong>
                          </div>
                          <div>
                            <span>Prochaine échéance</span>
                            <strong>
                              {computed?.deadlineLabel === "Complète ton profil fiscal" ? (
                                <button
                                  className="dashboardInlineLink"
                                  type="button"
                                  onClick={handleEditProfile}
                                >
                                  Compléter mon profil fiscal
                                </button>
                              ) : (
                                computed?.deadlineLabel || "À préparer"
                              )}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <p>
                          Enregistre un premier encaissement pour activer les
                          estimations utiles.
                        </p>
                      )}
                      {revenues.length === 0 && (
                        <div className="simpleAssistantHelper">
                          Plus tu ajoutes de revenus, plus tes estimations deviennent fiables.
                        </div>
                      )}
                    </div>
                    <div className="dashboardHeroMeta">
                      <span className="simpleAssistantBadge">
                        {getSimpleActivityLabel(
                          dashboardAnswers.activity_type ||
                            simpleAssistantProfile?.activity_type,
                        )}
                      </span>
                      <strong>
                        {simpleAssistantGuidance.monthlyRevenue === null
                          ? hasLowDataProfile
                            ? dashboardQuietPlaceholder
                            : "À renseigner"
                          : `${getDisplayValue(
                              simpleAssistantGuidance.monthlyRevenue,
                              "money",
                            )} / mois`}
                      </strong>
                      <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        onClick={openSimpleOnboardingEdit}
                      >
                        Mettre à jour
                      </button>
                    </div>
                    <div className="dashboardHeroActions">
                      {revenues.length > 0 ? (
                        <>
                          <a
                            className="btn btnActionPrimary btnSmall"
                            href="https://www.autoentrepreneur.urssaf.fr/"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              trackBetaEvent("urssaf_declare_clicked", {
                                source: "dashboard_priority",
                              })
                            }
                          >
                            Déclarer maintenant
                          </a>
                          <button
                            className="btn btnActionUtility btnSmall"
                            type="button"
                            onClick={() => openExplanationModal("urssaf")}
                          >
                            Comprendre la déclaration URSSAF
                          </button>
                          <div className="dashboardDeclareHelper">
                            {fiscalSummaryVisibleSlice.revenueTotal > 0 ? (
                              <>
                                <span>
                                  Montant à déclarer : {getDisplayValue(fiscalSummaryVisibleSlice.revenueTotal, "money")}
                                </span>
                                {computed?.nextDeclarationLabel &&
                                  computed.nextDeclarationLabel !== "Profil à compléter" && (
                                  <span>
                                    Période concernée : {computed.nextDeclarationLabel}
                                  </span>
                                )}
                                {computed?.deadlineLabel &&
                                  computed.deadlineLabel !== "Complète ton profil fiscal" && (
                                    <span>
                                      Échéance estimée : {computed.deadlineLabel}
                                    </span>
                                  )}
                                <span>
                                  Microassist t’ouvre le site officiel URSSAF. Vérifie toujours le montant avant de valider.
                                </span>
                              </>
                            ) : (
                              <span>
                                Ajoute un revenu pour calculer le montant à déclarer.
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btnActionPrimary btnSmall"
                            type="button"
                            onClick={handleOpenRevenuePopup}
                          >
                            Ajouter un revenu
                          </button>
                          <div className="dashboardDeclareHelper">
                            Ajoute un revenu pour calculer le montant à déclarer.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {(hasProfileCore || simpleAssistantProfile) && (
                <section className="dashboardQuickActions" aria-label="Centre de contrôle">
                  <div className="dashboardQuickActionsIntro">
                    <span>Centre de contrôle</span>
                    <p>Accède rapidement aux actions et sections utiles.</p>
                  </div>
                  <div className="dashboardQuickActionsList">
                    <button
                      className="btn btnActionPrimary btnSmall"
                      type="button"
                      onClick={handleOpenRevenuePopup}
                    >
                      + Ajouter un revenu
                    </button>
                    <button
                      className="btn btnActionUtility btnSmall"
                      type="button"
                      onClick={handleOpenInvoiceGenerator}
                    >
                      Créer une facture
                    </button>
                    {revenues.length > 0 ? (
                      <a
                        className="btn btnActionSecondary btnSmall"
                        href="https://www.autoentrepreneur.urssaf.fr/"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackBetaEvent("urssaf_declare_clicked", {
                            source: "dashboard_control_center",
                          })
                        }
                      >
                        Déclarer URSSAF
                      </a>
                    ) : (
                      <button
                        className="btn btnActionSecondary btnSmall"
                        type="button"
                        onClick={() => openExplanationModal("urssaf")}
                      >
                        Déclarer URSSAF
                      </button>
                    )}
                    <button
                      className="btn btnActionUtility btnSmall"
                      type="button"
                      onClick={() => scrollToSection("advisor-share-section")}
                    >
                      Partager avec conseiller
                    </button>
                    <button
                      className="btn btnActionUtility btnSmall"
                      type="button"
                      onClick={handleEditProfile}
                    >
                      Modifier mon profil
                    </button>
                    <button
                      className="btn btnActionUtility btnSmall"
                      type="button"
                      onClick={() => scrollToSection("reminders-section")}
                    >
                      Mes rappels actifs
                    </button>
                  </div>
                </section>
              )}

              {(hasProfileCore || simpleAssistantProfile) && (
                <nav className="dashboardInternalNav" aria-label="Navigation interne">
                  <span>Aller à :</span>
                  <button
                    type="button"
                    onClick={() =>
                      revenusRef.current?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Revenus
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      facturesRef.current?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Factures
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      analyseRef.current?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Analyse
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      prioritesRef.current?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Priorités
                  </button>
                </nav>
              )}

              {!hasDeclarationReminderActive && (
                <div className="dashboardDeclarationReminderCard dashboardOrderReminder">
                  <div>
                    <div className="dashboardRecommendationTitle">
                      Déclaration URSSAF
                    </div>
                    <div className="dashboardRecommendationText">
                      Rappel avant l’échéance
                    </div>
                  </div>
                  <button
                    className="btn btnActionSecondary btnSmall"
                    type="button"
                    onClick={() => openReminderManager("reminder_declaration")}
                  >
                    Configurer
                  </button>
                </div>
              )}

              <div className="dashboardSectionZone dashboardSectionZoneCoolNeutral dashboardOrderSituation">
                <div className="dashboardSectionHeader">
                  <div className="dashboardSectionHeaderMain">
                    <h3 className="dashboardSectionTitle">À mettre de côté</h3>
                    {cockpitEstimate.isProvisional && (
                      <div className="dashboardSectionSubtitle">
                        {provisionalCaHelperText}.
                      </div>
                    )}
                    {hasAnyDashboardData ? (
                      <div className="dashboardSectionSubtitle">
                        Montant estimé à mettre de côté pour ta prochaine déclaration.
                      </div>
                    ) : (
                      <div className="dashboardSectionSubtitle">
                        Ajoute ton premier revenu pour obtenir une estimation.
                      </div>
                    )}
                  </div>
                </div>
                <div className="fiscalDashboard">
                  <div className="fiscalCard">
                    <div className="fiscalLabel">
                      {cockpitEstimate.isProvisional ? "CA estimé" : "Revenus cumulés"}
                    </div>
                    <div className="fiscalValue">{dashboardRevenueDisplay}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {cockpitEstimate.isProvisional
                        ? provisionalCaHelperText
                        : hasRevenueData
                          ? "Revenus enregistrés"
                          : dashboardQuietPlaceholder}
                    </div>
                  </div>

                  <div className="fiscalCard">
                    <div className="fiscalLabel">À mettre de côté</div>
                    {isFiscalProfileComplete && (
                      <div
                        className={`dashboardConfidenceBadge confidence-${dashboardConfidence.tone}`}
                      >
                        {dashboardConfidence.label}
                      </div>
                    )}
                    <div className="fiscalValue">
                      {isFiscalProfileComplete
                        ? dashboardChargesDisplay
                        : dashboardQuietPlaceholder}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {isFiscalProfileComplete && hasAnyDashboardData
                        ? cockpitEstimate.isProvisional
                          ? provisionalCaHelperText
                          : "Charges estimées"
                        : isFiscalProfileComplete
                          ? "À compléter"
                          : dashboardQuietPlaceholder}
                    </div>
                  </div>

                  <div className="fiscalCard">
                    <div className="fiscalLabel">Disponible</div>
                    {isFiscalProfileComplete && (
                      <div
                        className={`dashboardConfidenceBadge confidence-${dashboardConfidence.tone}`}
                      >
                        {dashboardConfidence.label}
                      </div>
                    )}
                    <div className="fiscalValue">
                      {isFiscalProfileComplete
                        ? dashboardAvailableDisplay
                        : dashboardQuietPlaceholder}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {isFiscalProfileComplete
                        ? "Après estimation des charges"
                        : dashboardQuietPlaceholder}
                    </div>
                  </div>
                </div>

                <div className="miniStatsGrid">
                  <div className="miniStatCard">
                    <div className="miniStatLabel">Moyenne mensuelle</div>
                    <div className="miniStatValue">
                      {hasRevenueData
                        ? getDisplayValue(revenueStats.monthlyAverage, "money")
                        : dashboardQuietPlaceholder}
                    </div>
                  </div>
                  <div className="miniStatCard">
                    <div className="miniStatLabel">Dernier revenu</div>
                    <div className="miniStatValue">
                      {hasRevenueData
                        ? getDisplayValue(revenueStats.lastRevenue, "money")
                        : dashboardQuietPlaceholder}
                    </div>
                  </div>
                  <div className="miniStatCard">
                    <div className="miniStatLabel">Entrées</div>
                    <div className="miniStatValue">
                      {hasRevenueData ? revenueStats.count : dashboardQuietPlaceholder}
                    </div>
                  </div>
                </div>

                {mixedRevenueBreakdown && (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      marginTop: 16,
                    }}
                  >
                    <div className="miniStatCard">
                      <div className="miniStatLabel">Revenus commerce (BIC)</div>
                      <div className="miniStatValue">
                        {mixedRevenueBreakdown.venteTotal.toLocaleString("fr-FR")} €
                      </div>
                    </div>
                    <div className="miniStatCard">
                      <div className="miniStatLabel">Revenus services (BNC / prestations)</div>
                      <div className="miniStatValue">
                        {mixedRevenueBreakdown.serviceTotal.toLocaleString("fr-FR")} €
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {shouldShowDashboardPremiumValue && !hasPremiumLikeAccess && (
                <div className="premiumValueCard dashboardProtectionCard dashboardOrderProtection">
                  <div>
                    <h3>Sécurise ton activité</h3>
                    <p>Aujourd’hui tu es à jour 👍</p>
                    <p>Mais sans rappel, tu peux :</p>
                    <ul>
                      <li>oublier ta déclaration (≈ 45€ de pénalité)</li>
                      <li>mal anticiper la TVA</li>
                      <li>devoir payer d’un coup</li>
                    </ul>
                    <p>👉 Microassist te prévient avant que ça arrive</p>
                    <ul>
                      <li>✔ Rappel J-7 et J-1</li>
                      <li>✔ Alerte TVA automatique</li>
                      <li>✔ Suivi sans oubli</li>
                    </ul>
                  </div>
                  <div className="dashboardPremiumTestActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={() => openPremiumModal("dashboard_protection")}
                    >
                      Activer les rappels automatiques
                    </button>
                    <p className="dashboardPremiumTestNote">
                      Gratuit pendant la phase de test. Les tarifs seront définis plus tard.
                    </p>
                  </div>
                </div>
              )}

              <div className="dashboardLaunchRail">
                {dashboardLaunchAnchors.length > 0 && (
                  <div className="dashboardLaunchAnchors">
                    {dashboardLaunchAnchors.map((anchor) => (
                      <div
                        key={anchor.key}
                        className={`dashboardTrustPill trust-${anchor.tone}`}
                      >
                        <span className="dashboardTrustPillLabel">{anchor.label}</span>
                        <span className="dashboardTrustPillText">{anchor.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {dashboardPrimaryAction && !(hasProfileCore || simpleAssistantProfile) && (
                  <div className="dashboardNextStepCard">
                    <div className="dashboardNextStepTitle">
                      {dashboardPrimaryAction.title}
                    </div>
                    <p className="dashboardNextStepText">
                      {dashboardPrimaryAction.text}
                    </p>
                    <div className="dashboardNextStepActions">
                      <button
                        className="btn btnActionPrimary"
                        type="button"
                        onClick={dashboardPrimaryAction.onClick}
                      >
                        {dashboardPrimaryAction.cta}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="dashboardSignalStack">
              {dashboardMilestone && (
                <div className="dashboardMilestoneBanner">
                  <div
                    className={`dashboardConfidenceBadge confidence-${dashboardConfidence.tone}`}
                    style={{ marginBottom: 0 }}
                  >
                    {dashboardMilestone}
                  </div>
                  <div className="dashboardHelperText" style={{ marginTop: 0 }}>
                    {confidenceHelperText}
                  </div>
                </div>
              )}

              {shouldShowDashboardChecklist && (
                <div className="dashboardChecklistCard">
                  <div className="dashboardSectionHeader" style={{ marginBottom: 10 }}>
                    <div className="dashboardSectionHeaderMain">
                      <h3 className="dashboardSectionTitle">Checklist de démarrage</h3>
                      <div className="dashboardSectionSubtitle">
                        {completedChecklistSteps} / 5 étapes complétées
                      </div>
                    </div>
                    <div className="dashboardSectionActions">
                      <button
                        className="btn btnActionUtility btnSmall"
                        type="button"
                        onClick={() =>
                          setDashboardChecklistCollapsed((value) => !value)
                        }
                      >
                        {dashboardChecklistCollapsed ? "Afficher" : "Réduire"}
                      </button>
                    </div>
                  </div>

                  {!dashboardChecklistCollapsed && (
                    <div className="dashboardChecklistList">
                      {dashboardChecklistItems.map((item) => (
                        <div
                          key={item.key}
                          className={`dashboardChecklistItem ${
                            item.completed ? "is-complete" : "is-pending"
                          }`}
                        >
                          <span className="dashboardChecklistIcon" aria-hidden="true">
                            {item.completed ? "✓" : "○"}
                          </span>
                          <span className="dashboardChecklistLabel">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {dashboardLearningProgress && (
                <div className="dashboardLearningCard">
                  <div className="dashboardSectionHeader" style={{ marginBottom: 10 }}>
                    <div className="dashboardSectionHeaderMain">
                      <h3 className="dashboardSectionTitle">
                        📈 Fiabilité des estimations
                      </h3>
                    </div>
                    <div className="dashboardSectionActions">
                      <button
                        className="btn btnActionUtility btnSmall"
                        type="button"
                        onClick={() => toggleDashboardSection("learning")}
                      >
                        {dashboardSections.learning ? "Voir" : "Réduire"}
                      </button>
                    </div>
                  </div>
                  {!dashboardSections.learning ? (
                    <>
                      <div className="dashboardRecommendationText" style={{ marginTop: 0 }}>
                        Chaque revenu ajouté rend les estimations plus utiles.
                      </div>
                      <div className="progress dashboardLearningProgress">
                        <div>{dashboardLearningProgress.current} / 5 revenus enregistrés</div>
                        <div className="progressBar">
                          <div
                            className="progressFill"
                            style={{ width: `${dashboardLearningProgress.percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="dashboardHelperText">
                        À partir de 5 revenus ou 7 jours, la projection gagne en fiabilité.
                      </div>
                    </>
                  ) : (
                    <div className="dashboardHelperText" style={{ marginTop: 0 }}>
                      {dashboardLearningProgress.current} / 5 revenus enregistrés.
                    </div>
                  )}
                </div>
              )}

              <div className="dashboardMaturityCard">
                <div className="dashboardMaturityHeader">
                  <div className="dashboardMaturityTitle">
                    {MATURITY_COPY.title}
                  </div>
                  <div
                    className="dashboardConfidenceBadge confidence-neutral"
                    style={{ marginBottom: 0 }}
                  >
                    {MATURITY_COPY.badge}
                  </div>
                </div>
                <div className="progress dashboardLearningProgress">
                  <div>
                    {Math.min(revenues.length, 5)} / 5 revenus enregistrés
                  </div>
                  <div className="progressBar">
                    <div
                      className="progressFill"
                      style={{ width: `${trackingMaturityPercent}%` }}
                    />
                  </div>
                </div>
                <div className="dashboardHelperText">
                  {trackingMaturityHelperText}
                </div>
              </div>

              <div className="dashboardThisWeekCard">
                <div className="dashboardThisWeekTitle">📈 Ton rythme cette semaine</div>
                <div className="dashboardDailyInsightText">
                  <span>{dashboardWeeklyRhythmText}</span>
                </div>
              </div>

              {dashboardTrustState && (
                <div className="dashboardTrustCard">
                  <div className="dashboardDailyInsightText">
                    <span className="dashboardDailyInsightIcon" aria-hidden="true">
                      {dashboardTrustState.icon}
                    </span>
                    <span>{dashboardTrustState.text}</span>
                  </div>
                </div>
              )}

              {dashboardRecommendation && (
                <div className="dashboardRecommendationCard">
                  <div className="dashboardRecommendationTitle">
                    {dashboardRecommendation.title}
                  </div>
                  <div className="dashboardRecommendationText">
                    {dashboardRecommendation.text}
                  </div>
                  {!dashboardPrimaryAction && (
                    <div className="dashboardRecommendationActions">
                      <button
                        className="btn btnActionSecondary btnSmall"
                        type="button"
                        onClick={dashboardRecommendation.onClick}
                      >
                        {dashboardRecommendation.cta}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {dashboardWeeklyRecap && (
                <div className="dashboardWeeklyRecapCard">
                  <div className="dashboardSectionHeader" style={{ marginBottom: 10 }}>
                    <div className="dashboardSectionHeaderMain">
                      <h3 className="dashboardSectionTitle">Récap de la semaine</h3>
                      <div className="dashboardSectionSubtitle">
                        {dashboardWeeklyRecap.subtitle}
                      </div>
                    </div>
                    <div className="dashboardSectionActions">
                      <button
                        className="btn btnActionUtility btnSmall"
                        type="button"
                        onClick={() => toggleDashboardSection("weekly")}
                      >
                        {dashboardSections.weekly ? "Voir" : "Réduire"}
                      </button>
                    </div>
                  </div>
                  {!dashboardSections.weekly ? (
                    <>
                      <div className="dashboardWeeklyRecapGrid">
                        {dashboardWeeklyRecap.items.map((item) => (
                          <div key={item.key} className="dashboardWeeklyRecapItem">
                            <div className="dashboardWeeklyRecapLabel">{item.label}</div>
                            <div className="dashboardWeeklyRecapValue">{item.value}</div>
                            <div className="dashboardHelperText">{item.helper}</div>
                          </div>
                        ))}
                      </div>
                      {dashboardWeeklyRecap.nextActionLabel && (
                        <div className="dashboardHelperText" style={{ marginTop: 12 }}>
                          Prochaine action : {dashboardWeeklyRecap.nextActionLabel}.
                        </div>
                      )}
                      {dashboardWeeklyRecap.helper && (
                        <div className="dashboardHelperText">
                          {dashboardWeeklyRecap.helper}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="dashboardHelperText" style={{ marginTop: 0 }}>
                      {dashboardWeeklyRecap.items[0]?.value || "Semaine en cours suivie."}
                    </div>
                  )}
                </div>
              )}

              {dashboardTrackingStreak && (
                <div className="dashboardTrackingStreakCard">
                  <div className="dashboardTrackingStreakTitle">
                    {dashboardTrackingStreak.title}
                  </div>
                  <div className="dashboardDailyInsightText">
                    <span>{dashboardTrackingStreak.text}</span>
                  </div>
                  <div className="dashboardHelperText">
                    {dashboardTrackingStreak.helper}
                  </div>
                </div>
              )}

              {dashboardNextMonthPrep && (
                <div className="dashboardNextMonthCard">
                  <div className="dashboardNextMonthTitle">
                    Le mois prochain
                  </div>
                  <div className="dashboardDailyInsightText">
                    <span>{dashboardNextMonthPrep}</span>
                  </div>
                </div>
              )}
              {renderBetaMicroFeedbackCard("planning")}

              {dashboardDailyInsight && (
                <div className="dashboardDailyInsightCard">
                  <div className="dashboardDailyInsightText">
                    <span className="dashboardDailyInsightIcon" aria-hidden="true">
                      {dashboardDailyInsight.icon}
                    </span>
                    <span>{dashboardDailyInsight.text}</span>
                  </div>
                </div>
              )}
              {renderBetaMicroFeedbackCard("top")}
              </div>

              <span id="reminders-section" className="dashboardSectionAnchor" />

              {!dashboardRemindersDismissed && activeReminderItems.length > 0 && (
                <div
                  className="dashboardSectionZone dashboardSectionZoneLavender"
                  style={{
                    marginBottom: 18,
                  }}
                  >
                    <div className="dashboardSectionHeader">
                      <div className="dashboardSectionHeaderMain">
                        <h3 className="dashboardSectionTitle">
                          Mes rappels actifs
                        </h3>
                        <div className="dashboardSectionSubtitle">
                          {activeReminderItems.length} rappel
                          {activeReminderItems.length > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="dashboardSectionActions">
                        <button
                          className="btn btnActionSecondary btnSmall"
                          type="button"
                          onClick={() => openReminderManager("active_reminders_block")}
                        >
                          Gérer mes rappels
                        </button>
                        <button
                          className="btn btnActionUtility btnSmall"
                          type="button"
                          onClick={() => toggleDashboardSection("reminders")}
                        >
                          {dashboardSections.reminders ? "Voir tout" : "Réduire"}
                        </button>
                        <button
                          className="iconBtn"
                          type="button"
                          aria-label="Masquer les rappels actifs"
                          onClick={() => {
                            setDashboardRemindersDismissed(true);
                            try {
                              localStorage.setItem(
                                DASHBOARD_REMINDERS_DISMISSED_KEY,
                                "1",
                              );
                            } catch {
                              // Ignore localStorage failures in dashboard UI state.
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                  {!dashboardSections.reminders && (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {activeReminderItems.map((item) => (
                        <div
                          key={item.key}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: "#ffffff",
                            border: "1px solid #e5ddf6",
                            boxShadow: "0 6px 18px rgba(109, 40, 217, 0.05)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              alignItems: "flex-start",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ color: "#334155", fontSize: 14, flex: 1 }}>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                {item.urgent ? "⚠️ " : "🔔 "}
                                {item.title}
                              </div>
                              <div style={{ marginTop: 4 }}>{item.text}</div>
                            </div>

                            {item.actions?.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                {item.actions.map((action) =>
                                  action.kind === "link" ? (
                                    <a
                                      key={action.label}
                                      href={action.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`btn ${action.label === "Déclarer" ? "btnActionSecondary" : "btnActionUtility"} btnSmall`}
                                    >
                                      {action.label}
                                    </a>
                                  ) : (
                                    <button
                                      key={action.label}
                                      className={`btn ${action.label === "Voir le diagnostic" || action.label === "Comprendre" ? "btnActionSecondary" : "btnActionUtility"} btnSmall`}
                                      type="button"
                                      onClick={action.onClick}
                                    >
                                      {action.label}
                                    </button>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 👇 NOUVELLE PODKAZKA - AJOUTER ICI */}
              {!hasProfileCore && (
                <div className="dashboardTrustCard dashboardProfileCompletionCard" style={{ marginBottom: 18 }}>
                  <div className="dashboardRecommendationTitle">
                    Profil à compléter
                  </div>
                  <div className="dashboardRecommendationText">
                    Complète ton profil pour améliorer les estimations.
                  </div>
  
                </div>
              )}

              <div
                ref={(node) => {
                  smartPrioritiesRef.current = node;
                  prioritesRef.current = node;
                }}
                className={`${smartTipsZoneClass} dashboardOrderSmartPriorities`}
              >
              <div className="smartTips" style={{ marginTop: 0 }}>
                <div className="dashboardSectionHeader">
                  <div className="dashboardSectionHeaderMain">
                    <h3 className="dashboardSectionTitle">Smart Priorités</h3>
                  </div>
                </div>
                <div className="smartPrioritiesEngine">
                  {hasPremiumLikeAccess ? (
                    <div className="priorityLockCard" style={{ marginBottom: 14 }}>
                      <div className="priorityTitle">Plan d’action complet</div>
                      <div className="priorityMessage">
                        Premium t’aide à anticiper tes échéances, tes charges et les
                        signaux importants avant qu’ils deviennent urgents.
                      </div>
                    </div>
                  ) : (
                    <div className="priorityLockCard" style={{ marginBottom: 14 }}>
                      <div className="priorityTitle">
                        Tu vois ta priorité la plus urgente
                      </div>
                      <div className="priorityMessage">
                        Microassist peut te prévenir automatiquement avant les
                        échéances importantes.
                      </div>
                      <div className="dashboardHelperText" style={{ marginTop: 8 }}>
                        Sans alerte automatique, tu peux oublier une déclaration
                        importante.
                      </div>
                      <button
                        className="btn btnActionSecondary btnSmall"
                        type="button"
                        onClick={() => openPremiumModal("smart_priorities_lock")}
                        style={{ marginTop: 12 }}
                      >
                        Activer les alertes automatiques
                      </button>
                      <div className="dashboardHelperText" style={{ marginTop: 8 }}>
                        Gratuit pendant la phase de test
                      </div>
                    </div>
                  )}

                  {smartPriorities.length === 0 && (
                    <p className="muted">Aucune priorité détectée.</p>
                  )}

                  <button
                    type="button"
                    className="btn btnGhost btnSmall"
                    onClick={() => openPremiumModal("future_advanced_features")}
                    style={{
                      alignSelf: "flex-start",
                      marginBottom: 12,
                      paddingInline: 12,
                    }}
                  >
                    ✨ Bientôt — SMS & automatisation
                  </button>

                  {visibleSmartPriorities.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className={`priorityCard ${item.level}`}
                    >
                      <div className="priorityTitle">{item.title}</div>
                      <div className="priorityMessage">{item.message}</div>

                      {item.action && (
                        <button
                          className="btn btnPrimary btnSmall"
                          type="button"
                          onClick={() => {
                            if (item.actionKey) {
                              handleSmartAlertAction(item.actionKey);
                            }
                          }}
                        >
                          {item.action}
                        </button>
                      )}
                    </div>
                  ))}

                  {hasLockedSmartPriorities && (
                    <div className="priorityLockCard">
                      <div className="priorityTitle">
                        Autres signaux détectés
                      </div>
                      <div className="priorityMessage">
                        Des rappels plus avancés seront disponibles
                        prochainement.
                      </div>
                      <button
                        className="btn btnActionSecondary btnSmall"
                        type="button"
                        onClick={() => openPremiumModal("smart_priorities_lock")}
                      >
                        Voir toutes les priorités
                      </button>
                    </div>
                  )}
                </div>
                <div className="smartTipsList">
                  {smartAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={[
                        "smartTipCard",
                        alert.level === "danger" ? "tipDanger" : "",
                        alert.level === "warning" ? "tipWarning" : "",
                        alert.level === "success" ? "tipOk" : "",
                      ]
                        .join(" ")
                        .trim()}
                    >
                      <div className="smartTipTitle">{alert.title}</div>
                      <div className="smartTipText">{alert.text}</div>
                      {alert.cta && (
                        <div className="smartTipActions">
                          <button
                            className="btn btnActionSecondary btnSmall"
                            type="button"
                            onClick={() => {
                              trackEvent("priority_cta_click", {
                                source: "smart_priorites",
                                priorityType: alert.id,
                                totalRevenues: revenues.length,
                                invoiceCount: visibleInvoices.length,
                              });
                              handleSmartAlertAction(alert.action);
                            }}
                          >
                            {alert.cta}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>

              {fiscalCoachingCard && (
                <div className="fiscalCoachCard">
                  <div className="fiscalCoachTitle">{DAILY_FISCAL_TIP_COPY.title}</div>
                  <div
                    className={
                      isHelperStyledCoachingCard
                        ? "fiscalCoachText dashboardHelperText"
                        : "fiscalCoachText"
                    }
                  >
                    {fiscalCoachingCard.text}
                  </div>
                  {fiscalCoachingCard.cta && fiscalCoachingCard.onClick && (
                    <div className="fiscalCoachActions">
                      <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        onClick={fiscalCoachingCard.onClick}
                      >
                        {fiscalCoachingCard.cta}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fiscalRecommendationCard && (
                <div className="fiscalRecommendationCard">
                  <div className="fiscalRecommendationText">
                    {fiscalRecommendationCard}
                  </div>
                </div>
              )}

              {showCashImpactModal && (
                <div
                  className="modalOverlay"
                  onClick={() => setShowCashImpactModal(false)}
                >
                  <div
                    className="modalCard"
                    style={{ maxWidth: "520px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sectionHead">
                      <h3>📊 Impact sur ta trésorerie</h3>
                      <button
                        className="iconBtn"
                        onClick={() => setShowCashImpactModal(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: 16,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          Réserve recommandée
                        </div>
                        <p style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>
                          {typeof computed?.treasuryRecommended === "number"
                            ? `${computed.treasuryRecommended.toLocaleString("fr-FR")} € à garder de côté au minimum.`
                            : hasAnyDashboardData
                              ? `${dashboardChargesDisplay} de charges estimées à sécuriser.`
                              : "Ajoute un revenu pour afficher ce repère."}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#ffffff",
                          padding: 16,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          Risque TVA
                        </div>
                        <p style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>
                          {normalizedTvaStatusLabel || "TVA à confirmer"}
                        </p>
                        <p style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                          {computed?.tvaHint ||
                            "Le seuil TVA dépend de ton activité et de ton chiffre d’affaires cumulé."}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        }}
                      >
                        <div
                          style={{
                            background: "#ffffff",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Charges estimées
                          </div>
                          <div style={{ marginTop: 6, fontWeight: 700, color: "#0f172a" }}>
                            {dashboardChargesDisplay}
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: 16,
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            Disponible ajusté
                          </div>
                          <div style={{ marginTop: 6, fontWeight: 700, color: "#0f172a" }}>
                            {hasAnyDashboardData
                              ? getDisplayValue(
                                  Math.max(
                                    0,
                                    availableAmount -
                                      Math.max(
                                        estimatedCharges,
                                        Number(computed?.treasuryRecommended || 0),
                                      ),
                                  ),
                                  "money",
                                )
                              : dashboardQuietPlaceholder}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="btn btnActionSecondary"
                          type="button"
                          onClick={() => {
                            setShowCashImpactModal(false);
                            setShowTVADiagnosticModal(true);
                          }}
                        >
                          Vérifier la TVA
                        </button>
                        <button
                          className="btn btnPrimary"
                          type="button"
                          onClick={() => setShowCashImpactModal(false)}
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showTVADiagnosticModal && (
                <div
                  className="modalOverlay"
                  onClick={() => setShowTVADiagnosticModal(false)}
                >
                  <div
                    className="modalCard"
                    style={{ maxWidth: "520px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sectionHead">
                      <h3>📌 Diagnostic TVA</h3>
                      <button
                        className="iconBtn"
                        onClick={() => setShowTVADiagnosticModal(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: 16,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          Situation actuelle
                        </div>
                        <p style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>
                          {normalizedTvaStatusLabel || "TVA à confirmer"}
                        </p>
                        <p style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                          {computed?.tvaHint ||
                            "Le seuil TVA mérite une vérification avec ton activité actuelle."}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#ffffff",
                          padding: 16,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          Projection
                        </div>
                        <p style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>
                          {computed?.annualRevenue !== undefined
                            ? `Projection annuelle : ${getDisplayValue(
                                computed.annualRevenue,
                                "money",
                              )}`
                            : hasRevenueData
                              ? `CA enregistré : ${getDisplayValue(
                                  currentMonthTotal,
                                  "money",
                                )}`
                              : "Ajoute ton premier revenu"}
                        </p>
                      </div>

                      <div
                        style={{
                          background:
                            computed?.tvaStatus === "exceeded"
                              ? "#fff7ed"
                              : "#f8fafc",
                          padding: 16,
                          borderRadius: 12,
                          border:
                            computed?.tvaStatus === "exceeded"
                              ? "1px solid #fdba74"
                              : "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {computed?.tvaStatus === "exceeded"
                            ? "Action à lancer"
                            : computed?.tvaStatus === "soon"
                              ? "Point de vigilance"
                              : "Rythme actuel"}
                        </div>
                        <p style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>
                          {computed?.tvaStatus === "exceeded"
                            ? "Prépare maintenant l’activation de la TVA, la facturation adaptée et l’organisation déclarative."
                            : computed?.tvaStatus === "soon"
                              ? "Surveille ton seuil de près et garde ta facturation prête si l’activité continue d’accélérer."
                              : "Aucune action immédiate, garde simplement un œil sur ton chiffre d’affaires cumulé."}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="btn btnActionSecondary"
                          type="button"
                          onClick={() => {
                            setShowTVADiagnosticModal(false);
                            openExplanationModal("tva");
                          }}
                        >
                          Comprendre la TVA
                        </button>
                        <button
                          className="btn btnPrimary"
                          type="button"
                          onClick={() => setShowTVADiagnosticModal(false)}
                        >
                          J’ai compris
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Repères fiscaux */}
              <div className="fiscalTimeline">
                <div className="dashboardSectionHeader">
                  <div className="dashboardSectionHeaderMain">
                    <h3 className="dashboardSectionTitle">{FISCAL_MARKERS_COPY.title}</h3>
                  </div>
                </div>
                <div className="timelineList">
                  {fiscalTimeline.map((item) => {
                    const content = (
                      <>
                        <div className="timelineTop">
                          <span className="timelineIcon">{item.icon}</span>
                          <span className="timelineLabel">{item.label}</span>
                        </div>
                        <div className="timelineValue">{item.value}</div>
                        <div className="timelineHint">{item.hint}</div>
                        {item.action && (
                          <div className="timelineAction">
                            {item.action.label}
                          </div>
                        )}
                      </>
                    );

                    return item.action ? (
                      <button
                        key={item.key}
                        className="timelineItem timelineItemActionable"
                        type="button"
                        onClick={item.action.onClick}
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={item.key} className="timelineItem">
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Analyse financière */}
              {isFiscalProfileComplete && computed.monthlyExpenses !== undefined && (
                <div
                  id="analysis-section"
                  ref={analyseRef}
                  className="financialAnalysis dashboardSectionZone dashboardSectionZoneMint dashboardOrderAnalysis"
                >
                  <div className="dashboardSectionHeader">
                    <div className="dashboardSectionHeaderMain">
                      <h3 className="dashboardSectionTitle">{ANALYSIS_COPY.title}</h3>
                    </div>
                    <div className="dashboardSectionActions">
                      <button
                        className="btn btnActionUtility btnSmall"
                        type="button"
                        onClick={() => toggleDashboardSection("analysis")}
                      >
                        {dashboardSections.analysis ? "Voir" : "Réduire"}
                      </button>
                    </div>
                  </div>
                  {!dashboardSections.analysis ? (
                    <>
                      {computed.monthlyExpenses === 0 && revenues.length > 0 && (
                        <div className="dashboardTrustCard" style={{ marginBottom: 16 }}>
                          <div className="dashboardRecommendationTitle">
                            {ANALYSIS_COPY.missingExpensesTitle}
                          </div>
                          <div className="dashboardRecommendationText">
                            {ANALYSIS_COPY.missingExpensesText}
                          </div>
                        </div>
                      )}
                      <div className="fiscalDashboard" style={{ marginTop: 12 }}>
                        {!shouldShowAnnualProjection ? (
                          <div className="fiscalCard">
                            <div className="fiscalLabel">{ANALYSIS_COPY.projectionLabel}</div>
                            <div
                              className="dashboardHelperText"
                              style={{ fontSize: 11, marginTop: 0 }}
                            >
                              {ANALYSIS_COPY.projectionPendingText}
                            </div>
                          </div>
                        ) : computed.annualRevenue !== undefined && (
                          <div className="fiscalCard">
                            <div className="fiscalLabel">{ANALYSIS_COPY.projectionLabel}</div>
                            <div className="fiscalValue">
                              {computed.annualNet !== null &&
                              computed.annualNet !== undefined
                                ? getDisplayValue(computed.annualNet, "money")
                                : dashboardQuietPlaceholder}
                            </div>
                            <div className="dashboardHelperText">
                              {ANALYSIS_COPY.projectionValueHelper}
                            </div>
                            <div className="dashboardHelperText">
                              {annualProjectionHelper}
                            </div>
                          </div>
                        )}
                        {computed.monthlyExpenses > 0 && (
                          <div className="fiscalCard">
                            <div className="fiscalLabel">{ANALYSIS_COPY.expensesLabel}</div>
                            <div className="fiscalValue">
                              {getDisplayValue(computed.monthlyExpenses, "money")}
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: 12, marginTop: 6 }}
                            >
                              {ANALYSIS_COPY.expensesHelper}
                            </div>
                          </div>
                        )}
                        {computed.coverageRatio && (
                          <div className="fiscalCard">
                            <div className="fiscalLabel">{ANALYSIS_COPY.coverageLabel}</div>
                            <div className="fiscalValue">
                              {Math.round(computed.coverageRatio * 100)}%
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: 12, marginTop: 6 }}
                            >
                              {ANALYSIS_COPY.coverageHelper}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="dashboardHelperText" style={{ marginTop: 0 }}>
                      {computed.monthlyExpenses > 0
                        ? ANALYSIS_COPY.collapsedWithExpenses(computed.monthlyExpenses)
                        : ANALYSIS_COPY.collapsedEmpty}
                    </div>
                  )}
                </div>
              )}

              <div id="score-section" className="fiscalScoreCard dashboardOrderScore">
                <div className="fiscalScoreHeader">
                  <h3>{SCORE_COPY.title}</h3>
                  <div
                    className={`dashboardConfidenceBadge confidence-${dashboardConfidence.tone}`}
                  >
                    {dashboardConfidence.label}
                  </div>
                </div>
                <div className="fiscalScoreValue">
                  {fiscalScore.value} <span>/ 100</span>
                </div>
                <div className="fiscalScoreText">
                  {fiscalScore.interpretation}
                </div>
                <div className="fiscalScoreBar">
                  <div
                    className="fiscalScoreBarFill"
                    style={{ width: `${fiscalScore.value}%` }}
                  />
                </div>
                <div className="dashboardHelperText">
                  {fiscalScoreHelper} {confidenceHelperText}.
                </div>
              </div>

              {/* Добавьте после fiscalDashboard */}
              {isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (
                <div
                  className="progressIndicators"
                >
                  <div className="progressItem">
                    <div className="progressItemHeader">
                      <span>💰 Objectif d'épargne</span>
                      {/* LOT 5.29 UI boundary: future UI migration must not change coaching or PDF. */}
                      <span>
                        {Math.min(
                          100,
                          Math.round(
                            (savingsProgress /
                              Math.max(
                                fiscalSummaryVisibleSlice.finalContributionAmount * 3,
                                500,
                              )) *
                              100,
                          ),
                        )}
                        %
                      </span>
                    </div>
                    <div className="progressBar progressBarPremium">
                      <div
                        className="progressFill"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (savingsProgress /
                                Math.max(
                                  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
                                  500,
                                )) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ACRE Expiration Warning */}
              {/* Santé financière */}
              {isFiscalProfileComplete && computed.financialHealth && computed.financialHealthMessage && (
                <div
                  className={`financialHealthBox health-${computed.financialHealth}`}
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    background:
                      computed.financialHealth === "danger"
                        ? "#fff5f5"
                        : computed.financialHealth === "warning"
                          ? "#fffaf1"
                          : computed.financialHealth === "neutral"
                            ? "#f8f9fb"
                            : computed.financialHealth === "ok"
                              ? "#f4fbf6"
                              : "#f8f9fb",
                    border: `1px solid ${computed.financialHealth === "danger" ? "#f1c9c9" : computed.financialHealth === "warning" ? "#f0deae" : computed.financialHealth === "ok" ? "#cfe8cf" : "#e2e8f0"}`,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>📊</span> Santé financière
                  </div>
                  <div
                    style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.4 }}
                  >
                    {computed.financialHealthMessage}
                  </div>
                  {computed.savingsRecommended > 0 && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#555",
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      💰 Objectif d'épargne recommandé :{" "}
                      <strong>
                        {computed.savingsRecommended.toLocaleString("fr-FR")} €
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Alerte CFE avec date de début d'activité */}
              {user && computed?.cfeAlert?.show && (
                <div
                  className="cfeWarning"
                  style={{
                    marginTop: 16,
                    marginBottom: 16,
                    padding: "12px 16px",
                    background: "#fff5f0",
                    borderLeft: "4px solid #f97316",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong>
                        ⚠️ Attention CFE {new Date().getFullYear()}
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                        {computed?.cfeAlert?.message}
                        {computed?.businessYear === 2 &&
                          " (2ème année d'activité)"}
                        {!computed?.businessYear &&
                          computed?.cfeAlert?.estimatedAmount === null && (
                            <span
                              style={{
                                display: "block",
                                fontSize: 12,
                                marginTop: 4,
                              }}
                            >
                              💡 Renseigne ta date de début d'activité dans ton
                              profil pour une estimation précise.
                            </span>
                          )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openExplanationModal("cfe")}
                      className="btn btnGhost btnSmall"
                      style={{ fontSize: 12, padding: "4px 12px" }}
                    >
                      📖 En savoir plus
                    </button>
                  </div>
                </div>
              )}
              <div
                id="revenues-section"
                ref={revenusRef}
                className="dashboardSectionZone dashboardSectionZoneCoolNeutral dashboardOrderRevenues"
              >
              {/* Journal des revenus */}
              <div className="journalHeader dashboardSectionHeader">
                <div className="dashboardSectionHeaderMain">
                  <h3 className="dashboardSectionTitle">
                    Mes revenus ({filteredRevenues.length})
                  </h3>
                  <p className="dashboardSectionSubtitle">
                    {filteredRevenues.length > 0
                      ? `Total : ${getDisplayValue(revenueSectionTotal, "money")}`
                      : "Ajoute ton premier revenu"}
                  </p>
                </div>
                <div className="journalFilters dashboardSectionActions">
                  <button
                    className="btn btnActionUtility btnSmall"
                    type="button"
                    onClick={() => toggleDashboardSection("revenues")}
                  >
                    {dashboardSections.revenues ? "Voir tout" : "Réduire"}
                  </button>
                  <button
                    className="btn btnActionSecondary btnSmall"
                    type="button"
                    onClick={handleExportCSV}
                    disabled={
                      filteredRevenues.length === 0 ||
                      isExportingCsv ||
                      isExportLimitReached
                    }
                    title="Exporter les revenus affichés"
                    style={{
                      opacity:
                        filteredRevenues.length === 0 ||
                        isExportingCsv ||
                        isExportLimitReached
                          ? 0.5
                          : 1,
                      cursor:
                        filteredRevenues.length === 0 ||
                        isExportingCsv ||
                        isExportLimitReached
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isExportingCsv ? "Export CSV..." : "Export CSV"}
                  </button>

                  <button
                    className="btn btnActionSecondary btnSmall"
                    type="button"
                    onClick={handleExportPDFWithLimit}
                    disabled={
                      revenues.length === 0 ||
                      isExportingPdf ||
                      isExportLimitReached
                    }
                    style={{
                      opacity:
                        revenues.length === 0 ||
                        isExportingPdf ||
                        isExportLimitReached
                          ? 0.5
                          : 1,
                      cursor:
                        revenues.length === 0 ||
                        isExportingPdf ||
                        isExportLimitReached
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isExportingPdf ? "Export PDF..." : "📄 Export PDF"}
                  </button>

                  {premiumExportBadge && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.35rem 0.7rem",
                        borderRadius: 999,
                        background: "rgba(255, 244, 214, 0.8)",
                        border: "1px solid rgba(217, 168, 41, 0.22)",
                        color: "#7c5a10",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {premiumExportBadge}
                    </span>
                  )}

                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="monthFilter"
                  >
                    <option value="all">Tous les mois</option>
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div
                className="dashboardHelperText"
              >
                {exportHelperText}
              </div>
              <div className="dashboardHelperText">
                Plus tu ajoutes de revenus, plus tes estimations deviennent fiables.
              </div>
              <div className="dashboardHelperText">
                Saisie manuelle pour le moment. Connexion automatique (URSSAF/API)
                prévue dans une prochaine version.
              </div>
              {renderBetaMicroFeedbackCard("revenues")}

              {filteredRevenues.length === 0 ? (
                <div className="emptyRevenueState">
                  <div className="emptyRevenueIcon">🧾</div>
                  <div className="emptyRevenueTitle">Ajoute ton premier revenu</div>
                  <p className="muted">
                    {selectedMonth === "all"
                      ? "Plus tu ajoutes de revenus, plus tes estimations deviennent fiables."
                      : "Aucune entrée pour ce mois."}
                  </p>
                  <button
                    className="btn btnActionPrimary btnSmall"
                    type="button"
                    onClick={handleOpenRevenuePopup}
                  >
                    Ajouter un revenu
                  </button>
                </div>
              ) : dashboardSections.revenues ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    color: "#475569",
                    marginTop: 12,
                  }}
                >
                  Historique replié • {filteredRevenues.length} revenu
                  {filteredRevenues.length > 1 ? "s" : ""} • Total{" "}
                  {revenueSectionTotal.toLocaleString("fr-FR")} €
                </div>
              ) : (
                <div className="revenuesList">
                  {filteredRevenues.map((item) => (
                    <div key={item.id} className="revenueItem">
                      <div className="revenueMain">
                        <div className="revenueAmount">
                          {Number(item.amount).toLocaleString("fr-FR")} €
                        </div>
                        <div className="revenueDate">
                          {formatRevenueDate(item.date)}
                        </div>
                      </div>
                      <div className="revenueMeta">
                        {item.revenue_category && (
                          <div>
                            <strong>Type :</strong>{" "}
                            {getRevenueCategoryLabel(item.revenue_category)}
                          </div>
                        )}
                        {item.client && (
                          <div>
                            <strong>Client :</strong> {item.client}
                          </div>
                        )}
                        {item.invoice && (
                          <div>
                            <strong>Facture :</strong> {item.invoice}
                          </div>
                        )}
                        {item.note && (
                          <div>
                            <strong>Note :</strong> {item.note}
                          </div>
                        )}
                      </div>
                      <div className="revenueActions">
                        <button
                          className="btn btnGhost btnSmall btnSubtleDanger"
                          onClick={() => handleDeleteRevenue(item.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Historique mensuel */}
              {monthlyHistory.length > 0 && (
                <div className="monthlyHistory">
                  <div className="journalHeader dashboardSectionHeader">
                    <div className="dashboardSectionHeaderMain">
                      <h3 className="dashboardSectionTitle">Historique mensuel</h3>
                      <p className="dashboardSectionSubtitle">
                        {monthlyHistory.length} mois suivis
                      </p>
                    </div>
                    <div className="journalFilters dashboardSectionActions">
                      <button
                        className="btn btnActionUtility btnSmall"
                        type="button"
                        onClick={() => toggleDashboardSection("chart")}
                      >
                        {dashboardSections.chart ? "Voir tout" : "Réduire"}
                      </button>
                    </div>
                  </div>

                  {!dashboardSections.chart && (
                    <>
                      {showChart && revenueChartData.length > 0 && (
                        <div ref={chartRef} className="revenueChartCard">
                          <div className="chartHeader">
                            <div>
                              <h3>Évolution</h3>
                              <span className="muted">6 derniers mois</span>
                            </div>
                            <button
                              className="iconBtn"
                              onClick={hideChart}
                              aria-label="Masquer le graphique"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="revenueChart">
                            {revenueChartData.map((item) => {
                              const date = new Date(item.year, item.month);
                              const label = date.toLocaleDateString("fr-FR", {
                                month: "short",
                              });
                              const height = Math.max(
                                12,
                                (item.total / maxRevenueValue) * 140,
                              );
                              return (
                                <div
                                  key={`${item.year}-${item.month}`}
                                  className="chartCol"
                                >
                                  <div
                                    className="chartBar"
                                    style={{ height: `${height}px` }}
                                    title={`${item.total.toLocaleString("fr-FR")} €`}
                                  />
                                  <div className="chartValue">
                                    {item.total.toLocaleString("fr-FR")} €
                                  </div>
                                  <div className="chartLabel">{label}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="historyList">
                        {monthlyHistory.map((m) => {
                          const date = new Date(m.year, m.month);
                          const label = date.toLocaleDateString("fr-FR", {
                            month: "long",
                            year: "numeric",
                          });
                          return (
                            <div
                              key={`${m.year}-${m.month}`}
                              className="historyItem"
                            >
                              <span className="historyMonth">{label}</span>
                              <strong className="historyTotal">
                                {m.total.toLocaleString("fr-FR")} €
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {dashboardSections.chart && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        color: "#475569",
                        marginTop: 12,
                      }}
                    >
                      Le graphique et l’historique mensuel sont repliés.
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* ===== MES FACTURES ===== */}
              <div
                id="invoices-section"
                ref={facturesRef}
                className="dashboardSectionZone dashboardSectionZoneSoftNeutral dashboardOrderInvoices"
                style={{ marginTop: 24 }}
              >
                <div className="journalHeader dashboardSectionHeader">
                  <div className="dashboardSectionHeaderMain">
                    <h3 className="dashboardSectionTitle">
                      Mes factures ({invoiceSectionSummary.count})
                    </h3>
                    <p className="dashboardSectionSubtitle">
                      {invoiceSectionSummary.unpaidCount > 0
                        ? `${invoiceSectionSummary.unpaidCount} impayée${invoiceSectionSummary.unpaidCount > 1 ? "s" : ""}`
                        : "Aucun impayé"}
                    </p>
                    <p className="dashboardSectionSubtitle">
                      {PDP_ROADMAP_NOTE}
                    </p>
                  </div>
                  <div className="journalFilters dashboardSectionActions">
                    <span className="einvoicingBadge">
                      Facture électronique prête (brouillon Factur-X)
                    </span>
                    <button
                      className="btn btnActionUtility btnSmall"
                      type="button"
                      onClick={() => toggleDashboardSection("invoices")}
                    >
                      {dashboardSections.invoices ? "Voir tout" : "Réduire"}
                    </button>
                    <button
                      className="btn btnActionPrimary btnSmall"
                      type="button"
                      onClick={handleOpenInvoiceGenerator}
                    >
                      + Nouvelle facture
                    </button>
                  </div>
                </div>

                <div className="einvoicingInfoCard">
                  <div>
                    <h3>Anticipe la facture électronique</h3>
                    <p>
                      Microassist t’aide à créer des factures claires et
                      cohérentes avec tes revenus. Tu peux déjà générer un PDF
                      et préparer un brouillon Factur-X. La transmission
                      automatique via une plateforme agréée sera ajoutée plus
                      tard.
                    </p>
                    <p className="einvoicingTrustNote">
                      Important : ce document n’est pas encore transmis
                      automatiquement via une plateforme agréée.
                    </p>
                  </div>
                  <button
                    className="btn btnActionSecondary btnSmall"
                    type="button"
                    onClick={handleOpenInvoiceGenerator}
                  >
                  Créer une facture
                  </button>
                </div>

                {revenues.length > 0 && visibleInvoices.length === 0 && (
                  <div className="einvoicingInfoCard" style={{ marginTop: 12 }}>
                    <div>
                      <h3>⚠️ Revenu sans facture liée</h3>
                      <p>
                        Tu as des revenus enregistrés, mais aucune facture liée.
                        Créer une facture permet de mieux justifier ton chiffre
                        d’affaires.
                      </p>
                    </div>
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={handleOpenInvoiceFromLatestRevenue}
                    >
                      Créer une facture depuis un revenu
                    </button>
                  </div>
                )}

                {invoiceNotice && (
                  <div className="saveNotice" style={{ marginTop: 16, width: "100%" }}>
                    {typeof invoiceNotice === "string" ? (
                      <>✅ {invoiceNotice}</>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>{invoiceNotice.title}</div>
                        <div>{invoiceNotice.body}</div>
                        {invoiceNotice.invoice && (
                          <div>
                            <button
                              className="btn btnActionSecondary btnSmall"
                              type="button"
                              onClick={() =>
                                generateB2CInvoicePdf(invoiceNotice.invoice, {
                                  userEmail: user?.email || "",
                                })
                              }
                            >
                              Télécharger la facture
                            </button>
                          </div>
                        )}
                        {invoiceNotice.cta === "auth" && (
                          <div>
                            <button
                              className="btn btnActionSecondary btnSmall"
                              type="button"
                              onClick={() => openAuthModal("signup")}
                            >
                              Créer mon compte pour garder cette facture
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {renderBetaMicroFeedbackCard("invoices")}

                {visibleInvoices.length === 0 ? (
                  <div className="emptyRevenueState emptyRevenueStateCompact">
                    <div className="emptyRevenueIcon">🧾</div>
                    <div className="emptyRevenueStatus">Suivi factures à démarrer</div>
                    <div className="emptyRevenueTitle">Aucune facture enregistrée</div>
                    <p className="muted">
                      Une facture rend le suivi plus clair pour tes clients, tes encaissements
                      et la TVA collectée quand elle s’active.
                    </p>
                    <button
                      className="btn btnActionPrimary btnSmall"
                      type="button"
                      onClick={handleOpenInvoiceGenerator}
                    >
                      Créer une facture
                    </button>
                  </div>
                ) : dashboardSections.invoices ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#475569",
                      marginTop: 12,
                    }}
                  >
                    Historique replié • {invoiceSectionSummary.count} facture
                    {invoiceSectionSummary.count > 1 ? "s" : ""}
                    {invoiceSectionSummary.unpaidCount > 0 &&
                      ` • ${invoiceSectionSummary.unpaidCount} impayée${invoiceSectionSummary.unpaidCount > 1 ? "s" : ""}`}
                  </div>
                ) : (
                  <div className="revenuesList">
                    {visibleInvoices.map((invoice) => {
                      const complianceScore = getInvoiceComplianceScore(
                        invoice,
                        userProfile,
                      );
                      const complianceBadge =
                        complianceScore.status === "conforme"
                          ? {
                              className: "badgeGreen",
                              label: "✅ Conforme",
                            }
                          : complianceScore.status === "bloquant"
                            ? {
                                className: "badgeYellow",
                                label: "❌ Bloquant",
                              }
                            : {
                                className: "badgeYellow",
                                label: "⚠️ À compléter",
                              };

                      return (
                      <div key={invoice.id} className="revenueItem">
                        <div className="revenueMain">
                          <div className="revenueAmount">
                            {getInvoiceDisplayAmountLabel(invoice)}
                          </div>
                          <div className="revenueDate">
                            N° {getInvoiceDisplayNumber(invoice)}
                          </div>
                        </div>
                        <div className="revenueMeta">
                          {invoice.client_name && (
                            <div>
                              <strong>Client :</strong> {invoice.client_name}
                            </div>
                          )}
                          {invoice.description && (
                            <div>
                              <strong>Prestation :</strong>{" "}
                              {invoice.description}
                            </div>
                          )}
                          {invoice.invoice_date && (
                            <div>
                              <strong>Date :</strong>{" "}
                              {new Date(
                                `${getInvoiceDisplayDate(invoice)}T00:00:00`,
                              ).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })}
                            </div>
                          )}
                          {getInvoiceTotals(invoice).isVatExempt && (
                            <div>
                              <strong>TVA :</strong> {TVA_EXEMPTION_MENTION}
                            </div>
                          )}
                          {isFacturXDraftInvoice(invoice) && (
                            <div>
                              <strong>Statut :</strong> PDF prêt
                            </div>
                          )}
                          {isFacturXDraftInvoice(invoice) && (
                            <div>
                              <strong>Mention :</strong> Brouillon Factur-X
                            </div>
                          )}
                          <div>
                            <strong>Score conformité :</strong>{" "}
                            {complianceScore.score}/100
                          </div>
                          {complianceScore.alerts.map((alert) => (
                            <div key={alert}>{alert}</div>
                          ))}
                        </div>
                        <div className="revenueActions">
                          <span
                            className={`badge ${
                              getInvoicePaymentStatus(invoice) === "paid"
                                ? "badgeGreen"
                                : "badgeYellow"
                            }`}
                          >
                            {getInvoicePaymentStatus(invoice) === "paid"
                              ? "Payée"
                              : "En attente"}
                          </span>
                          <span
                            className={`badge ${complianceBadge.className}`}
                          >
                            {complianceBadge.label}
                          </span>
                          <span className="badge badgeGreen">PDF prêt</span>
                          {invoice.localOnly && (
                            <span className="badge badgeGray">
                              Locale • non enregistrée
                            </span>
                          )}
                          {isFacturXDraftInvoice(invoice) && (
                            <span className="badge badgeGray">
                              Brouillon Factur-X
                            </span>
                          )}
                          <button
                            className="btn btnActionSecondary btnSmall"
                            type="button"
                            onClick={() =>
                              generateB2CInvoicePdf(invoice, {
                                userEmail: user?.email || "",
                              })
                            }
                          >
                            PDF
                          </button>
                          {getInvoicePaymentStatus(invoice) !== "paid" && (
                            <button
                              className="btn btnActionSecondary btnSmall"
                              type="button"
                              onClick={() => handleMarkInvoicePaid(invoice)}
                            >
                              Marquer comme payée
                            </button>
                          )}
                          {isFacturXDraftInvoice(invoice) && (
                            <button
                              className="btn btnActionSecondary btnSmall"
                              type="button"
                              onClick={() => downloadInvoiceXmlDraft(invoice)}
                            >
                              XML
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                id="advisor-share-section"
                className="dashboardSectionZone dashboardSectionZoneCoolNeutral dashboardAdvisorShareCard dashboardOrderAdvisorShare"
              >
                <div className="dashboardSectionHeader">
                  <div className="dashboardSectionHeaderMain">
                    <h3 className="dashboardSectionTitle">
                      Partager mon suivi avec un conseiller
                    </h3>
                    <p className="dashboardSectionSubtitle">
                      Envoie un résumé clair de ta situation à une personne qui peut t’aider.
                    </p>
                  </div>
                  <div className="dashboardSectionActions">
                    <button
                      className="btn btnActionSecondary btnSmall"
                      type="button"
                      onClick={handleCopyExpertShareLink}
                    >
                      Copier le lien de partage
                    </button>
                  </div>
                </div>
                <div className="dashboardHelperText">
                  Aucune donnée sensible n’est partagée dans cette version de
                  démonstration.
                </div>
              </div>

              <div className="dashboardFooterLinks">
                <a
                  href={FEEDBACK_FORM_URL}
                  className="dashboardProblemLink"
                  target="_blank"
                  rel="noreferrer"
                >
                  🐛 Signaler un problème
                </a>
              </div>

              {dashboardFloatingAction && (
                <>
                  <div className="dashboardMobileActionSpacer" aria-hidden="true" />
                  <div className="dashboardMobileActionBar">
                    <button
                      className="btn btnActionPrimary"
                      type="button"
                      onClick={dashboardFloatingAction.onClick}
                    >
                      {dashboardFloatingAction.cta}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          </>
        )}
        </main>

        {showAddRevenue && (
          <div className="modalOverlay" onClick={handleCloseRevenuePopup}>
            <div
              className="modalCard"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-revenue-title"
            >
              <div className="sectionHead">
                <h3 id="add-revenue-title">Ajouter revenu</h3>

                <button
                  className="iconBtn"
                  type="button"
                  onClick={handleCloseRevenuePopup}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="formGrid">
                <label className="field">
                  <span>Montant (€)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={revenueForm.amount}
                    onChange={(e) =>
                      handleRevenueFieldChange("amount", e.target.value)
                    }
                    placeholder="Ex : 200"
                  />
                </label>

                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={revenueForm.date}
                    onChange={(e) =>
                      handleRevenueFieldChange("date", e.target.value)
                    }
                  />
                </label>
              </div>

              {isMixedActivityValue(dashboardAnswers.activity_type) && (
                <div style={{ marginTop: 12 }}>
                  <label className="field">
                    <span>Type de revenu</span>
                    <select
                      required
                      value={revenueForm.revenue_category}
                      onChange={(e) =>
                        handleRevenueFieldChange("revenue_category", e.target.value)
                      }
                    >
                      <option value="">Choisir une catégorie</option>
                      <option value="vente">Commerce (BIC)</option>
                      <option value="service">Service (BNC / prestations)</option>
                    </select>
                  </label>
                  <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    Pour une activité mixte, indique si ce revenu vient du commerce
                    (BIC) ou d’un service (BNC / prestation) afin d’obtenir une
                    estimation plus précise.
                  </p>
                </div>
              )}

              <button
                className="btn btnGhost btnSmall"
                type="button"
                onClick={() => setShowRevenueDetails((v) => !v)}
                style={{ marginTop: 12 }}
              >
                {showRevenueDetails
                  ? "Masquer les détails"
                  : "+ Ajouter détails"}
              </button>

              {showRevenueDetails && (
                <div className="formGrid" style={{ marginTop: 12 }}>
                  <label className="field">
                    <span>Client</span>
                    <input
                      type="text"
                      value={revenueForm.client}
                      onChange={(e) =>
                        handleRevenueFieldChange("client", e.target.value)
                      }
                      placeholder="Optionnel"
                    />
                  </label>

                  <label className="field">
                    <span>Facture</span>
                    <input
                      type="text"
                      value={revenueForm.invoice}
                      onChange={(e) =>
                        handleRevenueFieldChange("invoice", e.target.value)
                      }
                      placeholder="Optionnel"
                    />
                  </label>

                  <label className="field fieldFull">
                    <span>Note</span>
                    <input
                      type="text"
                      value={revenueForm.note}
                      onChange={(e) =>
                        handleRevenueFieldChange("note", e.target.value)
                      }
                      placeholder="Optionnel"
                    />
                  </label>
                </div>
              )}

              {revenueAmount > 0 && (
                <div className="revenuePreview">
                  <div className="previewTitle">Estimation rapide</div>

                  <div className="previewRow">
                    <span>Taux estimé</span>
                    <strong>{previewRateLabel}</strong>
                  </div>

                  <div className="previewRow">
                    <span>Charges estimées</span>
                    <strong>{previewCharges.toLocaleString("fr-FR")} €</strong>
                  </div>

                  <div className="previewRow">
                    <span>Net estimé</span>
                    <strong>
                      {previewAvailable.toLocaleString("fr-FR")} €
                    </strong>
                  </div>

                  <div className="previewAdvice">💡 {previewAdvice}</div>
                </div>
              )}

              <div className="miniActions" style={{ marginTop: 16 }}>
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={handleCloseRevenuePopup}
                >
                  Annuler
                </button>

                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={handleSaveRevenue}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        <MicroassistFooter
          onGoToAssistant={goToAssistant}
          onGoToDashboard={() => goToDashboard({ scroll: false })}
          onGoToInvoices={() => {
            goToView("dashboard", { push: true, focus: true });
            setTimeout(() => {
              document
                .getElementById("invoices-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }}
          onGoToPricing={goToPricing}
          onGoToReminders={() => {
            goToView("dashboard", { push: true, focus: true });
            setTimeout(() => {
              document
                .getElementById("reminders-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }}
          onGoToHelp={() => goToLandingSection("services")}
        />

        {showCGU && (
          <CGUModal isOpen={showCGU} onClose={() => setShowCGU(false)} />
        )}
        {showPrivacy && (
          <CGUModal
            isOpen={showPrivacy}
            onClose={() => setShowPrivacy(false)}
            initialTab="privacy"
          />
        )}


        {/* Modal d'authentification */}
        {authOpen && (
          <AuthGate
            initialMode={authInitialMode}
            isRecoveryFlow={isRecoveryFlow}
            isAuthenticated={Boolean(user) && !isRecoveryFlow}
            onClose={() => {
              if (isRecoveryFlow) {
                return;
              }
              closeAuthModal("auth user change effect");
            }}
            onLogout={handleLogout}
            onGoToDashboard={() => {
              if (isRecoveryFlow) {
                return;
              }
              setIsRecoveryFlow(false);
              closeAuthModal("auth user change effect");
              goToDashboard({ scroll: false });
            }}
            onRecoveryComplete={handleRecoveryComplete}
            onSuccess={({ mode } = {}) => {
              if (isRecoveryFlow) {
                return;
              }
              localStorage.setItem(
                PENDING_AUTH_SUCCESS_KEY,
                mode === "signup" ? "signup" : "manual_auth",
              );
              closeAuthModal("auth user change effect");
            }}
          />
        )}

        {profileConflictState.open && (
          <div className="modalOverlay" onClick={(e) => e.stopPropagation()}>
            <div
              className="modalCard"
              style={{ maxWidth: "560px" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-conflict-title"
            >
              <div className="sectionHead">
                <h3 id="profile-conflict-title">
                  Deux profils différents ont été détectés
                </h3>
              </div>

              <p style={{ marginTop: 16, lineHeight: 1.6 }}>
                Deux profils différents ont été détectés sur cet appareil et sur
                ce compte. Pour éviter des calculs incorrects, Microassist ne les
                fusionne pas automatiquement.
              </p>

              <div className="miniActions" style={{ marginTop: 20 }}>
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={handleUseRemoteProfile}
                >
                  Utiliser le profil du compte
                </button>

                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={handleKeepLocalDraft}
                >
                  Garder le brouillon local
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingStructuredProfileEdit && (
          <div className="modalOverlay" onClick={(e) => e.stopPropagation()}>
            <div
              className="modalCard"
              style={{ maxWidth: "560px" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="structured-profile-warning-title"
            >
              <div className="sectionHead">
                <h3 id="structured-profile-warning-title">
                  Tu modifies un élément important de ton profil fiscal
                </h3>
              </div>

              <p style={{ marginTop: 16, lineHeight: 1.6 }}>
                Cela peut modifier tes calculs (charges, TVA, échéances)
                <br />
                et l’interprétation de tes revenus déjà enregistrés.
              </p>

              <p style={{ marginTop: 14, lineHeight: 1.6 }}>
                Que souhaites-tu faire ?
              </p>

              <div className="miniActions" style={{ marginTop: 20 }}>
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={handleConfirmStructuredProfileEdit}
                >
                  Appliquer les changements
                </button>

                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={handleCancelStructuredProfileEdit}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {showResetModal && (
          <div className="modalOverlay" onClick={() => !resetInProgress && setShowResetModal(false)}>
            <div
              className="modalCard"
              style={{ maxWidth: "560px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sectionHead">
                <h3>Réinitialiser ton espace</h3>
                <button
                  className="iconBtn"
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetInProgress}
                >
                  ✕
                </button>
              </div>

              <p style={{ marginTop: 16, lineHeight: 1.6 }}>
                Choisis le niveau de réinitialisation. L’objectif est d’éviter tout
                mélange entre ancien profil et nouveaux calculs.
              </p>

              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                <div
                  style={{
                    border: "1px solid #dbeafe",
                    background: "#f8fbff",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    Recommencer le profil fiscal
                  </div>
                  <p style={{ marginTop: 8, marginBottom: 12, color: "#334155", lineHeight: 1.6 }}>
                    Réinitialise seulement le profil fiscal et les étapes de l’assistant.
                    Tes revenus, factures et rappels restent disponibles.
                  </p>
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={handleProfileOnlyReset}
                    disabled={resetInProgress}
                  >
                    Réinitialiser le profil
                  </button>
                </div>

                <div
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fff7f7",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#7f1d1d" }}>
                    Réinitialiser tout mon espace
                  </div>
                  <p style={{ marginTop: 8, marginBottom: 12, color: "#7f1d1d", lineHeight: 1.6 }}>
                    Supprime le profil, les revenus, les factures, les rappels et remet
                    l’interface à zéro pour repartir sans aucune donnée résiduelle.
                  </p>
                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={handleFullReset}
                    disabled={resetInProgress}
                    style={{ background: "#b91c1c", borderColor: "#b91c1c" }}
                  >
                    {resetInProgress ? "Réinitialisation..." : "Tout réinitialiser"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: "#f8fafc",
                  color: "#475569",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Clés locales concernées par la réinitialisation complète :
                <code style={{ marginLeft: 6 }}>
                  {FULL_RESET_LOCAL_STORAGE_KEYS.join(", ")}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Modal Enregistrement / options à venir */}
        {showPricingModal && (
          <div
            className="modalOverlay"
            onClick={() => closePremiumModal(premiumModalSource)}
          >
            <div
              className="modalCard"
              style={{ maxWidth: "520px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sectionHead">
                <h3>{premiumModalContent.title}</h3>
                <button
                  className="iconBtn"
                  onClick={() => closePremiumModal(premiumModalSource)}
                  type="button"
                >
                  ✕
                </button>
              </div>

  <div style={{ marginTop: 20 }}>
  <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 0 }}>
  {premiumModalContent.intro}
</p>

  {premiumWaitlistJoined && (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      ✔️ Accès prioritaire activé
    </div>
  )}

  <div
    style={{
      background: "#fef3c7",
      padding: 18,
      borderRadius: 12,
      marginTop: 16,
      marginBottom: 20,
    }}
  >
  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>
  {premiumModalContent.heroTitle}
  </div>
  <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
    {premiumModalContent.heroText}
  </p>
  </div>

  <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
    <label
      htmlFor="premium-waitlist-email"
      style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}
    >
      Ton email
    </label>
    <input
      id="premium-waitlist-email"
      type="email"
      value={premiumWaitlistEmail}
      onChange={(e) => {
        setPremiumWaitlistEmail(e.target.value);
        if (premiumWaitlistError) {
          setPremiumWaitlistError("");
        }
      }}
      placeholder="prenom@email.com"
      autoComplete="email"
      disabled={isJoiningPremiumWaitlist}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: premiumWaitlistError
          ? "1px solid #fca5a5"
          : "1px solid #d1d5db",
        fontSize: 14,
      }}
    />
    {premiumWaitlistError && (
      <div style={{ fontSize: 12, color: "#b91c1c" }}>
        {premiumWaitlistError}
      </div>
    )}
  </div>

  <div
    style={{
      background: "#f5f3ff",
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
      Ce que Premium t’apporte
    </div>

    <ul
      style={{
        margin: 0,
        paddingLeft: 20,
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      {premiumModalBenefits.map((benefit) => (
        <li key={benefit}>{benefit}</li>
      ))}
    </ul>
  </div>

  <div
    style={{
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
    }}
  >
<button
  className="btn btnPrimary"
  type="button"
  onClick={() => handlePremiumWaitlistCTA(premiumModalSource)}
  disabled={isJoiningPremiumWaitlist}
  style={{ flex: 1 }}
>
  {isJoiningPremiumWaitlist
    ? "Inscription en cours..."
    : premiumModalPrimaryCtaLabel}
</button>

  <p
    style={{
      flexBasis: "100%",
      fontSize: 12,
      color: "#475569",
      textAlign: "center",
      margin: "-2px 0 0",
      lineHeight: 1.5,
    }}
  >
    Le paiement sera disponible très bientôt.
  </p>

    <button
      className="btn btnGhost"
      type="button"
      onClick={() => {
        trackPremiumEvent(premiumModalSource || "unknown", "continue_free");
        setShowPricingModal(false);
      }}
      style={{ flex: 1 }}
    >
      Continuer en gratuit
    </button>
  </div>

  <p
    style={{
      fontSize: 12,
      color: "#475569",
      textAlign: "center",
      marginTop: 10,
      marginBottom: 0,
      lineHeight: 1.5,
    }}
  >
    Tu peux déjà découvrir Premium et laisser ton email pour la suite.
  </p>

  <p
    style={{
      fontSize: 11,
      color: "#9ca3af",
      textAlign: "center",
      marginTop: 14,
      marginBottom: 0,
    }}
  >
    Aucun paiement maintenant • email d’information uniquement
  </p>
</div>
            </div>
          </div>
        )}

        {showFutureAdvancedModal && (
          <div
            className="modalOverlay"
            onClick={() => closeFutureAdvancedModal("future_advanced_features")}
          >
            <div
              className="modalCard"
              style={{ maxWidth: "520px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sectionHead">
                <h3>Fonction avancée à venir</h3>
                <button
                  className="iconBtn"
                  onClick={() => closeFutureAdvancedModal("future_advanced_features")}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0, marginBottom: 0 }}>
                  Les alertes SMS feront partie d’une offre plus avancée.
                </p>

                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(99,102,241,0.08))",
                    padding: 18,
                    borderRadius: 12,
                    marginTop: 16,
                    marginBottom: 20,
                    border: "1px solid rgba(14,165,233,0.18)",
                  }}
                >
                  <div
                    style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}
                  >
                    SMS et automatisation
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    Microassist prépare des fonctionnalités plus avancées pour aller plus
                    loin dans l’accompagnement.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                  <label
                    htmlFor="future-advanced-email"
                    style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}
                  >
                    Ton email
                  </label>
                  <input
                    id="future-advanced-email"
                    type="email"
                    value={premiumWaitlistEmail}
                    onChange={(e) => {
                      setPremiumWaitlistEmail(e.target.value);
                      if (premiumWaitlistError) {
                        setPremiumWaitlistError("");
                      }
                    }}
                    placeholder="prenom@email.com"
                    autoComplete="email"
                    disabled={isJoiningPremiumWaitlist}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: premiumWaitlistError
                        ? "1px solid #fca5a5"
                        : "1px solid #d1d5db",
                      fontSize: 14,
                    }}
                  />
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Laisse ton email pour être prévenu(e) dès que ces fonctionnalités
                    seront disponibles.
                  </div>
                  {premiumWaitlistError && (
                    <div style={{ fontSize: 12, color: "#b91c1c" }}>
                      {premiumWaitlistError}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: "#eff6ff",
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                    Cette offre inclura
                  </div>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    <li>✔ Rappels SMS urgents</li>
                    <li>✔ Aide à l’automatisation des déclarations</li>
                    <li>✔ Documents générés automatiquement</li>
                    <li>✔ Suivi plus avancé de ton activité</li>
                  </ul>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="btn btnPrimary"
                    type="button"
                    onClick={() =>
                      joinPremiumWaitlist({
                        email: premiumWaitlistEmail,
                        source: "future_advanced_features",
                      })
                    }
                    disabled={isJoiningPremiumWaitlist}
                    style={{ flex: 1 }}
                  >
                    {isJoiningPremiumWaitlist
                      ? "Inscription en cours..."
                      : "Être informée de cette offre"}
                  </button>

                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={() => closeFutureAdvancedModal("future_advanced_features")}
                    style={{ flex: 1 }}
                  >
                    Plus tard
                  </button>
                </div>

                <p
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    textAlign: "center",
                    marginTop: 10,
                    marginBottom: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Tu seras informée quand ces fonctionnalités seront disponibles.
                </p>
              </div>
            </div>
          </div>
        )}

        <ExplanationModal
          content={EXPLANATION_CONTENT[explanationModalType]}
          onClose={closeExplanationModal}
        />
      </AppShell>
      {showInvoiceGenerator && (
        <InvoiceGenerator
          user={user}
          fiscalProfile={fiscalProfile}
          billingIdentity={billingIdentity}
          initialValues={invoiceInitialValues}
          onClose={() => {
            setShowInvoiceGenerator(false);
            setInvoiceInitialValues(null);
          }}
          onGoToProfile={() => {
            setShowInvoiceGenerator(false);
            setInvoiceInitialValues(null);
            handleEditProfile();
          }}
          onSaved={({ savedToSupabase, message, invoice } = {}) => {
            setShowInvoiceGenerator(false);
            setInvoiceInitialValues(null);
            if (savedToSupabase) {
              trackEvent("invoice_create", {
                source: "authenticated",
                totalRevenues: revenues.length,
                invoiceCount: visibleInvoices.length + 1,
              });
              showSuccessToast(
                "✅ Facture créée. Elle est maintenant disponible dans ton suivi.",
                4000,
              );
              refreshInvoices();
              setInvoiceNotice(
                invoice
                  ? {
                      title: "Facture créée ✅",
                      body:
                        message ||
                        "Elle est maintenant disponible dans ton suivi.",
                      invoice,
                    }
                  : message || "Facture créée. Elle est maintenant disponible dans ton suivi.",
              );
            } else if (invoice) {
              trackEvent("invoice_create", {
                source: user ? "authenticated_local_facturx" : "guest",
                totalRevenues: revenues.length,
                invoiceCount: visibleInvoices.length + 1,
              });
              showSuccessToast(
                "✅ Facture créée. Elle est maintenant disponible dans ton suivi.",
                4000,
              );
              setGuestInvoices((prev) => {
                const next = [invoice, ...prev];
                // FUTURE: persist invoices after invoice schema migration.
                localStorage.setItem(GUEST_INVOICES_KEY, JSON.stringify(next));
                return next;
              });
              setInvoiceNotice({
                title: "Facture créée ✅",
                body:
                  message ||
                  "Elle est maintenant disponible dans ton suivi. PDF et XML peuvent être téléchargés depuis la liste.",
                invoice,
                cta: user ? null : "auth",
              });
            }
            setTimeout(() => setInvoiceNotice(null), savedToSupabase ? 2500 : 5000);
          }}
        />
      )}

      {showReminderModal && (
  <div
    className="modalOverlay"
    onClick={() => setShowReminderModal(false)}
  >
    <div
      className="modalCard reminderSettingsModal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sectionHead">
        <h3>🔔 Gérer mes rappels</h3>
        <button
          className="iconBtn"
          onClick={() => setShowReminderModal(false)}
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="reminderSettingsBody">
        <p className="reminderSettingsIntro">
          Pendant la phase de test, les rappels email sont accessibles gratuitement.
          Les SMS et rappels avancés arriveront plus tard en Premium.
        </p>

        <div className="reminderSettingsList">
          <div className="reminderSettingsRow">
            <span>Déclaration URSSAF</span>
            <span className="reminderBadge reminderBadgeActive">Email actif</span>
          </div>
          <div className="reminderSettingsRow">
            <span>TVA</span>
            <span
              className={`reminderBadge ${
                profileConfirmationTvaLabel === "À confirmer"
                  ? "reminderBadgeNeutral"
                  : "reminderBadgeActive"
              }`}
            >
              {profileConfirmationTvaLabel === "À confirmer"
                ? "À configurer selon profil"
                : "Email actif"}
            </span>
          </div>
          <div className="reminderSettingsRow">
            <span>CFE</span>
            <span className="reminderBadge reminderBadgeActive">Email actif</span>
          </div>
          <div className="reminderSettingsRow">
            <span>Canal</span>
            <span className="reminderBadge reminderBadgeActive">Email</span>
          </div>
          <div className="reminderSettingsRow">
            <span>SMS</span>
            <span className="reminderBadge reminderBadgePremium">
              Bientôt Premium
            </span>
          </div>
        </div>

        <p className="reminderSettingsNote">
          SMS et rappels avancés bientôt en Premium.
        </p>

        <div className="reminderSettingsActions">
          <button
            className="btn btnPrimary"
            type="button"
            onClick={() => setShowReminderModal(false)}
          >
            J’ai compris
          </button>

          <button
            className="btn btnGhost"
            type="button"
            onClick={() => setShowReminderModal(false)}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </>
  );
}
