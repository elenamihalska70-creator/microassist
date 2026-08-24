import assert from "node:assert/strict";
import test from "node:test";

import { calculateStandardContribution } from "../src/domain/calculations/contributions/index.js";
import { calculateLegacyAcreContribution } from "../src/domain/calculations/acre/index.js";
import { computeObligations } from "../src/utils/obligations.js";

const REFERENCE_DATE = "2026-07-30";
// LOT 10.1B: owner-verified ACRE reform takes effect 2026-07-01. Tests in this
// file characterize the pre-reform (50%) cohort's mechanics unless noted
// otherwise, so they inject a business start date safely before that cutover.
const PRE_REFORM_BUSINESS_START = "2020-01-01";
const POST_REFORM_BUSINESS_START = "2026-07-01";

function standardContribution(input, options = {}) {
  return calculateStandardContribution(input, options);
}

function legacyAcre(input, context = {}, options = {}) {
  return calculateLegacyAcreContribution(
    standardContribution(input.standardInput, input.standardOptions),
    { referenceDate: REFERENCE_DATE, ...context },
    options,
  );
}

function warningCodes(result) {
  return result.warnings.map((warning) => warning.code);
}

test("exports only calculateLegacyAcreContribution from the ACRE calculation module", async () => {
  const module = await import("../src/domain/calculations/acre/index.js");

  assert.deepEqual(Object.keys(module), ["calculateLegacyAcreContribution"]);
});

test("applies active legacy ACRE for services without recalculating the standard result", () => {
  const standard = standardContribution({
    baseAmount: 1000,
    activityType: "services",
  });
  const result = calculateLegacyAcreContribution(standard, {
    acre: "yes",
    businessStartDate: PRE_REFORM_BUSINESS_START,
    referenceDate: REFERENCE_DATE,
  });
  const legacy = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    business_start_date: PRE_REFORM_BUSINESS_START,
  });

  assert.equal(result.standardContributionAmount, standard.contributionAmount);
  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
  assert.equal(result.acreRate, legacy.rate);
  assert.equal(result.acreApplied, true);
  assert.equal(result.acreStatus, "active");
});

test("applies active legacy ACRE for commerce activity", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "commerce" } },
    { acre: "yes", businessStartDate: PRE_REFORM_BUSINESS_START },
  );
  const legacy = computeObligations({
    ca_month: 1000,
    activity_type: "commerce",
    acre: "yes",
    business_start_date: PRE_REFORM_BUSINESS_START,
  });

  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
  assert.equal(result.acreRate, legacy.rate);
  assert.equal(result.acreApplied, true);
});

test("applies active legacy ACRE for mixed activity", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "mixte" } },
    { acre: "yes", businessStartDate: PRE_REFORM_BUSINESS_START },
  );
  const legacy = computeObligations({
    ca_month: 1000,
    activity_type: "mixte",
    acre: "yes",
    business_start_date: PRE_REFORM_BUSINESS_START,
  });

  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
  assert.equal(result.acreRate, legacy.rate);
  assert.equal(result.acreApplied, true);
});

test("does not apply ACRE when status is inactive", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    { acre: "no" },
  );
  const legacy = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "no",
  });

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
  assert.equal(result.savedAmount, 0);
  assert.ok(warningCodes(result).includes("ACRE_NOT_ACTIVE"));
});

test("keeps standard contribution for unknown ACRE status", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    { acre: "unknown" },
  );
  const legacy = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "unknown",
  });

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
  assert.ok(warningCodes(result).includes("UNKNOWN_ACRE_ELIGIBILITY"));
});

test("keeps standard contribution when ACRE status is missing", () => {
  const result = legacyAcre({
    standardInput: { baseAmount: 1000, activityType: "services" },
  });

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, result.standardContributionAmount);
  assert.ok(warningCodes(result).includes("MISSING_ACRE_CONTEXT"));
});

test("does not apply unconfirmed to_request or requested statuses", () => {
  for (const acre of ["to_request", "requested"]) {
    const result = legacyAcre(
      { standardInput: { baseAmount: 1000, activityType: "services" } },
      { acre },
    );

    assert.equal(result.acreApplied, false);
    assert.equal(result.acreContributionAmount, result.standardContributionAmount);
    assert.ok(warningCodes(result).includes("ACRE_STATUS_NOT_CONFIRMED"));
  }
});

