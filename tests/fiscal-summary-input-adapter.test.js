import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";

const VALID_INPUT = Object.freeze({
  revenues: Object.freeze([
    Object.freeze({
      id: "r1",
      amount: "1200",
      date: "2026-07-01",
      revenue_category: "service",
      client: "Client A",
    }),
  ]),
  fiscalProfile: Object.freeze({
    activity_type: "services",
    acre: "yes",
    acre_start_date: "2026-01-01",
  }),
  period: Object.freeze({
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  }),
  referenceDate: "2026-07-30",
});

function stripImportsCommentsAndStrings(source) {
  return source
    .replace(/import[\s\S]*?;\n/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:\\.|[^"\\])*"/g, "")
    .replace(/'(?:\\.|[^'\\])*'/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "");
}

function clone(value) {
  return structuredClone(value);
}

test("maps a complete application DTO to the Facade input contract", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.deepEqual(result, {
    revenues: [
      {
        id: "r1",
        amount: "1200",
        date: "2026-07-01",
        revenue_category: "service",
        client: "Client A",
      },
    ],
    fiscalProfile: {
      activityType: "services",
      acre: "yes",
      acreStartDate: "2026-01-01",
    },
    period: {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    },
    referenceDate: "2026-07-30",
  });
});

test("maps a minimal valid application DTO without deriving values", () => {
  const input = {
    revenues: [],
    fiscalProfile: {
      activity_type: undefined,
      acre: undefined,
      acre_start_date: undefined,
    },
    period: {},
    referenceDate: undefined,
  };

  assert.deepEqual(buildFiscalSummaryInput(input), {
    revenues: [],
    fiscalProfile: {
      activityType: undefined,
      acre: undefined,
      acreStartDate: undefined,
    },
    period: {},
    referenceDate: undefined,
  });
});

test("returns the exact Facade input top-level structure", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.deepEqual(Object.keys(result), [
    "revenues",
    "fiscalProfile",
    "period",
    "referenceDate",
  ]);
});

test("does not add UI, persistence, warning, trace or summary fields", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.equal(Object.hasOwn(result, "warnings"), false);
  assert.equal(Object.hasOwn(result, "trace"), false);
  assert.equal(Object.hasOwn(result, "summary"), false);
  assert.equal(Object.hasOwn(result, "computed"), false);
  assert.equal(Object.hasOwn(result, "localStorage"), false);
});

test("renames only the approved fiscal profile properties", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.deepEqual(Object.keys(result.fiscalProfile), [
    "activityType",
    "acre",
    "acreStartDate",
  ]);
});

test("does not accept adapter options because LOT 5.3 approved a reduced DTO signature", () => {
  assert.throws(
    () => buildFiscalSummaryInput(VALID_INPUT, { trace: true }),
    /does not accept options/,
  );
});

test("accepts absence of options", () => {
  assert.doesNotThrow(() => buildFiscalSummaryInput(VALID_INPUT));
});

test("rejects absent input", () => {
  assert.throws(
    () => buildFiscalSummaryInput(),
    /expects an input object/,
  );
});

test("rejects non-object input", () => {
  for (const value of [null, "input", [], true]) {
    assert.throws(
      () => buildFiscalSummaryInput(value),
      /expects an input object/,
    );
  }
});

test("rejects missing required top-level fields", () => {
  for (const field of ["revenues", "fiscalProfile", "period", "referenceDate"]) {
    const input = clone(VALID_INPUT);
    delete input[field];

    assert.throws(
      () => buildFiscalSummaryInput(input),
      /input is missing required fields/,
    );
  }
});

test("rejects unknown top-level fields", () => {
  assert.throws(
    () => buildFiscalSummaryInput({ ...clone(VALID_INPUT), appState: {} }),
    /input contains unknown fields/,
  );
});

test("rejects unknown option-like second argument", () => {
  assert.throws(
    () => buildFiscalSummaryInput(VALID_INPUT, { unknown: true }),
    /does not accept options/,
  );
});

test("rejects invalid structural field types", () => {
  assert.throws(
    () => buildFiscalSummaryInput({ ...clone(VALID_INPUT), revenues: {} }),
    /revenues must be an array/,
  );
  assert.throws(
    () => buildFiscalSummaryInput({ ...clone(VALID_INPUT), fiscalProfile: [] }),
    /fiscalProfile must be an object/,
  );
  assert.throws(
    () => buildFiscalSummaryInput({ ...clone(VALID_INPUT), period: [] }),
    /period must be an object/,
  );
});

test("copies the revenues array and revenue entry containers", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.notEqual(result.revenues, VALID_INPUT.revenues);
  assert.notEqual(result.revenues[0], VALID_INPUT.revenues[0]);
  assert.deepEqual(result.revenues[0], VALID_INPUT.revenues[0]);
});

