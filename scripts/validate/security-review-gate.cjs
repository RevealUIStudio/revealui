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
// SECURITY_PATHS source of truth (GAP-404): packages/harnesses/src/gates/security-paths.shared.json
// Widen shared surfaces there only. The fleet checker vendors a copy of that
// file and adds a fleet-only overlay — never hand-edit a second full list.

'use strict';

const { execFileSync } = require('child_process');
const { evaluateGuardrail2 } = require('./guardrail2-verdict.cjs');
const { resolveGatesModule } = require('./gates-resolver.cjs');

// Use the shared classifier and canonical marker source so controller shadow
// evidence and this required gate cannot drift.
const sharedGates = resolveGatesModule();
if (
  !sharedGates ||
  typeof sharedGates.classifySecurityPaths !== 'function' ||
  typeof sharedGates.classifySecurityPathsAtApiLimit !== 'function'
) {
  throw new Error('shared security path classifier unavailable');
}
const SECURITY_PATHS = sharedGates.SECURITY_PATH_MARKERS;

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
const MAX_CLASSIFIABLE_FILES = sharedGates.MAX_CLASSIFIABLE_SECURITY_PATHS;

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
  const out = run(['api', path, '--paginate', '--jq', '.[] | .filename, .previous_filename // empty']);
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Classification wrapper that fails closed at the API ceiling: a file list the
 * endpoint may have truncated is treated as security-sensitive unconditionally.
 */
function hitsForFiles(files) {
  return sharedGates.classifySecurityPathsAtApiLimit(files);
}

