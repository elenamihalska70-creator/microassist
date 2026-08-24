import test from "node:test";
import assert from "node:assert/strict";

import {
  ACRE_POST_REFORM_REDUCTION_FACTOR,
  ACRE_PRE_REFORM_REDUCTION_FACTOR,
  ACRE_REFORM_EFFECTIVE_DATE,
  CURRENT_RULE_SET,
  getAcreRule,
  getApplicableRuleSet,
  getContributionRule,
  getDeadlineRule,
  getInvoiceRule,
  getPremiumRule,
  getPremiumTriggerRule,
  getRevenueContributionRule,
  getSimpleAssistantVatRule,
  getTrialDaysLeftRule,
  getVatRule,
} from "../src/domain/index.js";
import { computeObligations } from "../src/utils/obligations.js";

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthsAgo(monthCount) {
  const today = new Date();
  const date = new Date(today);
  date.setMonth(date.getMonth() - monthCount);
  return dateOnly(date);
}

test("exposes a versioned current rule set", () => {
  const ruleSet = getApplicableRuleSet();

  assert.equal(ruleSet.ruleSetId, "microassist-current-baseline");
  assert.equal(ruleSet.version, CURRENT_RULE_SET.version);
  assert.equal(ruleSet.status, "technical_baseline_unverified");
  assert.equal(ruleSet.effectiveFrom, "2026-07-29");
});

test("contribution rules match current computeObligations base rates", () => {
  const cases = [
    ["services", 0.22],
    ["commerce", 0.123],
    ["mixte", 0.18],
    ["unknown", 0],
    [null, 0],
  ];

  for (const [activityType, expectedRate] of cases) {
    const rule = getContributionRule({ activityType });
    const computed = computeObligations({
      activity_type: activityType,
      ca_month: 1000,
      acre: "no",
    });

    assert.equal(rule.value, expectedRate);
    assert.equal(rule.output.rate, computed.baseRate);
    assert.equal(rule.version, CURRENT_RULE_SET.version);
    assert.ok(rule.ruleId);
  }
});

test("revenue contribution rules preserve category fallbacks", () => {
  assert.equal(getRevenueContributionRule({ category: "vente" }).value, 0.123);
  assert.equal(getRevenueContributionRule({ category: "service" }).value, 0.22);
  assert.equal(
    getRevenueContributionRule({ category: "", activityType: "mixte" }).value,
    0.18,
  );
});

test("ACRE rules match current behavior for active, expired and missing date", () => {
  const activeStart = monthsAgo(2);
  const expiredStart = monthsAgo(13);
  const preReformBusinessStart = "2020-01-01";

  const activeRule = getAcreRule({
    acre: "yes",
    acreStartDate: activeStart,
    businessStartDate: preReformBusinessStart,
    activityType: "services",
  });
  const activeComputed = computeObligations({
    acre: "yes",
    acre_start_date: activeStart,
    business_start_date: preReformBusinessStart,
    activity_type: "services",
    ca_month: 1000,
  });

  assert.equal(activeRule.output.acreActive, activeComputed.acreActive);
  assert.equal(activeRule.output.effectiveRate, activeComputed.rate);
  assert.equal(activeRule.output.acreStatus, activeComputed.acreStatus);

  const expiredRule = getAcreRule({
    acre: "yes",
    acreStartDate: expiredStart,
    businessStartDate: preReformBusinessStart,
    activityType: "services",
  });
  const expiredComputed = computeObligations({
    acre: "yes",
    acre_start_date: expiredStart,
    business_start_date: preReformBusinessStart,
    activity_type: "services",
    ca_month: 1000,
  });

  assert.equal(expiredRule.output.acreActive, expiredComputed.acreActive);
  assert.equal(expiredRule.output.effectiveRate, expiredComputed.rate);
  assert.equal(expiredRule.output.acreStatus, expiredComputed.acreStatus);

  const missingDateRule = getAcreRule({
    acre: "yes",
    activityType: "services",
  });
  const missingDateComputed = computeObligations({
    acre: "yes",
    activity_type: "services",
    ca_month: 1000,
  });

  assert.equal(missingDateRule.output.acreActive, false);
  assert.equal(missingDateRule.output.acreStatus, "regime_unknown");
  assert.equal(missingDateRule.output.effectiveRate, 0.22);
  assert.equal(missingDateRule.fallback, "acre_regime_unknown_missing_business_start_date");
  assert.equal(missingDateComputed.acreStatus, "regime_unknown");
  assert.equal(missingDateComputed.rate, 0.22);
});

