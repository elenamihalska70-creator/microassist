import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_TYPES,
  DECLARATION_FREQUENCIES,
  INVOICE_STATUSES,
  REVENUE_CATEGORIES,
  createUserAccount,
  normalizeBusinessProfile,
  normalizeCalculationResult,
  normalizeClient,
  normalizeDeadline,
  normalizeFiscalProfile,
  normalizeInvoice,
  normalizeInvoiceItem,
  normalizeNotificationPreference,
  normalizeObligation,
  normalizeReminder,
  normalizeRevenue,
  normalizeSubscription,
  validateFiscalProfile,
  validateInvoice,
  validateRevenue,
} from "../src/domain/index.js";

function assertPureNormalizer(normalize, input) {
  const before = structuredClone(input);
  const first = normalize(input);
  const second = normalize(first);

  assert.deepEqual(input, before);
  assert.deepEqual(second, first);
  assert.equal(first.unknown_field, input.unknown_field);
  return first;
}

test("normalizes user account id fields idempotently", () => {
  const user = assertPureNormalizer(createUserAccount, {
    id: "user-1",
    email: "ada@example.test",
    full_name: "Ada",
    unknown_field: "kept",
  });

  assert.equal(user.userId, "user-1");
  assert.equal(user.fullName, "Ada");
});

test("normalizes subscription fields from profiles and subscriptions", () => {
  const subscription = assertPureNormalizer(normalizeSubscription, {
    user_id: "user-1",
    plan: "free",
    subscription_status: "active",
    is_premium: true,
    trial_started_at: "2026-07-01T10:00:00.000Z",
    trial_ends_at: "2026-09-29T10:00:00.000Z",
    unknown_field: "kept",
  });

  assert.equal(subscription.userId, "user-1");
  assert.equal(subscription.isPremium, true);
  assert.equal(subscription.trialEndsAt, "2026-09-29T10:00:00.000Z");
});

test("normalizes fiscal profile from current local and Supabase shapes", () => {
  const profile = assertPureNormalizer(normalizeFiscalProfile, {
    user_id: "user-1",
    business_status: "micro_entreprise",
    activity_type: ACTIVITY_TYPES.services,
    declaration_frequency: DECLARATION_FREQUENCIES.monthly,
    acre: "unknown",
    acre_start_date: "",
    business_start_date: "2026-07-01",
    tva_status: "tva",
    monthly_revenue: "500",
    unknown_field: "kept",
  });

  assert.equal(profile.userId, "user-1");
  assert.equal(profile.activityType, ACTIVITY_TYPES.services);
  assert.equal(profile.declarationFrequency, DECLARATION_FREQUENCIES.monthly);
  assert.equal(profile.businessStartDate, "2026-07-01");
  assert.equal(profile.acreStartDate, null);
  assert.equal(profile.tvaStatus, "active");
  assert.equal(profile.monthlyRevenue, 500);
});

test("normalizes business profile and billing identity without changing ids", () => {
  const profile = assertPureNormalizer(normalizeBusinessProfile, {
    id: "profile-1",
    user_id: "user-1",
    legal_name: "Micro Test",
    billing_identity: { siret: "12345678900010" },
    business_start_date: "2026-07-29",
    unknown_field: "kept",
  });

  assert.equal(profile.id, "profile-1");
  assert.equal(profile.userId, "user-1");
  assert.equal(profile.billingIdentity.siret, "12345678900010");
});

test("validates fiscal profile unknown values and bad dates", () => {
  const result = validateFiscalProfile({
    activity_type: "invalid",
    declaration_frequency: "weekly",
    acre_start_date: "2026-13-01",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("activityType is not allowed"));
  assert.ok(result.errors.includes("declarationFrequency is not allowed"));
  assert.ok(result.errors.includes("acreStartDate must use YYYY-MM-DD"));
});

test("normalizes Supabase and local revenues without dropping historical fields", () => {
  const revenue = assertPureNormalizer(normalizeRevenue, {
    id: "rev-1",
    user_id: "user-1",
    amount: "123,45",
    revenue_date: "2026-07-29",
    revenue_category: REVENUE_CATEGORIES.service,
    client: "Client A",
    invoice: "F-1",
    note: "paid",
    created_at: "2026-07-29T10:00:00.000Z",
    unknown_field: "kept",
    source: "supabase",
  });

  assert.equal(revenue.amount, 123.45);
  assert.equal(revenue.date, "2026-07-29");
  assert.equal(revenue.userId, "user-1");
  assert.equal(revenue.revenueCategory, REVENUE_CATEGORIES.service);
});

test("validates revenue zero amount, negative amount and invalid category", () => {
  const valid = validateRevenue({
    amount: 0,
    date: "2026-07-29",
    revenue_category: "",
  });
  const invalid = validateRevenue({
    amount: -10,
    date: "29/07/2026",
    revenue_category: "invalid",
  });

  assert.equal(valid.valid, true);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes("amount must be zero or positive"));
  assert.ok(invalid.errors.includes("date must use YYYY-MM-DD"));
  assert.ok(invalid.errors.includes("revenueCategory is not allowed"));
});

