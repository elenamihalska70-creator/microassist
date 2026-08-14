import test from "node:test";
import assert from "node:assert/strict";

import { calculateStandardContribution } from "../src/domain/calculations/contributions/index.js";
import { computeObligations } from "../src/utils/obligations.js";

function warningCodes(result) {
  return result.warnings.map((warning) => warning.code);
}

test("public contributions API exposes standard and aggregation functions", async () => {
  const module = await import("../src/domain/calculations/contributions/index.js");

  assert.deepEqual(Object.keys(module), [
    "calculateAnnualContributionTotal",
    "calculateContributionTotal",
    "calculateContributionTotalsByActivity",
    "calculateContributionsForPeriod",
    "calculateMonthlyContributionTotals",
    "calculateQuarterlyContributionTotals",
    "calculateStandardContribution",
  ]);
});

test("calculates a standard service contribution from the Rules Engine rate", () => {
  const result = calculateStandardContribution({
    baseAmount: 1000,
    activityType: "services",
  });

  assert.equal(result.contributionAmount, 220);
  assert.equal(result.rate, 0.22);
  assert.equal(result.ruleId, "CONTRIBUTION_RATE_SERVICES");
  assert.equal(result.rounding, "nearest_euro_math_round");
  assert.equal(result.calculable, true);
});

test("calculates a standard sale activity contribution from the commerce rule", () => {
  const result = calculateStandardContribution({
    baseAmount: 1000,
    activityType: "commerce",
  });

  assert.equal(result.contributionAmount, 123);
  assert.equal(result.rate, 0.123);
  assert.equal(result.ruleId, "CONTRIBUTION_RATE_COMMERCE");
  assert.equal(result.calculable, true);
});

test("base zero is calculable and returns zero", () => {
  const result = calculateStandardContribution({
    baseAmount: 0,
    activityType: "services",
  });

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.calculable, true);
  assert.equal(warningCodes(result).includes("INVALID_CONTRIBUTION_BASE"), false);
});

test("negative base is warned and not calculable by default", () => {
  const result = calculateStandardContribution({
    baseAmount: -100,
    activityType: "services",
  });

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.calculable, false);
  assert.ok(warningCodes(result).includes("NEGATIVE_CONTRIBUTION_BASE"));
});

test("negative base can be characterized with explicit legacy parity option", () => {
  const result = calculateStandardContribution(
    {
      baseAmount: -100,
      activityType: "services",
    },
    { allowNegativeBase: true },
  );
  const legacy = computeObligations({
    activity_type: "services",
    ca_month: -100,
    acre: "no",
  });

  assert.equal(result.contributionAmount, legacy.estimatedAmount);
  assert.equal(result.contributionAmount, -22);
  assert.equal(result.calculable, true);
});

test("unknown activity returns the Rules Engine fallback warning", () => {
  const result = calculateStandardContribution({
    baseAmount: 1000,
    activityType: "unknown",
  });

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.rate, 0);
  assert.equal(result.calculable, false);
  assert.equal(result.fallback, "unknown_activity_rate_zero");
  assert.ok(warningCodes(result).includes("UNKNOWN_ACTIVITY_TYPE"));
});

test("missing activity is warned and remains non calculable", () => {
  const result = calculateStandardContribution({
    baseAmount: 1000,
    activityType: null,
  });

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.calculable, false);
  assert.ok(warningCodes(result).includes("MISSING_ACTIVITY_TYPE"));
  assert.ok(warningCodes(result).includes("UNKNOWN_ACTIVITY_TYPE"));
});

test("missing rule returns a structured warning without inventing a rate", () => {
  const result = calculateStandardContribution(
    {
      baseAmount: 1000,
      activityType: "services",
    },
    {
      resolveContributionRule: () => null,
    },
  );

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.rate, 0);
  assert.equal(result.ruleId, null);
  assert.equal(result.calculable, false);
  assert.ok(warningCodes(result).includes("CONTRIBUTION_RULE_NOT_FOUND"));
});

