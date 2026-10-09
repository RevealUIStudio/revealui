#!/usr/bin/env node
// security-review-gate.cjs — review-before-merge gate for security-sensitive PRs.
//
// Policy: a pull request that touches a security-sensitive surface must carry a
// RECORDED owner SSHSIG bound to its exact head and a request label before merge. PRs that do not touch such a surface
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
// Exit 0 = no security-sensitive change, or an owner-signed direct/covered grant.
// Exit 1 = HOLD (live reviewer rejection, missing/invalid grant, or incomplete evidence).
//
// Uses the existing shared gates resolver/build and OpenSSH verification.
// No local signing, private-key handling, or label-only grant.
//
// SECURITY_PATHS source of truth (GAP-404): scripts/validate/security-paths.shared.json
// Widen shared surfaces there only. The fleet checker vendors a copy of that
// file and adds a fleet-only overlay — never hand-edit a second full list.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { evaluateGuardrail2 } = require('./guardrail2-verdict.cjs');
const { resolveGatesModule } = require('./gates-resolver.cjs');

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

// These labels are request signals only; none grants clearance.
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

/** Labels/reviews request clearance; only the owner signature grants it. */
function decideReviewGate({ verdict, labels = [], ownerVerification = { ok: false } }) {
  if (verdict && verdict.status === 'hold') {
    return { action: 'hold', kind: 'request-changes', reviewer: verdict.reviewer, timestamp: verdict.timestamp };
  }
  const requested = labels.some((label) => SEC_REVIEW_LABELS.has(label));
  if (requested && ownerVerification.ok === true) return { action: 'clear', kind: 'owner-signature', url: ownerVerification.url };
  return { action: 'hold', kind: 'no-owner-signature', reason: ownerVerification.reason || (requested ? 'missing-owner-signature' : 'missing-request-label') };
}

/** REST pagination supplies complete discussion history, or throws closed. */
function fetchPrDiscussion(prNumber, repo, ghImpl = gh) {
  function list(kind) {
    const endpoint = kind === 'comments' ? `issues/${prNumber}/comments` : `pulls/${prNumber}/reviews`;
    const pages = JSON.parse(ghImpl(['api', `repos/${repo}/${endpoint}?per_page=100`, '--paginate', '--slurp']));
    if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) throw new Error('invalid paginated discussion response');
    const rows = pages.flat();
    if (rows.length > 1000 || rows.some((row) => !row || typeof row.body !== 'string')) throw new Error('unbounded or invalid discussion response');
    return rows.map((row) => ({ body: row.body, url: row.html_url, author: { login: row.user?.login || '' }, createdAt: row.created_at, submittedAt: row.submitted_at }));
  }
  return { comments: list('comments'), reviews: list('reviews') };
}