test("normalizes client and invoice items from existing invoice structures", () => {
  const client = assertPureNormalizer(normalizeClient, {
    client_name: "Client B",
    client_email: "client@example.test",
    unknown_field: "kept",
  });
  const item = assertPureNormalizer(normalizeInvoiceItem, {
    description: "Prestation",
    quantity: "2",
    unitPrice: "100",
    vatRate: "20",
    totalHT: "200",
    totalTVA: "40",
    totalTTC: "240",
    unknown_field: "kept",
  });

  assert.equal(client.name, "Client B");
  assert.equal(item.quantity, 2);
  assert.equal(item.totalTTC, 240);
});

test("normalizes legacy and Factur-X invoice structures", () => {
  const invoice = assertPureNormalizer(normalizeInvoice, {
    invoice_number: "F-2026-001",
    invoice_date: "2026-07-29",
    due_date: "2026-08-28",
    status: "paid",
    paid_at: "2026-08-01T12:00:00.000Z",
    client_name: "Client B",
    amount: "240",
    localOnly: true,
    lines: [
      {
        description: "Prestation",
        quantity: "2",
        unitPrice: "100",
        vatRate: "20",
        totalHT: "200",
        totalTVA: "40",
        totalTTC: "240",
      },
    ],
    unknown_field: "kept",
  });

  assert.equal(invoice.invoiceNumber, "F-2026-001");
  assert.equal(invoice.issueDate, "2026-07-29");
  assert.equal(invoice.status, INVOICE_STATUSES.paid);
  assert.equal(invoice.client.name, "Client B");
  assert.equal(invoice.lines[0].totalTTC, 240);
  assert.equal(invoice.localOnly, true);
});

test("validates invoice status without masking unknown status", () => {
  const invalid = validateInvoice({
    invoice_number: "",
    invoice_date: "",
    status: "lost",
    lines: [],
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes("invoiceNumber is required"));
  assert.ok(invalid.errors.includes("issueDate must use YYYY-MM-DD"));
  assert.ok(invalid.errors.includes("status is not allowed"));
});

test("normalizes reminders and notification preferences from current storage", () => {
  const reminder = assertPureNormalizer(normalizeReminder, {
    id: "rem-1",
    user_id: "user-1",
    reminder_type: "declaration",
    reminder_date: "2026-07-31",
    status: "pending",
    unknown_field: "kept",
  });
  const prefs = assertPureNormalizer(normalizeNotificationPreference, {
    sms: true,
    unknown_field: "kept",
  });

  assert.equal(reminder.userId, "user-1");
  assert.equal(reminder.date, "2026-07-31");
  assert.equal(prefs.declaration, true);
  assert.equal(prefs.sms, true);
});

test("normalizes deadlines, obligations and calculation results already emitted", () => {
  const deadline = assertPureNormalizer(normalizeDeadline, {
    type: "declaration",
    date: "2026-07-31",
    deadline_label: "31 juillet 2026",
    unknown_field: "kept",
  });
  const obligation = assertPureNormalizer(normalizeObligation, {
    next_declaration: "Déclaration mensuelle",
    deadline: "31 juillet 2026",
    unknown_field: "kept",
  });
  const calculation = assertPureNormalizer(normalizeCalculationResult, {
    estimatedAmount: "22",
    treasuryRecommended: "25",
    tvaThreshold: "36800",
    unknown_field: "kept",
  });

  assert.equal(deadline.date, "2026-07-31");
  assert.equal(obligation.nextDeclarationLabel, "Déclaration mensuelle");
  assert.equal(calculation.estimatedAmount, 22);
  assert.equal(calculation.currencyCode, "EUR");
});

test("keeps local date-only values stable across timezone conversion paths", () => {
  const revenue = normalizeRevenue({
    amount: 1,
    date: "2026-03-29",
  });
  const invoice = normalizeInvoice({
    invoice_number: "F-TZ",
    invoice_date: "2026-10-25",
  });

  assert.equal(revenue.date, "2026-03-29");
  assert.equal(invoice.issueDate, "2026-10-25");
});

test("normalizes incomplete historical structures defensively", () => {
  const revenue = normalizeRevenue({});
  const invoice = normalizeInvoice({});
  const profile = normalizeFiscalProfile({});

  assert.equal(revenue.amount, 0);
  assert.equal(revenue.date, null);
  assert.equal(invoice.invoiceNumber, null);
  assert.equal(profile.activityType, null);
});