function classifyFiles(files) {
  return sharedGates.classifySecurityPaths(files);
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

/**
 * Verify a receipt carried by the controller-owned check run against live
 * GitHub observations. This is shadow evidence only; callers must continue to
 * apply the active owner gate until the separately reviewed cutover.
 */
function verifyReceiptShadow(input) {
  const hold = (reason) => ({ ok: false, reason });
  const check = input.receiptCheckRun;
  if (
    !check ||
    check.name !== 'RevealUI Receipt' ||
    check.head_sha !== input.headSha ||
    check.status !== 'completed' ||
    check.conclusion !== 'success' ||
    check.app?.id !== input.controllerAppId ||
    check.external_id !== `pr-${input.repositoryId}-${input.pullRequest}`
  ) return hold('receipt_check_run_missing_or_untrusted');
  const summary = check.output?.summary;
  const marker = '<!-- revealui-review-receipt:v1 -->';
  if (typeof summary !== 'string' || Buffer.byteLength(summary, 'utf8') > 64 * 1024)
    return hold('receipt_check_summary_missing_or_oversized');
  const markerIndex = summary.indexOf(marker);
  if (markerIndex < 0 || summary.indexOf(marker, markerIndex + marker.length) >= 0)
    return hold('receipt_check_summary_marker_invalid');
  const rawEnvelope = summary.slice(markerIndex + marker.length).trim();
  let envelope;
  try {
    envelope = JSON.parse(rawEnvelope);
  } catch {
    return hold('receipt_check_envelope_malformed');
  }
  const receipt = envelope && typeof envelope === 'object' ? envelope.receipt : null;
  if (!receipt || typeof receipt.manifest?.sha256 !== 'string')
    return hold('receipt_manifest_missing');

  const requiredChecks = [];
  for (const selector of input.requiredChecks) {
    const matches = input.currentCheckRuns.filter(
      (run) => run.name === selector.name && run.app?.id === selector.appId,
    );
    if (matches.length !== 1) return hold('receipt_required_check_selector_not_unique');
    const [run] = matches;
    if (
      run.head_sha !== input.headSha ||
      run.status !== 'completed' ||
      run.conclusion !== 'success' ||
      !Number.isSafeInteger(run.id) ||
      !Number.isSafeInteger(run.check_suite?.id)
    ) return hold('receipt_required_check_missing_or_stale');
    const signedChecks = Array.isArray(receipt.checks)
      ? receipt.checks.filter((item) => item.name === selector.name && item.appId === selector.appId)
      : [];
    if (signedChecks.length !== 1) return hold('receipt_check_evidence_missing_or_ambiguous');
    let evidenceSha256;
    try {
      evidenceSha256 = sharedGates.reviewReceiptCheckEvidenceSha256({
        name: run.name,
        appId: run.app.id,
        checkRunId: run.id,
        checkSuiteId: run.check_suite.id,
        headSha: run.head_sha,
        status: run.status,
        conclusion: run.conclusion,
        completedAt: run.completed_at,
      });
    } catch {
      return hold('receipt_required_check_evidence_invalid');
    }
    if (
      signedChecks[0].checkRunId !== run.id ||
      signedChecks[0].checkSuiteId !== run.check_suite.id ||
      signedChecks[0].evidenceSha256 !== evidenceSha256
    ) return hold('receipt_required_check_rerun_or_changed');
    requiredChecks.push({
      name: selector.name,
      appId: selector.appId,
      checkRunId: run.id,
      checkSuiteId: run.check_suite.id,
    });
  }

  return sharedGates.verifyReviewReceipt({
    envelope: rawEnvelope,
    trustedKeys: input.trustedKeys,
    expected: {
      repositoryId: input.repositoryId,
      repositoryFullName: input.repositoryFullName,
      pullRequest: input.pullRequest,
      headSha: input.headSha,
      headTreeSha: input.headTreeSha,
      baseSha: input.baseSha,
      baseTreeSha: input.baseTreeSha,
      mergeCandidateTreeSha: input.mergeCandidateTreeSha,
      manifestSha256: receipt.manifest.sha256,
      policyVersion: input.policyVersion,
      classifierVersion: sharedGates.SECURITY_PATH_CLASSIFIER_VERSION,
      requiredChecks,
      minimumIndependentReviews: input.sensitive ? 2 : 1,
      maxReceiptLifetimeMs: input.maxLifetimeMs,
      now: input.now,
    },
  });
}

function readReceiptShadowConfig(env = process.env) {
  const mode = env.REVIEW_RECEIPT_MODE?.trim();
  if (!mode) {
    if (Object.keys(env).some((name) => name.startsWith('REVIEW_RECEIPT_') && env[name]?.trim()))
      throw new Error('REVIEW_RECEIPT_MODE is required when receipt settings are present');
    return undefined;
  }
  if (mode !== 'shadow') throw new Error('REVIEW_RECEIPT_MODE must be shadow');
  const controllerAppId = Number(requiredEnv(env, 'REVIEW_RECEIPT_CONTROLLER_APP_ID'));
  const maxLifetimeMs = Number(requiredEnv(env, 'REVIEW_RECEIPT_MAX_LIFETIME_MS'));
  const policyVersion = requiredEnv(env, 'REVIEW_RECEIPT_POLICY_VERSION');
  if (!Number.isSafeInteger(controllerAppId) || controllerAppId <= 0)
    throw new Error('REVIEW_RECEIPT_CONTROLLER_APP_ID must be a positive integer');
  if (!Number.isSafeInteger(maxLifetimeMs) || maxLifetimeMs < 60_000 || maxLifetimeMs > 86_400_000)
    throw new Error('REVIEW_RECEIPT_MAX_LIFETIME_MS must be between 60000 and 86400000');
  if (policyVersion.length > 128) throw new Error('REVIEW_RECEIPT_POLICY_VERSION exceeds size limit');
  const trustedKeys = parseJsonEnv(env, 'REVIEW_RECEIPT_TRUSTED_KEYS');
  if (!isRecord(trustedKeys) || Object.keys(trustedKeys).length === 0 || Object.keys(trustedKeys).length > 32)
    throw new Error('REVIEW_RECEIPT_TRUSTED_KEYS must be a non-empty key map');
  for (const [keyId, publicKey] of Object.entries(trustedKeys)) {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(keyId) || typeof publicKey !== 'string' || publicKey.length > 8192)
      throw new Error('REVIEW_RECEIPT_TRUSTED_KEYS contains an invalid key');
  }
  const requiredChecks = parseJsonEnv(env, 'REVIEW_RECEIPT_REQUIRED_CHECKS');
  if (!Array.isArray(requiredChecks) || requiredChecks.length === 0 || requiredChecks.length > 64)
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS must contain 1 to 64 entries');
  for (const check of requiredChecks) {
    if (
      !isRecord(check) || typeof check.name !== 'string' || !check.name.trim() ||
      check.name !== check.name.trim() || check.name.length > 200 ||
      !Number.isSafeInteger(check.appId) || check.appId <= 0
    ) throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS contains an invalid selector');
  }
  const selectors = requiredChecks.map((check) => `${check.appId}:${check.name}`);
  if (new Set(selectors).size !== selectors.length)
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS contains duplicate selectors');
  return { controllerAppId, maxLifetimeMs, policyVersion, trustedKeys, requiredChecks };
}

