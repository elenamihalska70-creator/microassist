import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../src/App.jsx", import.meta.url),
  "utf8",
);
const EVIDENCE_SOURCE = readFileSync(
  new URL("../src/application/shadow/runtimeParityEvidence.js", import.meta.url),
  "utf8",
);

function extractShadowBlock(source) {
  const marker = "const shadowInput = buildFiscalSummaryInput";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);

  const end = source.indexOf("  }, [", start);
  assert.notEqual(end, -1);

  return source.slice(start, end);
}

function extractParityHelpers(source) {
  const start = source.indexOf("function createShadowParityCheck");
  assert.notEqual(start, -1);

  const end = source.indexOf("export function createRuntimeParityEvidence", start);
  assert.notEqual(end, -1);

  return source.slice(start, end);
}

test("shadow parity validation defines passive MATCH and MISMATCH statuses", () => {
  assert.match(EVIDENCE_SOURCE, /const SHADOW_PARITY_MATCH = "MATCH"/);
  assert.match(EVIDENCE_SOURCE, /const SHADOW_PARITY_MISMATCH = "MISMATCH"/);
});

test("shadow parity validation compares with strict identity only", () => {
  const helpers = extractParityHelpers(EVIDENCE_SOURCE);

  assert.match(helpers, /Object\.is\(legacyValue, shadowValue\)/);
  assert.doesNotMatch(helpers, /Math\.(round|floor|ceil|abs)/);
  assert.doesNotMatch(helpers, /Number\s*\(/);
  assert.doesNotMatch(helpers, /parseFloat\s*\(/);
  assert.doesNotMatch(helpers, /parseInt\s*\(/);
});

test("shadow parity validation reads only approved legacy and shadow values", () => {
  const helpers = extractParityHelpers(EVIDENCE_SOURCE);

  for (const field of [
    "revenue.total",
    "summary.baseAmount",
    "summary.finalContributionAmount",
    "summary.effectiveRate",
    "acre.status",
  ]) {
    assert.match(helpers, new RegExp(field.replace(".", "\\.")));
  }
});

test("shadow parity block executes Adapter, Facade and parity report without exposing results", () => {
  const block = extractShadowBlock(APP_SOURCE);

  assert.match(block, /buildFiscalSummaryInput\(/);
  assert.match(block, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(/);
  assert.match(block, /void shadowParityEvidence/);
  assert.match(block, /void shadowResult/);
});

test("shadow parity block does not mutate state, persistence, UI or payloads", () => {
  const block = extractShadowBlock(APP_SOURCE);

  assert.doesNotMatch(block, /\bset[A-Z]\w*\s*\(/);
  assert.doesNotMatch(block, /\blocalStorage\b/);
  assert.doesNotMatch(block, /\bsessionStorage\b/);
  assert.doesNotMatch(block, /\bsupabase\b/i);
  assert.doesNotMatch(block, /\bfetch\s*\(/);
  assert.doesNotMatch(block, /\bconsole\.(log|info|warn|error)\b/);
  assert.doesNotMatch(block, /\balert\s*\(/);
});

test("shadow parity block performs no comparison normalization or fallback", () => {
  const block = extractShadowBlock(APP_SOURCE);

  assert.doesNotMatch(block, /Math\.(round|floor|ceil|abs)/);
  assert.doesNotMatch(block, /\|\|\s*0\b/);
  assert.doesNotMatch(block, /\?\?\s*0\b/);
  assert.doesNotMatch(block, /toLocaleString/);
});
