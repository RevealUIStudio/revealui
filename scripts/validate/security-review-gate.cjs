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
  // Harness hook/policy enforcement plane. packages/harnesses/src/hooks/
  // decides ALLOW/DENY for editor agent actions and emits the config that
  // binds editors to it; the package's server surface forks caller-supplied
  // agent commands. Added after an enforcement-plane PR merged over an
  // outstanding request-changes because this list did not classify it as
  // security-sensitive. Whole-package entry, matching packages/mcp//security//
  // paywall/; adapters ride along fine. Keep in lockstep with the fleet checker.
  'packages/harnesses/',
  // GAP-400: the edit-session engine + preview-token flow (HMAC credential
  // minting/verification, cross-origin postMessage, draft-read authorization)
  // and the canvas/runtime package that consumes it. A prior PR shipped this
  // surface and both gates classified it NOT security-sensitive; a manual
  // review pass covered that PR, but the automated backstop had a hole for
  // every future PR touching this surface. Keep in lockstep with the fleet
  // checker (internal tooling, separate .jv PR).
  'routes/content/sessions',
  'preview-token',
  'packages/editor/',
  // GAP-400: audit-substrate widening. The append-only audit log is the
  // tamper-evidence record for every other security-sensitive write in the
  // fleet; its schema, store, and migrations are themselves a
  // security-sensitive surface. Keep in lockstep with the fleet checker.
  'packages/db/src/schema/audit-log',
  'packages/db/src/audit-store',
  'packages/db/migrations/',
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

/**
 * The REST list-files endpoint stops at 3000 files. A diff at (or past) that
 * ceiling cannot be classified honestly, so `hitsForFiles` fails closed there.
 */
const MAX_CLASSIFIABLE_FILES = 3000;

/**
 * Full changed-file list for a PR, paginated. `gh pr view --json files` caps at
 * 100 entries with no pagination, which let a 600+-file promotion be classified
 * from a truncated window that happened to contain none of its security paths.
 * The `{owner}/{repo}` placeholders resolve from the current directory's repo
 * when no --repo was passed. Injectable `ghImpl` exists for the unit test.
 */
function fetchPrFiles(prNumber, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/pulls/${prNumber}/files`;
  const out = run(['api', path, '--paginate', '--jq', '.[].filename']);
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Classification wrapper that fails closed at the API ceiling: a file list the
 * endpoint may have truncated is treated as security-sensitive unconditionally.
 */
function hitsForFiles(files) {
  if (files.length >= MAX_CLASSIFIABLE_FILES) {
    return ['(file list at the API ceiling — unclassifiable, failing closed)'];
  }
  return classifyFiles(files);
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

/**
 * The gate decision for a security-sensitive PR (pure; unit-tested). Inputs are
 * the guardrail-2 marker verdict plus the legacy label/review signal.
 *
 *  - A live guardrail-2 REQUEST-CHANGES marker HOLDS, overriding the label (the
 *    revealui#1910 miss). Checked first.
 *  - Otherwise the gate clears ONLY on the owner-applied sec-review:approved
 *    label (or an approving review). A guardrail-2 APPROVE marker RESOLVES a
 *    prior REQUEST-CHANGES hold but never substitutes for the owner's clearance
 *    label: markers are reviewer proposals, the label is the owner disposition.
 *    So both a `clear` verdict and a `no-marker` verdict fall through to the
 *    same label/review requirement. (Fixes the #1914 B2 regression, where a
 *    `clear` marker exited 0 on its own — so any APPROVE-marker comment, which
 *    the PR author can post, cleared the gate with no owner label.)
 *
 * Returns `{ action: 'hold' | 'clear', kind, reviewer?, timestamp? }`.
 */
function decideReviewGate({ verdict, labels = [], reviewDecision = '' }) {
  if (verdict && verdict.status === 'hold') {
    return {
      action: 'hold',
      kind: 'request-changes',
      reviewer: verdict.reviewer,
      timestamp: verdict.timestamp,
    };
  }
  const labelSet = new Set(labels);
  const hasReviewLabel = [...labelSet].some((l) => SEC_REVIEW_LABELS.has(l));
  const approved = reviewDecision === 'APPROVED';
  if (approved || hasReviewLabel) {
    return { action: 'clear', kind: approved ? 'review' : 'label' };
  }
  return { action: 'hold', kind: 'no-verdict' };
}

function runPrMode(prNumber, repo) {
  let raw;
  const ghArgs = [
    'pr',
    'view',
    prNumber,
    '--json',
    'labels,reviewDecision,title,author,reviews,comments',
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
  let files;
  try {
    files = fetchPrFiles(prNumber, repo);
  } catch (err) {
    process.stderr.write(
      `security-review-gate: file-list fetch failed for PR ${prNumber} (${err instanceof Error ? err.message : 'unknown'}). ` +
        `Cannot classify — treating as HOLD.\n`,
    );
    process.exit(1);
  }
  const hits = hitsForFiles(files);

  if (hits.length === 0) {
    process.stdout.write(
      `PR #${prNumber}: no security-sensitive files touched — no review gate.\n`,
    );
    process.exit(0);
  }

  // Compute the guardrail-2 marker verdict (comments/reviews) and hand it, with
  // the legacy label/review signal, to the pure `decideReviewGate`. A live
  // REQUEST-CHANGES holds even with the label; a clear/no-marker verdict still
  // requires the owner label (or an approving review) — see the function header.
  const verdict = evaluateGuardrail2({
    reviews: data.reviews || [],
    comments: data.comments || [],
    authorLogin: (data.author && data.author.login) || '',
  });
  const decision = decideReviewGate({
    verdict,
    labels: (data.labels || []).map((l) => l.name),
    reviewDecision: data.reviewDecision,
  });

  if (decision.action === 'clear') {
    process.stdout.write(
      `PR #${prNumber} is security-sensitive AND carries a recorded verdict ` +
        `(${decision.kind === 'review' ? 'approving review' : 'sec-review:approved label'}) — clear to merge.\n`,
    );
    process.exit(0);
  }

  if (decision.kind === 'request-changes') {
    process.stderr.write(
      `HOLD — PR #${prNumber} has a live guardrail-2 REQUEST-CHANGES verdict ` +
        `(reviewer ${decision.reviewer || 'unknown'}, ${decision.timestamp || 'unknown time'}).\n` +
        `   The sec-review:approved label and any approving review are OVERRIDDEN while this stands.\n` +
        `   Required to clear: a LATER non-author guardrail-2 APPROVE marker AND the sec-review:approved label.\n`,
    );
    process.exit(1);
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
module.exports = {
  SECURITY_PATHS,
  SEC_REVIEW_LABELS,
  MAX_CLASSIFIABLE_FILES,
  classifyFiles,
  decideReviewGate,
  fetchPrFiles,
  hitsForFiles,
};

if (require.main === module) {
  main();
}