function requiredEnv(env, name) {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required when REVIEW_RECEIPT_MODE=shadow`);
  return value;
}

function parseJsonEnv(env, name) {
  const raw = requiredEnv(env, name);
  if (Buffer.byteLength(raw, 'utf8') > 32 * 1024) throw new Error(`${name} exceeds size limit`);
  try { return JSON.parse(raw); } catch { throw new Error(`${name} must be valid JSON`); }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fetchJson(args, ghImpl = gh) {
  const raw = ghImpl(['api', ...args]);
  return JSON.parse(raw);
}

function fetchCommitTreeSha(sha, repo, ghImpl = gh) {
  if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('invalid commit SHA for receipt context');
  const commit = fetchJson([`repos/${repo}/commits/${sha}`], ghImpl);
  const treeSha = commit?.commit?.tree?.sha;
  if (typeof treeSha !== 'string' || !/^[a-f0-9]{40,64}$/.test(treeSha))
    throw new Error('receipt context commit tree unavailable');
  return treeSha;
}

function fetchCurrentCheckRuns(headSha, repo, ghImpl = gh) {
  const pages = JSON.parse(ghImpl([
    'api', `repos/${repo}/commits/${headSha}/check-runs?filter=latest&per_page=100`,
    '--paginate', '--slurp',
  ]));
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page?.check_runs)))
    throw new Error('invalid check-run response for receipt verification');
  const runs = pages.flatMap((page) => page.check_runs);
  if (runs.length > 1000) throw new Error('check-run response limit exceeded');
  return runs;
}

function evaluateReceiptShadowForPr(prNumber, repo, files, config, ghImpl = gh, now = new Date()) {
  if (!config) return { status: 'disabled' };
  const pullPath = `repos/${repo}/pulls/${prNumber}`;
  const pr = fetchJson([pullPath], ghImpl);
  if (
    pr?.state !== 'open' || pr.draft === true || pr.mergeable !== true ||
    pr.merged_at || pr.base?.repo?.full_name !== repo || pr.head?.repo?.full_name !== repo
  ) return { status: 'ineligible', reason: 'pull_request_not_ready_or_same_repository' };
  const headSha = pr.head?.sha;
  const baseSha = pr.base?.sha;
  const mergeSha = pr.merge_commit_sha;
  const repositoryId = pr.base?.repo?.id;
  if (![headSha, baseSha, mergeSha].every((sha) => typeof sha === 'string' && /^[a-f0-9]{40,64}$/.test(sha)) ||
      !Number.isSafeInteger(repositoryId) || repositoryId <= 0)
    return { status: 'ineligible', reason: 'pull_request_receipt_context_incomplete' };
  const [headTreeSha, baseTreeSha, mergeCandidateTreeSha, currentCheckRuns] = [
    fetchCommitTreeSha(headSha, repo, ghImpl),
    fetchCommitTreeSha(baseSha, repo, ghImpl),
    fetchCommitTreeSha(mergeSha, repo, ghImpl),
    fetchCurrentCheckRuns(headSha, repo, ghImpl),
  ];
  const receiptRuns = currentCheckRuns.filter(
    (run) => run.name === 'RevealUI Receipt' && run.app?.id === config.controllerAppId &&
      run.external_id === `pr-${repositoryId}-${prNumber}`,
  );
  if (receiptRuns.length !== 1)
    return { status: 'ineligible', reason: 'receipt_check_run_missing_or_ambiguous' };
  const result = verifyReceiptShadow({
    receiptCheckRun: receiptRuns[0],
    controllerAppId: config.controllerAppId,
    repositoryId,
    repositoryFullName: repo,
    pullRequest: Number(prNumber),
    headSha,
    headTreeSha,
    baseSha,
    baseTreeSha,
    mergeCandidateTreeSha,
    requiredChecks: config.requiredChecks,
    currentCheckRuns,
    trustedKeys: config.trustedKeys,
    policyVersion: config.policyVersion,
    maxLifetimeMs: config.maxLifetimeMs,
    sensitive: hitsForFiles(files).length > 0,
    now,
  });
  const fresh = fetchJson([pullPath], ghImpl);
  if (fresh?.head?.sha !== headSha || fresh?.base?.sha !== baseSha || fresh?.merge_commit_sha !== mergeSha)
    return { status: 'ineligible', reason: 'pull_request_changed_during_receipt_verification' };
  return result.ok
    ? { status: 'verified', receiptId: result.receiptId }
    : { status: 'ineligible', reason: result.reason || 'receipt_invalid' };
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
      const decision = verifyPrOwnerRecord(data, number, repo, discussion, resolveAllowedSigners(options.allowedSigners), options.verifyImpl);
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
    try {
      const receiptConfig = readReceiptShadowConfig();
      if (receiptConfig) {
        const receiptShadow = evaluateReceiptShadowForPr(prNumber, target, fetchPrFiles(prNumber, target), receiptConfig);
        process.stdout.write(
          receiptShadow.status === 'verified'
            ? `SHADOW — controller receipt ${receiptShadow.receiptId} verifies for this exact candidate; existing gate remains authoritative.\n`
            : `SHADOW — controller receipt not verified (${receiptShadow.reason || receiptShadow.status}); existing gate remains authoritative.\n`,
        );
      }
    } catch (error) {
      process.stdout.write(
        `SHADOW — receipt observation unavailable (${error instanceof Error ? error.message : 'unknown failure'}); existing gate remains authoritative.\n`,
      );
    }
    const decision = verifyPrOwnerRecord(data, prNumber, target, discussion, resolveAllowedSigners());
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

function resolveAllowedSigners(explicit) {
  return explicit ?? process.env.REVEALFLEET_OVERRIDE_SIGNERS ?? '';
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
  verifyReceiptShadow,
  isPromotePr,
  decidePromoteUpstreamCoverage,
  prRecordHasVerdict,
  fetchPrDiscussion,
  verifyPrOwnerRecord,
  fetchCommitPulls,
  fetchPrCommitShas,
  fetchPrFiles,
  hitsForFiles,
  resolveAllowedSigners,
  readReceiptShadowConfig,
  evaluateReceiptShadowForPr,
  // exposed for integration tests / CI dry-runs
  buildPromoteCoverage,
};

if (require.main === module) {
  main();
}
