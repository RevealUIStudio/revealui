#!/usr/bin/env node
// security-review-gate.cjs — review-before-merge gate for security-sensitive PRs.
//
// Policy: a pull request that touches a security-sensitive surface must carry a
// RECORDED reviewer verdict — an approving GitHub review OR one of the
// SEC_REVIEW_LABELS — before it merges. PRs that do not touch such a surface
// pass immediately, so this check is safe to require on every PR.
//
// A live guardrail-2 REQUEST-CHANGES verdict OVERRIDES the label. Verdicts are
// posted as comments/reviews carrying a machine-parseable marker
// (`<!-- guardrail2-verdict: REQUEST-CHANGES -->` / `... APPROVE -->`); the shared
// guardrail2-verdict.cjs parser decides hold/clear. This closes the revealui#1910
// miss, where sec-review:approved was applied against an outstanding REQUEST-CHANGES
// and the gate — which only checked the label — cleared it anyway.
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
const { evaluateGuardrail2 } = require('./guardrail2-verdict.cjs');

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
  // Agent-payment + marketplace money surfaces. Added after an internal
  // review found the x402 payment-verification path was not listed: a PR
  // moving the verifier passed this gate unflagged and had to self-declare
  // its review hold in the PR body.
  'middleware/x402',
  'packages/paywall/',
  'routes/a2a',
  'routes/marketplace',
  'routes/revmarket',
  // Electric shape + sync routes (GAP-349): the shape-route template
  // (apps/admin/src/lib/api/electric-proxy.ts) authenticates + row-filters
  // before proxying to Electric, and sync mutation endpoints are the
  // write-through path Electric itself never touches. Widened ahead of the
  // fleet knowledge-graph's own kg-nodes/kg-edges shape routes (P4) landing
  // unflagged. Keep in lockstep with .jv scripts/security-pr-review-check.js.
  'api/shapes/',
  'api/sync/',
  // Self-protection: changes to the security-enforcement machinery must
  // themselves carry a guardrail-2 verdict. Surfaced 2026-07-16 when the
  // sec-audit-label-guard work bypassed this gate — a PR editing the gate/guard
  // scripts or their workflows classified as NOT security-sensitive, so the
  // machinery that decides what is security-sensitive was itself unguarded.
  // Keep in lockstep with the fleet checker (separate .jv PR).
  'scripts/validate/security-review-gate',
  'scripts/validate/sec-audit-label-decision',
  'scripts/validate/guardrail2-verdict',
  '.github/workflows/security-review-gate',
  '.github/workflows/sec-audit-label-guard',
  '.github/workflows/security.yml',
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
  const ghArgs = [
    'pr',
    'view',
    prNumber,
    '--json',
    'files,labels,reviewDecision,title,author,reviews,comments',
  ];
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

  // A live guardrail-2 REQUEST-CHANGES marker holds the merge even when the
  // sec-review:approved label is present (the revealui#1910 miss: the label was
  // applied against an outstanding REQUEST-CHANGES). This is checked FIRST so the
  // hold cannot be papered over by the label/review-decision fallback below.
  const verdict = evaluateGuardrail2({
    reviews: data.reviews || [],
    comments: data.comments || [],
    authorLogin: (data.author && data.author.login) || '',
  });

  if (verdict.status === 'hold') {
    process.stderr.write(
      `HOLD — PR #${prNumber} has a live guardrail-2 REQUEST-CHANGES verdict ` +
        `(reviewer ${verdict.reviewer || 'unknown'}, ${verdict.timestamp || 'unknown time'}).\n` +
        `   The sec-review:approved label and any approving review are OVERRIDDEN while this stands.\n` +
        `   Required to clear: a LATER non-author guardrail-2 APPROVE marker resolving it.\n`,
    );
    process.exit(1);
  }

  if (verdict.status === 'clear') {
    process.stdout.write(
      `PR #${prNumber} is security-sensitive AND carries a guardrail-2 APPROVE verdict ` +
        `(reviewer ${verdict.reviewer || 'unknown'}, ${verdict.timestamp || 'unknown time'}) — clear to merge.\n`,
    );
    process.exit(0);
  }

  // No verdict marker on the PR — fall back to the legacy label / approving-review
  // signal (backward compatible for PRs that predate the marker convention).
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

// Export the surface list + classifier so the unit test can assert the
// classification without spawning the CLI. Guarding main() behind
// require.main === module keeps the CLI behavior identical when run directly.
module.exports = { SECURITY_PATHS, SEC_REVIEW_LABELS, classifyFiles };

if (require.main === module) {
  main();
}
