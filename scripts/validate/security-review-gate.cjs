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

/**
 * GAP-458: a test → main promote re-presents feature diffs. The gate must
 * verify upstream verdicts mechanically, not re-ask for a human review of
 * already-cleared code.
 */
function isPromotePr(baseRefName, headRefName) {
  return baseRefName === 'main' && headRefName === 'test';
}

/**
 * Pure coverage decision for promote PRs (unit-tested).
 *
 * @param {Array<{ sha: string, shortSha?: string, prs: Array<{ number: number, hasVerdict: boolean }> }>} coverage
 *   One entry per security-touching commit in the promote batch.
 * @returns {{ action: 'clear' | 'hold', kind: string, uncovered?: string[], coveredCount?: number }}
 */
function decidePromoteUpstreamCoverage(coverage) {
  if (!Array.isArray(coverage) || coverage.length === 0) {
    return { action: 'hold', kind: 'no-security-commits' };
  }
  const uncovered = [];
  for (const entry of coverage) {
    const prs = entry.prs || [];
    const covered = prs.some((pr) => pr && pr.hasVerdict === true);
    if (!covered) {
      uncovered.push(entry.shortSha || (entry.sha ? entry.sha.slice(0, 7) : 'unknown'));
    }
  }
  if (uncovered.length === 0) {
    return { action: 'clear', kind: 'upstream-verdict', coveredCount: coverage.length };
  }
  return { action: 'hold', kind: 'uncovered-commits', uncovered };
}

/**
 * Whether a PR record counts as a recorded sec-review clearance (label or
 * approving review). Does not consult guardrail-2 markers — those remain
 * reviewer proposals, not owner disposition (B2).
 */
function prRecordHasVerdict({ labels = [], reviewDecision = '' }) {
  const labelSet = new Set(labels);
  if ([...labelSet].some((l) => SEC_REVIEW_LABELS.has(l))) return true;
  if (reviewDecision === 'APPROVED') return true;
  return false;
}

/**
 * List commit SHAs on a PR (paginated). Injectable ghImpl for tests.
 */
function fetchPrCommitShas(prNumber, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/pulls/${prNumber}/commits`;
  const out = run(['api', path, '--paginate', '--jq', '.[].sha']);
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Files changed in one commit. Injectable ghImpl for tests.
 */
function fetchCommitFiles(sha, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/commits/${sha}`;
  const out = run(['api', path, '--jq', '[.files[]?.filename] | .[]']);
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Associated PRs for a commit (excluding the promote PR itself).
 */
function fetchCommitPulls(sha, repo, excludePrNumber, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/commits/${sha}/pulls`;
  // Accept header for media type is set by gh for this endpoint when using REST.
  let out;
  try {
    out = run([
      'api',
      path,
      '-H',
      'Accept: application/vnd.github.groot-preview+json',
      '--jq',
      '.[] | [.number, (.labels | map(.name) | join(",")), .merged_at] | @tsv',
    ]);
  } catch {
    return [];
  }
  const rows = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    // TSV: number \t labelsCsv \t merged_at
    const tab1 = line.indexOf('\t');
    if (tab1 === -1) continue;
    const numStr = line.slice(0, tab1);
    const rest = line.slice(tab1 + 1);
    const tab2 = rest.indexOf('\t');
    const labelsCsv = tab2 === -1 ? rest : rest.slice(0, tab2);
    const number = Number(numStr);
    if (!Number.isFinite(number) || number === Number(excludePrNumber)) continue;
    const labels = labelsCsv ? labelsCsv.split(',').filter(Boolean) : [];
    rows.push({
      number,
      hasVerdict: prRecordHasVerdict({ labels, reviewDecision: '' }),
    });
  }
  return rows;
}

/**
 * Build coverage rows for a promote PR: security-touching commits and whether
 * each traces to an upstream PR with a recorded sec-review verdict.
 * Injectable ghImpl for unit tests.
 */
function buildPromoteCoverage(prNumber, repo, ghImpl) {
  const shas = fetchPrCommitShas(prNumber, repo, ghImpl);
  const coverage = [];
  for (const sha of shas) {
    let files;
    try {
      files = fetchCommitFiles(sha, repo, ghImpl);
    } catch {
      // Fail closed: unknown files → treat as security-touching so we demand a covering PR
      files = ['packages/auth/unknown'];
    }
    if (classifyFiles(files).length === 0) continue;
    let prs;
    try {
      prs = fetchCommitPulls(sha, repo, prNumber, ghImpl);
    } catch {
      prs = [];
    }
    coverage.push({
      sha,
      shortSha: sha.slice(0, 7),
      prs,
    });
  }
  return coverage;
}

function runPrMode(prNumber, repo) {
  let raw;
  const ghArgs = [
    'pr',
    'view',
    prNumber,
    '--json',
    'labels,reviewDecision,title,author,reviews,comments,baseRefName,headRefName',
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

  // GAP-458: promote (test → main) may inherit upstream feature-PR verdicts.
  const baseRef = data.baseRefName || '';
  const headRef = data.headRefName || '';
  if (isPromotePr(baseRef, headRef)) {
    let coverage;
    try {
      coverage = buildPromoteCoverage(prNumber, repo);
    } catch (err) {
      process.stderr.write(
        `HOLD — PR #${prNumber} is a promote but upstream-verdict scan failed ` +
          `(${err instanceof Error ? err.message : 'unknown'}). Failing closed.\n` +
          `   Touched: ${[...new Set(hits)].join(', ')}\n` +
          `   Override: apply "${[...SEC_REVIEW_LABELS][0]}" on this promote.\n`,
      );
      process.exit(1);
    }
    const upstream = decidePromoteUpstreamCoverage(coverage);
    if (upstream.action === 'clear') {
      process.stdout.write(
        `PR #${prNumber} is a test→main promote; all ${upstream.coveredCount} security-touching ` +
          `commit(s) trace to an upstream PR with a recorded sec-review verdict — clear to merge ` +
          `(GAP-458). Owner label still available as override.\n`,
      );
      process.exit(0);
    }
    process.stderr.write(
      `HOLD — PR #${prNumber} is a test→main promote with security-touching commit(s) that lack ` +
        `an upstream sec-review verdict (GAP-458).\n` +
        `   Uncovered commit(s): ${(upstream.uncovered || []).join(', ') || '(none mapped — treat as uncovered)'}\n` +
        `   Touched: ${[...new Set(hits)].join(', ')}\n` +
        `   Required: clear those commits on their feature PRs, OR apply "${[...SEC_REVIEW_LABELS][0]}" on this promote.\n`,
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
  isPromotePr,
  decidePromoteUpstreamCoverage,
  prRecordHasVerdict,
  fetchPrFiles,
  hitsForFiles,
  // exposed for integration tests / CI dry-runs
  buildPromoteCoverage,
};

if (require.main === module) {
  main();
}
