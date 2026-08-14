import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PLAYWRIGHT_CONFIG = readFileSync(
  new URL("../playwright.config.js", import.meta.url),
  "utf8",
);

test("LOT 5.16 keeps Playwright scoped to browser spec files only", () => {
  assert.match(PLAYWRIGHT_CONFIG, /testDir:\s*['"]\.\/tests['"]/);
  assert.match(PLAYWRIGHT_CONFIG, /testMatch:\s*['"]\*\*\/\*\.spec\.js['"]/);
  assert.doesNotMatch(PLAYWRIGHT_CONFIG, /testMatch:\s*['"].*\.test\.js/);
});

test("LOT 5.16 keeps the controlled Microassist webServer target", () => {
  assert.match(PLAYWRIGHT_CONFIG, /workers:\s*1/);
  assert.match(
    PLAYWRIGHT_CONFIG,
    /command:\s*['"]npm run dev -- --host 127\.0\.0\.1 --port 5174['"]/,
  );
  assert.match(PLAYWRIGHT_CONFIG, /url:\s*['"]http:\/\/127\.0\.0\.1:5174['"]/);
  assert.match(PLAYWRIGHT_CONFIG, /baseURL:\s*['"]http:\/\/127\.0\.0\.1:5174['"]/);
  assert.match(PLAYWRIGHT_CONFIG, /reuseExistingServer:\s*false/);
});
