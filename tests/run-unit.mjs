// Unit test entry point (`npm run test:unit`). Runs every tests/*.test.{js,mjs}
// file one at a time with a per-test timeout, so a test waiting forever fails
// instead of blocking the whole run. Tests listed in
// tests/quarantine/source-shape.json are skipped by exact name inside their own
// file only; see tests/quarantine/README.md.
//
// Optional arguments restrict the run to the named files (targeted runs).
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import process from "node:process";

const TEST_TIMEOUT_MS = 30_000;
const testsDir = new URL("./", import.meta.url);
const quarantine = JSON.parse(
  await readFile(new URL("quarantine/source-shape.json", testsDir), "utf8"),
).files;
const requested = process.argv.slice(2);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const allFiles = (await readdir(testsDir)).filter((name) => /\.test\.m?js$/.test(name)).sort();
const files = requested.length ? allFiles.filter((name) => requested.includes(name)) : allFiles;
const problems = [
  ...requested.filter((name) => !allFiles.includes(name)).map((name) => `unknown test file: ${name}`),
  ...Object.keys(quarantine)
    .filter((name) => !allFiles.includes(name))
    .map((name) => `quarantine refers to a missing file: ${name}`),
];
const totals = { tests: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 };

// Name patterns drop matching tests from the report entirely, so the
// quarantined names are first run on their own to prove each one still exists.
async function namesMatchedBy(path, patterns) {
  const seen = new Set();
  const stream = run({ files: [path], timeout: TEST_TIMEOUT_MS, testNamePatterns: patterns });
  const record = (data) => {
    if (data.nesting === 0 && data.details?.type !== "suite") seen.add(data.name);
  };
  stream.on("test:pass", record);
  stream.on("test:fail", record);
  for await (const _ of stream);
  return seen;
}

for (const name of files) {
  const path = fileURLToPath(new URL(name, testsDir));
  const entries = quarantine[name] ?? [];
  const patterns = entries.map((entry) => new RegExp(`^${escapeRegExp(entry.name)}$`));
  if (entries.length) {
    const seen = await namesMatchedBy(path, patterns);
    for (const entry of entries) {
      if (!seen.has(entry.name)) problems.push(`${name}: quarantine entry matches no test: ${entry.name}`);
    }
  }
  const stream = run({ files: [path], timeout: TEST_TIMEOUT_MS, testSkipPatterns: patterns });
  stream.on("test:summary", (data) => {
    if (data.file !== undefined) return;
    for (const key of Object.keys(totals)) totals[key] += data.counts[key] ?? 0;
  });
  for await (const chunk of stream.compose(spec)) process.stdout.write(chunk);
}

const quarantined = files.reduce((count, name) => count + (quarantine[name]?.length ?? 0), 0);
console.log(
  `\nunit: ${files.length} files, ${totals.tests} tests, ${totals.passed} passed, ` +
    `${totals.failed} failed, ${totals.cancelled} cancelled, ${totals.skipped} skipped, ` +
    `${totals.todo} todo; ${quarantined} quarantined tests not run`,
);
for (const problem of problems) console.error(`unit: ${problem}`);
process.exitCode = totals.failed || totals.cancelled || problems.length ? 1 : 0;
