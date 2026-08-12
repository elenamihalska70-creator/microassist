export const DATA_SOURCES = Object.freeze({
  localStorage: "local_storage",
  supabase: "supabase",
  uiDraft: "ui_draft",
  computed: "computed",
  edgeFunction: "edge_function",
});

export const ACTIVITY_TYPES = Object.freeze({
  services: "services",
  commerce: "commerce",
  mixed: "mixte",
});

export const REVENUE_CATEGORIES = Object.freeze({
  unset: "",
  sale: "vente",
  service: "service",
});

export const DECLARATION_FREQUENCIES = Object.freeze({
  monthly: "mensuel",
  quarterly: "trimestriel",
});

export const ACRE_VALUES = Object.freeze({
  yes: "yes",
  no: "no",
  unknown: "unknown",
  toRequest: "to_request",
  requested: "requested",
});

export const TVA_STATUSES = Object.freeze({
  unknown: "unknown",
  franchise: "franchise",
  active: "active",
});

export const TVA_MODES = Object.freeze({
  franchiseEnBase: "franchise_en_base",
  exempt: "exempt",
  standard: "standard",
  later: "later",
});

export const INVOICE_STATUSES = Object.freeze({
  draft: "draft",
  unpaid: "unpaid",
  paid: "paid",
});

export const REMINDER_TYPES = Object.freeze({
  declaration: "declaration",
  tva: "tva",
  cfe: "cfe",
  acre: "acre",
});

export const REMINDER_STATUSES = Object.freeze({
  pending: "pending",
  sent: "sent",
  failed: "failed",
});

export const PREMIUM_PLANS = Object.freeze({
  free: "free",
  betaFounder: "beta_founder",
  essential: "essential",
  pilotage: "pilotage",
  fiscalAi: "fiscal_ai",
  financePro: "finance_pro",
});

export const PREMIUM_ACCESS_STATES = Object.freeze({
  freeAnonymous: "free_anonymous",
  freeAuthenticated: "free_authenticated",
  founderTrial: "founder_trial",
  premiumActive: "premium_active",
});

export const DEADLINE_TYPES = Object.freeze({
  declaration: "declaration",
  tva: "tva",
  cfe: "cfe",
  acre: "acre",
});

export const DEADLINE_RELIABILITY = Object.freeze({
  confirmed: "confirmed",
  estimated: "estimated",
  unknown: "unknown",
  toConfirm: "to_confirm",
});

export const DATE_FORMATS = Object.freeze({
  dateOnly: "YYYY-MM-DD",
  supabaseTimestamp: "timestamptz",
  localIsoTimestamp: "ISO-8601",
});

export const CURRENCY_CODES = Object.freeze({
  euro: "EUR",
});