test("reports an active period from an injected start and reference date", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    {
      acre: "yes",
      acreStartDate: "2026-07-30",
      businessStartDate: PRE_REFORM_BUSINESS_START,
    },
  );

  assert.equal(result.acreApplied, true);
  assert.equal(result.acreMonthsLeft, 12);
  assert.equal(result.acrePeriod.startDate, "2026-07-30");
  assert.equal(result.acrePeriod.endDate, "2027-07-30");
  assert.equal(result.acreStatus, "active");
});

test("reports an expired period after the legacy twelve-month boundary", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    {
      acre: "yes",
      acreStartDate: "2025-06-30",
      businessStartDate: PRE_REFORM_BUSINESS_START,
    },
  );

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, result.standardContributionAmount);
  assert.equal(result.acreStatus, "expired");
  assert.equal(result.acreMonthsLeft, 0);
  assert.ok(warningCodes(result).includes("ACRE_PERIOD_EXPIRED"));
});

test("keeps ACRE active on the month before the legacy expiry boundary", () => {
  const result = calculateLegacyAcreContribution(
    standardContribution({ baseAmount: 1000, activityType: "services" }),
    {
      acre: "yes",
      acreStartDate: "2025-07-30",
      businessStartDate: PRE_REFORM_BUSINESS_START,
      referenceDate: "2026-06-30",
    },
  );

  assert.equal(result.acreApplied, true);
  assert.equal(result.acreStatus, "active");
  assert.equal(result.acreMonthsLeft, 1);
});

test("expires ACRE exactly at the legacy twelve-month month boundary", () => {
  const result = calculateLegacyAcreContribution(
    standardContribution({ baseAmount: 1000, activityType: "services" }),
    {
      acre: "yes",
      acreStartDate: "2025-07-30",
      businessStartDate: PRE_REFORM_BUSINESS_START,
      referenceDate: "2026-07-30",
    },
  );

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreStatus, "expired");
  assert.equal(result.acreMonthsLeft, 0);
});

test("keeps zero base at zero with active ACRE", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 0, activityType: "services" } },
    { acre: "yes", businessStartDate: PRE_REFORM_BUSINESS_START },
  );

  assert.equal(result.standardContributionAmount, 0);
  assert.equal(result.acreContributionAmount, 0);
  assert.equal(result.savedAmount, 0);
  assert.equal(result.acreApplied, true);
});

test("characterizes negative base parity when the standard contribution allows it", () => {
  const standard = standardContribution(
    { baseAmount: -1000, activityType: "services" },
    { allowNegativeBase: true },
  );
  const result = calculateLegacyAcreContribution(standard, {
    acre: "yes",
    businessStartDate: PRE_REFORM_BUSINESS_START,
    referenceDate: REFERENCE_DATE,
  });
  const legacy = computeObligations({
    ca_month: -1000,
    activity_type: "services",
    acre: "yes",
    business_start_date: PRE_REFORM_BUSINESS_START,
  });

  assert.equal(result.acreApplied, true);
  assert.equal(result.acreContributionAmount, legacy.estimatedAmount);
});

test("warns but preserves legacy no-date behavior when start date is invalid", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    {
      acre: "yes",
      acreStartDate: "not-a-date",
      businessStartDate: PRE_REFORM_BUSINESS_START,
    },
  );
  const noDateLegacy = computeObligations({
    ca_month: 1000,
    activity_type: "services",
    acre: "yes",
    business_start_date: PRE_REFORM_BUSINESS_START,
  });

  assert.equal(result.acreApplied, true);
  assert.equal(result.acreContributionAmount, noDateLegacy.estimatedAmount);
  assert.equal(result.acrePeriod.startDate, null);
  assert.ok(warningCodes(result).includes("INVALID_ACRE_START_DATE"));
});