test("copies fiscalProfile and period containers", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.notEqual(result.fiscalProfile, VALID_INPUT.fiscalProfile);
  assert.notEqual(result.period, VALID_INPUT.period);
});

test("does not mutate the input object or mapped nested containers", () => {
  const input = clone(VALID_INPUT);
  const before = clone(input);

  buildFiscalSummaryInput(input);

  assert.deepEqual(input, before);
});

test("does not mutate attempted options", () => {
  const options = { trace: true };
  const before = clone(options);

  assert.throws(() => buildFiscalSummaryInput(VALID_INPUT, options));
  assert.deepEqual(options, before);
});

test("is deterministic for identical inputs", () => {
  const first = buildFiscalSummaryInput(VALID_INPUT);
  const second = buildFiscalSummaryInput(VALID_INPUT);

  assert.deepEqual(first, second);
});

test("requires injected dates without creating implicit dates", () => {
  assert.equal(buildFiscalSummaryInput(VALID_INPUT).referenceDate, "2026-07-30");
});

test("has no persistence access in the adapter source", () => {
  const source = readFileSync(
    new URL(
      "../src/application/adapters/buildFiscalSummaryInput.js",
      import.meta.url,
    ),
    "utf8",
  );
  const executableSource = stripImportsCommentsAndStrings(source);

  assert.equal(/\blocalStorage\b/.test(executableSource), false);
  assert.equal(/\bsessionStorage\b/.test(executableSource), false);
  assert.equal(/\bindexedDB\b/.test(executableSource), false);
  assert.equal(/\bsupabase\b/i.test(executableSource), false);
  assert.equal(/\bfetch\s*\(/.test(executableSource), false);
});

test("has no React or UI dependency in the adapter source", () => {
  const source = readFileSync(
    new URL(
      "../src/application/adapters/buildFiscalSummaryInput.js",
      import.meta.url,
    ),
    "utf8",
  );
  const executableSource = stripImportsCommentsAndStrings(source);

  assert.equal(/\buse(State|Effect|Memo|Context)\b/.test(executableSource), false);
  assert.equal(/\bReact\b/.test(executableSource), false);
  assert.equal(/\bJSX\b/.test(executableSource), false);
  assert.equal(/\bwindow\b/.test(executableSource), false);
  assert.equal(/\bdocument\b/.test(executableSource), false);
});

test("returns a structure accepted by the Facade top-level contract", () => {
  const result = buildFiscalSummaryInput(VALID_INPUT);

  assert.deepEqual(Object.keys(result), [
    "revenues",
    "fiscalProfile",
    "period",
    "referenceDate",
  ]);
  assert.equal(Array.isArray(result.revenues), true);
  assert.equal(typeof result.fiscalProfile, "object");
  assert.equal(typeof result.period, "object");
  assert.equal(Object.hasOwn(result, "referenceDate"), true);
});

test("uses explicit assignments and is resistant to prototype-pollution field names", () => {
  const input = clone(VALID_INPUT);
  input.__proto__ = { polluted: true };
  input.fiscalProfile.__proto__ = { pollutedProfile: true };

  const result = buildFiscalSummaryInput(input);

  assert.equal(Object.hasOwn(result, "polluted"), false);
  assert.equal(Object.hasOwn(result.fiscalProfile, "pollutedProfile"), false);
});

test("architectural guard: adapter source contains no business calculation", () => {
  const source = readFileSync(
    new URL(
      "../src/application/adapters/buildFiscalSummaryInput.js",
      import.meta.url,
    ),
    "utf8",
  );
  const executableSource = stripImportsCommentsAndStrings(source);

  assert.equal(/\bMath\.(round|floor|ceil)\b/.test(executableSource), false);
  assert.equal(/\bDate\.now\b/.test(executableSource), false);
  assert.equal(/\bnew\s+Date\b/.test(executableSource), false);
  assert.equal(/\bgetContributionRule\b/.test(executableSource), false);
  assert.equal(/\bcalculateFiscalSummary\b/.test(executableSource), false);
  assert.equal(/\bcalculateRevenue\w*\b/.test(executableSource), false);
  assert.equal(/\bcalculate\w*Contribution\b/.test(executableSource), false);
  assert.equal(/\bcalculateLegacyAcreContribution\b/.test(executableSource), false);
  assert.equal(/\bparseFloat\s*\(/.test(executableSource), false);
  assert.equal(/\bparseInt\s*\(/.test(executableSource), false);
  assert.equal(/\bNumber\s*\(/.test(executableSource), false);
  assert.equal(/\bswitch\s*\(/.test(executableSource), false);
  assert.equal(/\|\|\s*0\b/.test(executableSource), false);
  assert.equal(/\?\?\s*0\b/.test(executableSource), false);
  assert.equal(/\bactivity_type\s*===/.test(executableSource), false);
  assert.equal(/\bactivityType\s*===/.test(executableSource), false);
});
