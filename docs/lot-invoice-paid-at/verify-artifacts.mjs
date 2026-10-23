import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

// Read-only Git operations. Accept HEAD or a staged tree from git write-tree.
const ref = process.argv[2] || 'HEAD';
const path = 'supabase/migrations/20261022221124_add_invoice_paid_at_guarded.sql';
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const local = readFileSync(path);
const blob = execFileSync('git', ['show', `${ref}:${path}`]);
const tar = execFileSync('git', ['archive', '--format=tar', ref, '--', path]);
let archived;
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
  const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim() || '0', 8);
  if (name === path) archived = tar.subarray(offset + 512, offset + 512 + size);
  offset += 512 + Math.ceil(size / 512) * 512;
}
assert.ok(archived, 'SQL found in git archive');
assert.deepEqual(local, blob, 'worktree equals Git blob');
assert.deepEqual(local, archived, 'worktree equals extracted git archive SQL');
assert.equal(local.includes(13), false, 'LF only, no CR bytes');
assert.equal(local.at(-1), 10, 'final LF');
const run = JSON.parse(readFileSync('docs/lot-invoice-paid-at/results.json', 'utf8').replace(/^\uFEFF/, ''));
assert.equal(run.success, true);
assert.equal(run.cleanupVerified, true);
assert.equal(hash(local), run.hashes['migration.sql'], 'equals SQL copied and executed in disposable PostgreSQL');
const result = {
  success: true, path, bytes: local.length, lfOnly: true,
  worktreeSha256: hash(local), gitBlobSha256: hash(blob),
  gitArchiveSqlSha256: hash(archived), executedSqlSha256: run.hashes['migration.sql'],
};
writeFileSync('docs/lot-invoice-paid-at/artifact-integrity.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
