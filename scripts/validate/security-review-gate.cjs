#!/usr/bin/env node
// security-review-gate.cjs — review-before-merge gate for security-sensitive PRs.
//
// Policy: a pull request that touches a security-sensitive surface must carry a
// RECORDED reviewer verdict — an approving GitHub review OR one of the
// SEC_REVIEW_LABELS — before it merges. PRs that do not touch such a surface
// pass immediately, so this check is safe to require on every PR.
//
//   --pr <N>        Inspect PR #N via `gh` (files + labels + reviewDecision).
//   --repo <o/r>    Target repo for --pr; defaults to the repo inferred from
//                   the current directory.
//   --diff <base>   Offline: classify the current branch's changed files vs
//                   <base> (git only; cannot see review state).
//   (default)       --diff origin/test.
//
// Exit 0 = clear to merge (not security-sensitive, OR verdict recorded).
// Exit 1 = HOLD (security-sensitive, no recorded verdict).
//
// Dependency-free (Node built-ins + the gh CLI) so the CI job needs no package
// install. No regex — substring matching + Set (repo no-regex posture).

'use strict';

const { execFileSync } = require('child_process');

// A changed file is security-sensitive if its path contains ANY of these
// substrings. Deliberately broad — money, identity, credential, code-exec,
// and stored-content surfaces.
const SECURITY_PATHS = [
  'middleware/auth',
  'middleware/license',
  'middleware/entitlements',
  'middleware/tenant',
  'middleware/authorization',
  'routes/webhooks',
  'routes/license',
  'routes/terminal',
  'routes/billing',
  'lib/billing-status',
  'lib/access',
  'lib/validate-startup',
  'packages/security/',
  'packages/auth/',
  'access/roles',
  'proxy.ts',
  'collections/operations',
  'license-crypto',
  'signing',
  'webhooks.ts',
  'routes/agent-stream',
  'routes/agent-tasks',
  'packages/mcp/',
  'remote-client',
  'routes/auth',
  'routes/api-keys',
  'api/auth/',
  'richtext',
  'sanitize',
  'RichText/',
  'content-validation',
];

// A recorded reviewer verdict = an approving GH review OR one of these labels.
const SEC_REVIEW_LABELS = new Set([
  'sec-review:approved',
  'security-reviewed',
  'coordinator-approved',
]);

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 15000 });
}

function classifyFiles(files) {
  const hits = [];
  for (const f of files) {
    for (const marker of SECURITY_PATHS) {
      if (f.includes(marker)) {
        hits.push(f);
        break;
      }
    }
  }
  return hits;
}

function runPrMode(prNumber, repo) {
  let raw;
  const ghArgs = ['pr', 'view', prNumber, '--json', 'files,labels,reviewDecision,title'];
  if (repo) ghArgs.push('-R', repo);
  try {
    raw = gh(ghArgs);
  } catch (err) {
    process.stderr.write(
      `security-review-gate: gh failed for PR ${prNumber} (${err instanceof Error ? err.message : 'unknown'}). ` +
        `Cannot verify review state — treating as HOLD.\n`,
    );
    process.exit(1);
  }
  const data = JSON.parse(raw);
  const files = (data.files || []).map((f) => f.path);
  const hits = classifyFiles(files);

  if (hits.length === 0) {
    process.stdout.write(
      `PR #${prNumber}: no security-sensitive files touched — no review gate.\n`,
    );
    process.exit(0);
  }

  const labels = new Set((data.labels || []).map((l) => l.name));
  const hasReviewLabel = [...labels].some((l) => SEC_REVIEW_LABELS.has(l));
  const approved = data.reviewDecision === 'APPROVED';

  if (approved || hasReviewLabel) {
    process.stdout.write(
      `PR #${prNumber} is security-sensitive AND carries a recorded verdict ` +
        `(${approved ? 'approving review' : 'review label'}) — clear to merge.\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `HOLD — PR #${prNumber} touches a security-sensitive surface with NO recorded reviewer verdict.\n` +
      `   Touched: ${[...new Set(hits)].join(', ')}\n` +
      `   Required before merge: an approving review OR a "${[...SEC_REVIEW_LABELS][0]}" label.\n`,
  );
  process.exit(1);
}

function runDiffMode(base) {
  let out;
  try {
    out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch (err) {
    process.stderr.write(
      `security-review-gate: git diff vs ${base} failed (${err instanceof Error ? err.message : 'unknown'}).\n`,
    );
    process.exit(2);
  }
  const files = out.split('\n').filter(Boolean);
  const hits = classifyFiles(files);
  if (hits.length === 0) {
    process.stdout.write(
      `Current branch vs ${base}: no security-sensitive files — no review gate.\n`,
    );
    process.exit(0);
  }
  process.stderr.write(
    `Current branch is SECURITY-SENSITIVE (vs ${base}). Touched: ${[...new Set(hits)].join(', ')}\n` +
      `   The PR will need a recorded reviewer verdict before merge.\n`,
  );
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  const repoIdx = argv.indexOf('--repo');
  const repo = repoIdx !== -1 ? argv[repoIdx + 1] || '' : '';
  const prIdx = argv.indexOf('--pr');
  if (prIdx !== -1) {
    runPrMode(argv[prIdx + 1] || '', repo);
    return;
  }
  const diffIdx = argv.indexOf('--diff');
  const base = diffIdx !== -1 ? argv[diffIdx + 1] || 'origin/test' : 'origin/test';
  runDiffMode(base);
}

main();