test("falls back to standard contribution when ACRE rule is absent", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    { acre: "yes" },
    { resolveAcreRule: () => null },
  );

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, result.standardContributionAmount);
  assert.ok(warningCodes(result).includes("ACRE_RULE_NOT_FOUND"));
});

test("falls back to standard contribution when ACRE rate is invalid", () => {
  const result = legacyAcre(
    { standardInput: { baseAmount: 1000, activityType: "services" } },
    { acre: "yes" },
    {
      resolveAcreRule: () => ({
        ruleId: "ACRE_INVALID_TEST_RULE",
        value: { reductionFactor: "invalid" },
        output: {
          acreActive: true,
          acreStatus: "active",
          acreMonthsLeft: null,
          acreEndDate: null,
          effectiveRate: "invalid",
        },
      }),
    },
  );

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, result.standardContributionAmount);
  assert.ok(warningCodes(result).includes("INVALID_ACRE_RATE"));
});

test("keeps contribution warnings and adds structured ACRE warnings without duplicates", () => {
  const standard = standardContribution({
    baseAmount: 1000,
    activityType: "unknown",
  });
  const result = calculateLegacyAcreContribution(standard, {
    acre: "yes",
    referenceDate: REFERENCE_DATE,
  });
  const codes = warningCodes(result);

  assert.ok(codes.includes("UNKNOWN_ACTIVITY_TYPE"));
  assert.ok(codes.includes("STANDARD_CONTRIBUTION_NOT_CALCULABLE"));
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(
    result.warnings.every(
      (warning) =>
        typeof warning.code === "string" &&
        typeof warning.severity === "string" &&
        typeof warning.domain === "string",
    ),
  );
});

test("keeps trace disabled by default and emits structured trace when enabled", () => {
  const standard = standardContribution({
    baseAmount: 1000,
    activityType: "services",
  });

  const withoutTrace = calculateLegacyAcreContribution(standard, {
    acre: "yes",
    businessStartDate: PRE_REFORM_BUSINESS_START,
    referenceDate: REFERENCE_DATE,
  });
  const withTrace = calculateLegacyAcreContribution(
    standard,
    {
      acre: "yes",
      businessStartDate: PRE_REFORM_BUSINESS_START,
      referenceDate: REFERENCE_DATE,
    },
    { trace: true },
  );

  assert.deepEqual(withoutTrace.trace, []);
  assert.deepEqual(
    withTrace.trace.map((step) => step.step),
    [
      "acre.input.normalize",
      "acre.standard.read",
      "acre.rule.resolve",
      "acre.period.evaluate",
      "acre.amount.calculate",
      "acre.amount.round",
      "acre.result.finalize",
    ],
  );
});

test("does not mutate the standard result, context, or options", () => {
  const standard = standardContribution({
    baseAmount: 1000,
    activityType: "services",
  });
  const context = {
    acre: "yes",
    acreStartDate: "2026-07-30",
    referenceDate: REFERENCE_DATE,
  };
  const options = { trace: true };
  const standardBefore = structuredClone(standard);
  const contextBefore = structuredClone(context);
  const optionsBefore = structuredClone(options);

  calculateLegacyAcreContribution(standard, context, options);

  assert.deepEqual(standard, standardBefore);
  assert.deepEqual(context, contextBefore);
  assert.deepEqual(options, optionsBefore);
});

test("is deterministic for the same standard result and injected ACRE context", () => {
  const standard = standardContribution({
    baseAmount: 1234,
    activityType: "commerce",
  });
  const context = {
    acre: "yes",
    acreStartDate: "2026-02-01",
    referenceDate: REFERENCE_DATE,
  };

  assert.deepEqual(
    calculateLegacyAcreContribution(standard, context),
    calculateLegacyAcreContribution(standard, context),
  );
});

test("requires a valid injected reference date and never falls back to an implicit date", () => {
  const result = calculateLegacyAcreContribution(
    standardContribution({ baseAmount: 1000, activityType: "services" }),
    { acre: "yes" },
  );

  assert.equal(result.acreApplied, false);
  assert.equal(result.acreContributionAmount, result.standardContributionAmount);
  assert.ok(warningCodes(result).includes("INVALID_ACRE_REFERENCE_DATE"));
});
