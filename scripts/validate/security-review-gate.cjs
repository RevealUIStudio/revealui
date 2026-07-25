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
//
// SECURITY_PATHS source of truth (GAP-404): scripts/validate/security-paths.shared.json
// Widen shared surfaces there only. The fleet checker vendors a copy of that
// file and adds a fleet-only overlay — never hand-edit a second full list.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { evaluateGuardrail2 } = require('./guardrail2-verdict.cjs');

/**
 * Load revealui security path markers from the single editable source
 * (GAP-404). The fleet checker (.jv) loads this same file + a fleet-only
 * overlay; never hand-edit a second copy of the shared list.
 */
function loadSharedSecurityPaths() {
  const file = path.join(__dirname, 'security-paths.shared.json');
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.markers) || data.markers.length === 0) {
    throw new Error(
      `security-paths.shared.json must export a non-empty "markers" array (${file})`,
    );
  }
  for (const m of data.markers) {
    if (typeof m !== 'string' || m.length === 0) {
      throw new Error(`security-paths.shared.json marker must be a non-empty string: ${m}`);
    }
  }
  return data.markers;
}

// A changed file is security-sensitive if its path contains ANY of these
// substrings. Deliberately broad — money, identity, credential, code-exec,
// and stored-content surfaces. Source: security-paths.shared.json (GAP-404).
const SECURITY_PATHS = loadSharedSecurityPaths();

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