function verifyPrOwnerRecord(data, prNumber, repo, discussion, allowedSigners = process.env.REVEALFLEET_OVERRIDE_SIGNERS || '', verifyImpl) {
  const verdict = evaluateGuardrail2({ ...discussion, authorLogin: data.author?.login || '' });
  if (verdict.status === 'hold') return decideReviewGate({ verdict });
  const labels = (data.labels || []).map((label) => typeof label === 'string' ? label : label.name);
  if (!labels.some((label) => SEC_REVIEW_LABELS.has(label))) return decideReviewGate({ verdict, labels });
  const verifier = verifyImpl || resolveGatesModule()?.verifyOwnerOverrideComments;
  if (typeof verifier !== 'function') throw new Error('shared owner-signature verifier unavailable');
  const ownerVerification = verifier({ comments: discussion.comments, allowedSigners, expected: { repo, pr: Number(prNumber), head: data.headRefOid, gate: 'sec-review' } });
  return decideReviewGate({ verdict, labels, ownerVerification });
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

/** Promotion coverage requires merged source and the identical signed door. */
function prRecordHasVerdict({ merged = false, ...decision }) {
  return merged === true && decideReviewGate(decision).action === 'clear';
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
  const shas = out.split('\n').filter((line) => line.length > 0);
  if (shas.length >= 250) throw new Error('PR commit list reached the API ceiling; signed coverage cannot be established');
  return shas;
}

/**
 * Files changed in one commit. Injectable ghImpl for tests.
 */
function fetchCommitFiles(sha, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/commits/${sha}?per_page=100`;
  const out = run(['api', path, '--paginate', '--jq', '.files[]?.filename']);
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Associated PRs for a commit (excluding the promote PR itself).
 */
function fetchCommitPulls(sha, repo, excludePrNumber, ghImpl = gh, options = {}) {
  const pages = JSON.parse(ghImpl(['api', `repos/${repo}/commits/${sha}/pulls?per_page=100`, '--paginate', '--slurp']));
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) throw new Error('invalid associated PR response');
  const records = pages.flat();
  if (records.length > 1000) throw new Error('associated PR limit');
  const rows = [];
  const cache = options.cache || new Map();
  for (const associated of records) {
    const number = associated.number;
    if (!Number.isSafeInteger(number) || number <= 0 || number === Number(excludePrNumber) || !associated.merged_at || associated.base?.repo?.full_name !== repo) continue;
    if (!cache.has(number)) {
      const data = JSON.parse(ghImpl(['pr', 'view', String(number), '--repo', repo, '--json', 'labels,author,headRefOid,mergedAt']));
      const discussion = fetchPrDiscussion(number, repo, ghImpl);
      const decision = verifyPrOwnerRecord(data, number, repo, discussion, options.allowedSigners ?? undefined, options.verifyImpl);
      cache.set(number, { head: data.headRefOid, merged: Boolean(data.mergedAt), decision, commits: fetchPrCommitShas(number, repo, ghImpl) });
    }
    const record = cache.get(number);
    rows.push({ number, hasVerdict: record.merged && record.head === associated.head?.sha && record.commits.includes(sha) && record.decision.action === 'clear' });
  }
  return rows;
}

/**
 * Parent count for a commit (merge commits have 2+). Injectable ghImpl.
 */
function fetchCommitParentCount(sha, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }));
  const path = `repos/${repo || '{owner}/{repo}'}/commits/${sha}`;
  const out = run(['api', path, '--jq', '.parents | length']);
  const n = Number(String(out).trim());
  return Number.isFinite(n) ? n : 1;
}

/**
 * Build coverage rows for a promote PR: security-touching commits and whether
 * each traces to an upstream PR with a recorded sec-review verdict.
 * Injectable ghImpl for unit tests.
 *
 * Merge commits are skipped: `git show merge` lists the entire other-side tree
 * as "changed", which re-attributes already-cleared feature files (e.g. a
 * `merge origin/test into feat/…` after GAP-444 landed) to a commit that is
 * not linked to the feature PR and has no sec-review label. Security deltas
 * still appear on the non-merge feature commits that actually authored them.
 */
function buildPromoteCoverage(prNumber, repo, ghImpl, options = {}) {
  const cache = new Map();
  const shas = fetchPrCommitShas(prNumber, repo, ghImpl);
  const coverage = [];
  for (const sha of shas) {
    try {
      if (fetchCommitParentCount(sha, repo, ghImpl) > 1) {
        continue;
      }
    } catch {
      // Unknown parent count — keep evaluating the commit (fail closed on files).
    }
    let files;
    try {
      files = fetchCommitFiles(sha, repo, ghImpl);
    } catch {
      // Fail closed: unknown files → treat as security-touching so we demand a covering PR
      files = ['packages/auth/unknown'];
    }
    if (hitsForFiles(files).length === 0) continue;
    let prs;
    try {
      prs = fetchCommitPulls(sha, repo, prNumber, ghImpl, { ...options, cache });
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
  try {
    const target = repo || gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
    const data = JSON.parse(gh(['pr', 'view', prNumber, '--repo', target, '--json', 'labels,title,author,headRefOid,baseRefName,headRefName,isCrossRepository']));
    const hits = hitsForFiles(fetchPrFiles(prNumber, target));
    if (hits.length === 0) {
      process.stdout.write(`PR #${prNumber}: no security-sensitive files touched — no review gate.\n`);
      process.exitCode = 0;
      return;
    }
    const discussion = fetchPrDiscussion(prNumber, target);
    const decision = verifyPrOwnerRecord(data, prNumber, target, discussion);
    if (decision.action === 'clear') {
      process.stdout.write(`PR #${prNumber}: verified exact-head owner sec-review signature (${decision.url || 'recorded comment'}).\n`);
      process.exitCode = 0;
      return;
    }
    if (decision.kind === 'request-changes') {
      process.stderr.write(`HOLD — live REQUEST-CHANGES by ${decision.reviewer || 'unknown'} at ${decision.timestamp || 'unknown time'}; owner signature cannot override it.\n`);
      process.exitCode = 1;
      return;
    }
    if (data.isCrossRepository === false && isPromotePr(data.baseRefName, data.headRefName)) {
      const upstream = decidePromoteUpstreamCoverage(buildPromoteCoverage(prNumber, target));
      if (upstream.action === 'clear') {
        process.stdout.write(`PR #${prNumber}: ${upstream.coveredCount} security commits have current, signed merged-feature coverage.\n`);
        process.exitCode = 0;
        return;
      }
      process.stderr.write(`HOLD — unsigned or expired feature coverage: ${(upstream.uncovered || []).join(', ') || upstream.kind}.\n`);
    }
    process.stderr.write(`HOLD — PR #${prNumber} requires a request label and an unexpired owner SSHSIG over its exact repo/PR/head/sec-review context (${decision.reason || decision.kind}). Labels and reviews alone cannot clear it.\n`);
    process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`HOLD — security review evidence unavailable: ${error instanceof Error ? error.message : 'unknown failure'}.\n`);
    process.exitCode = 1;
  }
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
      `   The PR will need a request label and an exact-head owner SSHSIG before merge.\n`,
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
  fetchPrDiscussion,
  verifyPrOwnerRecord,
  fetchCommitPulls,
  fetchPrCommitShas,
  fetchPrFiles,
  hitsForFiles,
  // exposed for integration tests / CI dry-runs
  buildPromoteCoverage,
};

if (require.main === module) {
  main();
}