test("ACRE reform applies the owner-verified 50%/75% split around 2026-07-01", () => {
  assert.equal(ACRE_REFORM_EFFECTIVE_DATE, "2026-07-01");
  assert.equal(ACRE_PRE_REFORM_REDUCTION_FACTOR, 0.5);
  assert.equal(ACRE_POST_REFORM_REDUCTION_FACTOR, 0.25);

  const preReform = getAcreRule({
    acre: "yes",
    acreStartDate: "2026-07-15",
    businessStartDate: "2026-06-30",
    activityType: "services",
    today: new Date("2026-07-15T12:00:00"),
  });
  const postReformExact = getAcreRule({
    acre: "yes",
    acreStartDate: "2026-07-15",
    businessStartDate: "2026-07-01",
    activityType: "services",
    today: new Date("2026-07-15T12:00:00"),
  });
  const postReformLater = getAcreRule({
    acre: "yes",
    acreStartDate: "2026-08-01",
    businessStartDate: "2026-08-01",
    activityType: "services",
    today: new Date("2026-08-01T12:00:00"),
  });

  assert.equal(preReform.output.regime, "pre_reform");
  assert.equal(preReform.output.effectiveRate, 0.11);

  assert.equal(postReformExact.output.regime, "post_reform_2026_07");
  assert.equal(postReformExact.output.effectiveRate, 0.165);

  assert.equal(postReformLater.output.regime, "post_reform_2026_07");
  assert.equal(postReformLater.output.effectiveRate, 0.165);
});

test("ACRE regime is never guessed when businessStartDate is missing or invalid", () => {
  const missing = getAcreRule({ acre: "yes", activityType: "services" });
  const invalid = getAcreRule({
    acre: "yes",
    businessStartDate: "not-a-date",
    activityType: "services",
  });
  const blank = getAcreRule({
    acre: "yes",
    businessStartDate: "",
    activityType: "services",
  });

  for (const result of [missing, invalid, blank]) {
    assert.equal(result.output.acreActive, false);
    assert.equal(result.output.acreStatus, "regime_unknown");
    assert.equal(result.output.effectiveRate, 0.22);
    assert.equal(result.output.regime, null);
  }

  assert.equal(missing.fallback, "acre_regime_unknown_missing_business_start_date");
  assert.equal(invalid.fallback, "acre_regime_unknown_invalid_business_start_date");
  assert.equal(blank.fallback, "acre_regime_unknown_missing_business_start_date");
});

test("ACRE boundary dates are deterministic with injected today", () => {
  const today = new Date("2026-07-29T12:00:00");
  const preReformBusinessStart = "2020-01-01";

  assert.equal(
    getAcreRule({
      acre: "yes",
      acreStartDate: "2026-07-29",
      businessStartDate: preReformBusinessStart,
      activityType: "services",
      today,
    }).output.acreMonthsLeft,
    12,
  );
  assert.equal(
    getAcreRule({
      acre: "yes",
      acreStartDate: "2025-07-29",
      businessStartDate: preReformBusinessStart,
      activityType: "services",
      today,
    }).output.acreStatus,
    "expired",
  );
  assert.equal(
    getAcreRule({
      acre: "unknown",
      activityType: "services",
      today,
    }).output.effectiveRate,
    0.22,
  );
});

test("VAT rules match current computeObligations thresholds and statuses", () => {
  const cases = [
    ["services", 1000, "ok", 36800],
    ["services", 2500, "soon", 36800],
    ["services", 4000, "exceeded", 36800],
    ["commerce", 7000, "soon", 91900],
    ["commerce", 8000, "exceeded", 91900],
    ["mixte", 4000, "exceeded", 36800],
    ["unknown", 4000, "ok", 0],
  ];

  for (const [activityType, caMonth, expectedStatus, expectedThreshold] of cases) {
    const rule = getVatRule({ activityType, monthlyRevenue: caMonth });
    const computed = computeObligations({
      activity_type: activityType,
      ca_month: caMonth,
      acre: "no",
    });

    assert.equal(rule.output.vatStatus, expectedStatus);
    assert.equal(rule.output.threshold, expectedThreshold);
    assert.equal(rule.output.vatStatus, computed.tvaStatus);
    assert.equal(rule.output.threshold, computed.tvaThreshold);
  }
});

test("VAT projection keeps YTD average and single-month fallbacks", () => {
  const averageRule = getVatRule({
    activityType: "services",
    monthlyRevenue: 100,
    yearToDateRevenue: 9000,
    monthsWithData: 3,
  });
  const averageComputed = computeObligations({
    activity_type: "services",
    ca_month: 100,
    ca_ytd: 9000,
    months_with_data: 3,
  });

  assert.equal(averageRule.output.projectedRevenue, averageComputed.caAnnuel);
  assert.equal(averageRule.output.projectionMode, "moyenne");

  const fallbackRule = getVatRule({
    activityType: "services",
    monthlyRevenue: 100,
    yearToDateRevenue: 9000,
    monthsWithData: 1,
  });

  assert.equal(fallbackRule.output.projectedRevenue, 1200);
  assert.equal(fallbackRule.output.projectionMode, "estimation");
});

test("simple assistant VAT duplicate rule is documented without changing main VAT rule", () => {
  const rule = getSimpleAssistantVatRule({
    monthlyRevenue: 31000,
    tvaStatus: "franchise",
  });

  assert.equal(rule.output.status, "soon");
  assert.equal(rule.output.tone, "warning");
  assert.ok(rule.warnings.some((warning) => warning.includes("Duplication")));
});