test("invalid rate returns a structured warning without calculating", () => {
  const result = calculateStandardContribution(
    {
      baseAmount: 1000,
      activityType: "services",
    },
    {
      resolveContributionRule: () => ({
        ruleId: "TEST_INVALID_RATE",
        value: "bad",
        output: { rate: "bad" },
      }),
    },
  );

  assert.equal(result.contributionAmount, 0);
  assert.equal(result.rate, 0);
  assert.equal(result.calculable, false);
  assert.ok(warningCodes(result).includes("INVALID_CONTRIBUTION_RATE"));
});

test("warnings stay structured and free from UI payloads", () => {
  const result = calculateStandardContribution({
    baseAmount: "bad",
    activityType: "unknown",
  });

  assert.ok(result.warnings.length >= 1);

  for (const warning of result.warnings) {
    assert.equal(warning.domain, "contributions");
    assert.ok(["info", "warning", "error"].includes(warning.severity));
    assert.equal(JSON.stringify(warning).includes("€"), false);
    assert.equal(JSON.stringify(warning).includes("Client visible only in source"), false);
  }
});

test("invalid programming contracts throw", () => {
  assert.throws(() => calculateStandardContribution(null), TypeError);
  assert.throws(
    () =>
      calculateStandardContribution(
        { baseAmount: 1000, activityType: "services" },
        { resolveContributionRule: "bad" },
      ),
    TypeError,
  );
  assert.throws(
    () =>
      calculateStandardContribution(
        { baseAmount: 1000, activityType: "services" },
        { resolveContributionRule: () => "bad" },
      ),
    TypeError,
  );
});

test("does not mutate input, options or injected rule objects", () => {
  const input = Object.freeze({
    baseAmount: 1000,
    activityType: "services",
  });
  const rule = Object.freeze({
    ruleId: "TEST_RULE",
    value: 0.22,
    output: Object.freeze({ rate: 0.22 }),
    warnings: Object.freeze([]),
  });
  const options = Object.freeze({
    trace: true,
    resolveContributionRule: () => rule,
  });

  calculateStandardContribution(input, options);

  assert.deepEqual(input, {
    baseAmount: 1000,
    activityType: "services",
  });
  assert.deepEqual(options, {
    trace: true,
    resolveContributionRule: options.resolveContributionRule,
  });
  assert.deepEqual(rule, {
    ruleId: "TEST_RULE",
    value: 0.22,
    output: { rate: 0.22 },
    warnings: [],
  });
});

test("trace is deterministic and disabled by default", () => {
  const withoutTrace = calculateStandardContribution({
    baseAmount: 100.5,
    activityType: "services",
  });
  const withTrace = calculateStandardContribution(
    {
      baseAmount: 100.5,
      activityType: "services",
    },
    { trace: true },
  );

  assert.deepEqual(withoutTrace.trace, []);
  assert.deepEqual(
    withTrace.trace.map((step) => step.step),
    [
      "contributions.input.normalize",
      "contributions.rule.resolve",
      "contributions.amount.multiply",
      "contributions.amount.round",
    ],
  );
  assert.equal(withTrace.contributionAmount, 22);
});

test("calculation is deterministic for repeated identical input", () => {
  const input = {
    baseAmount: "100.5",
    activityType: "services",
  };

  assert.deepEqual(
    calculateStandardContribution(input),
    calculateStandardContribution(input),
  );
});

test("standard calculator matches historical standard computeObligations without ACRE", () => {
  const cases = [
    { baseAmount: 1000, activityType: "services" },
    { baseAmount: 1000, activityType: "commerce" },
    { baseAmount: 1000, activityType: "mixte" },
    { baseAmount: 1000, activityType: "unknown" },
    { baseAmount: 0, activityType: "services" },
    { baseAmount: 100.5, activityType: "services" },
  ];

  for (const input of cases) {
    const result = calculateStandardContribution(input);
    const legacy = computeObligations({
      activity_type: input.activityType,
      ca_month: input.baseAmount,
      acre: "no",
    });

    assert.equal(result.contributionAmount, legacy.estimatedAmount);
    assert.equal(result.rate, legacy.baseRate);
  }
});