test("deadline rules match current monthly and quarterly behavior", () => {
  const computedMonthly = computeObligations({
    declaration_frequency: "mensuel",
    activity_type: "services",
  });
  const ruleMonthly = getDeadlineRule({
    frequency: "mensuel",
    today: new Date(),
  });

  assert.equal(dateOnly(ruleMonthly.output.deadlineDate), dateOnly(computedMonthly.deadlineDate));
  assert.equal(ruleMonthly.output.nextDeclaration, computedMonthly.nextDeclaration);

  const computedQuarterly = computeObligations({
    declaration_frequency: "trimestriel",
    activity_type: "services",
  });
  const ruleQuarterly = getDeadlineRule({
    frequency: "trimestriel",
    today: new Date(),
  });

  assert.equal(dateOnly(ruleQuarterly.output.deadlineDate), dateOnly(computedQuarterly.deadlineDate));
  assert.equal(ruleQuarterly.output.nextDeclaration, computedQuarterly.nextDeclaration);
});

test("deadline edge cases cover year rollover, February and end of month", () => {
  assert.equal(
    dateOnly(getDeadlineRule({
      frequency: "mensuel",
      today: new Date("2026-01-31T12:00:00"),
    }).output.deadlineDate),
    "2026-02-28",
  );
  assert.equal(
    dateOnly(getDeadlineRule({
      frequency: "mensuel",
      today: new Date("2028-01-31T12:00:00"),
    }).output.deadlineDate),
    "2028-02-29",
  );
  assert.equal(
    dateOnly(getDeadlineRule({
      frequency: "trimestriel",
      today: new Date("2026-12-15T12:00:00"),
    }).output.deadlineDate),
    "2027-01-31",
  );
  assert.equal(
    getDeadlineRule({ frequency: "", today: new Date("2026-07-29T12:00:00") })
      .output.deadlineDate,
    null,
  );
});

test("invoice rules preserve statuses, VAT mode and no automatic revenue", () => {
  const paidRule = getInvoiceRule({
    status: "paid",
    vatMode: "standard",
    invoice: { status: "paid", localOnly: true, formatStatus: "facturx_ready_draft" },
  });

  assert.equal(paidRule.output.isKnownStatus, true);
  assert.equal(paidRule.output.paymentStatus, "paid");
  assert.equal(paidRule.output.vatRate, 20);
  assert.equal(paidRule.output.isLocalOnly, true);
  assert.equal(paidRule.output.isFacturXDraft, true);
  assert.equal(paidRule.output.createsRevenueAutomatically, false);

  const invalidRule = getInvoiceRule({ status: "sent", vatMode: "exempt" });

  assert.equal(invalidRule.output.isKnownStatus, false);
  assert.equal(invalidRule.fallback, "unknown_invoice_status");
  assert.equal(invalidRule.output.vatRate, 0);
});

test("premium rules preserve access matrix and triggers", () => {
  const guestRule = getPremiumRule({ isGuest: true });
  assert.equal(guestRule.output.accessProfile, "guest");
  assert.equal(guestRule.output.features.local_usage, true);

  const premiumRule = getPremiumRule({
    isGuest: false,
    isPremiumUser: true,
    billingUiState: "premium_active",
  });
  assert.equal(premiumRule.output.accessProfile, "premium_active");
  assert.equal(premiumRule.output.features.pricing_cta, false);

  assert.equal(
    getPremiumTriggerRule({
      isPremium: false,
      trialDaysLeft: 7,
      daysBeforeDeadline: 30,
      revenuesCount: 0,
      lastActivityDays: 0,
    }).output.trigger,
    "trial_ending",
  );
  assert.equal(
    getPremiumTriggerRule({
      isPremium: false,
      trialDaysLeft: null,
      daysBeforeDeadline: 7,
      revenuesCount: 0,
      lastActivityDays: 0,
    }).output.trigger,
    "deadline_soon",
  );
  assert.equal(
    getPremiumTriggerRule({
      isPremium: true,
      trialDaysLeft: 7,
      daysBeforeDeadline: 7,
      revenuesCount: 3,
      lastActivityDays: 7,
    }).output.trigger,
    null,
  );
});

test("trial days left rule is pure with injected date", () => {
  const rule = getTrialDaysLeftRule({
    trialEndsAt: "2026-08-05T00:00:00.000Z",
    today: new Date("2026-07-29T00:00:00.000Z"),
  });

  assert.equal(rule.output.daysLeft, 7);
  assert.equal(rule.output.isExpired, false);

  const expired = getTrialDaysLeftRule({
    trialEndsAt: "2026-07-29T00:00:00.000Z",
    today: new Date("2026-07-29T00:00:00.000Z"),
  });

  assert.equal(expired.output.daysLeft, 0);
  assert.equal(expired.output.isExpired, true);
});

test("rules tolerate null and incomplete historical data", () => {
  assert.equal(getContributionRule(null).value, 0);
  assert.equal(getVatRule(null).output.threshold, 0);
  assert.equal(getAcreRule(null).output.acreStatus, "inactive");
  assert.equal(getDeadlineRule(null).output.deadlineDate, null);
  assert.equal(getInvoiceRule(null).output.paymentStatus, "unpaid");
  assert.equal(getPremiumRule(null).output.accessProfile, "registered_free");
});
