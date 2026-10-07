#!/usr/bin/env node
// security-review-gate.cjs — review-before-merge gate for security-sensitive PRs.
//
// Policy: a pull request that touches a security-sensitive surface must carry
// either an owner SSHSIG bound to its exact head plus a request label, or a
// successful RevealUI Receipt check run on that same head from the review
// controller App (matched by app id and slug, not by check name alone).
// Paths in receipt-sensitive-paths.json are stricter: the App receipt alone
// does not pass. Those paths also need an approving review from an account
// other than the PR author and the App, unless the owner SSHSIG is present.
// PRs that touch neither surface pass immediately, so this check is safe to
// require on every PR.
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
// Exit 0 = no gated change, an owner-signed grant, an exact-head App receipt
// on a non-sensitive path, or an App receipt plus independent approval on a
// sensitive path.
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

/**
 * Sensitive path classes (workflows, actions, auth, migrations, the gate,
 * CODEOWNERS, rulesets). One file, loaded here. An App receipt cannot clear
 * these without an independent approval. The owner SSHSIG still can.
 */
function loadSensitivePathClasses() {
  const file = path.join(__dirname, 'receipt-sensitive-paths.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.classes) || data.classes.length === 0) {
    throw new Error(
      `receipt-sensitive-paths.json must export a non-empty "classes" array (${file})`,
    );
  }
  const ids = new Set();
  const classes = [];
  for (const entry of data.classes) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      !Array.isArray(entry.markers) ||
      entry.markers.length === 0
    ) {
      throw new Error('receipt-sensitive-paths.json class must have an id and markers');
    }
    if (ids.has(entry.id)) throw new Error(`duplicate sensitive path class: ${entry.id}`);
    ids.add(entry.id);
    const markers = [];
    for (const marker of entry.markers) {
      if (typeof marker !== 'string' || marker.length === 0) {
        throw new Error(`sensitive path marker must be a non-empty string (${entry.id})`);
      }
      markers.push(marker);
    }
    classes.push({ id: entry.id, markers });
  }
  return classes;
}

const SENSITIVE_PATH_CLASSES = loadSensitivePathClasses();

/** Check name published by the review controller. Name alone never grants. */
const RECEIPT_CHECK_NAME = 'RevealUI Receipt';
const RECEIPT_APP_ID_VAR = 'REVEALFLEET_REVIEW_CONTROLLER_APP_ID';
const RECEIPT_APP_SLUG_VAR = 'REVEALFLEET_REVIEW_CONTROLLER_APP_SLUG';

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

/** Files that need App receipt plus an independent approval, or an owner SSHSIG. */
function classifySensitiveFiles(files) {
  const hits = [];
  for (const file of files) {
    const classes = [];
    for (const entry of SENSITIVE_PATH_CLASSES) {
      for (const marker of entry.markers) {
        if (file.includes(marker)) {
          classes.push(entry.id);
          break;
        }
      }
    }
    if (classes.length > 0) hits.push({ file, classes });
  }
  return hits;
}

/**
 * Whether this file list enters the gate, and whether the stricter sensitive
 * rule applies. An unclassifiable list fails closed as sensitive.
 */
function reviewAdmission(files) {
  const security = hitsForFiles(files);
  if (files.length >= MAX_CLASSIFIABLE_FILES) {
    return { gated: true, sensitive: true, security, sensitiveHits: [] };
  }
  const sensitiveHits = classifySensitiveFiles(files);
  return {
    gated: security.length > 0 || sensitiveHits.length > 0,
    sensitive: sensitiveHits.length > 0,
    security,
    sensitiveHits,
  };
}

function parsePositiveInt(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 12) return null;
  const first = raw.charCodeAt(0);
  if (first < 49 || first > 57) return null;
  let value = 0;
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code < 48 || code > 57) return null;
    value = value * 10 + (code - 48);
  }
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

function validAppSlug(slug) {
  if (typeof slug !== 'string' || slug.length < 1 || slug.length > 100) return false;
  if (slug.startsWith('-') || slug.endsWith('-')) return false;
  for (const ch of slug) {
    const code = ch.charCodeAt(0);
    const digit = code >= 48 && code <= 57;
    const lower = code >= 97 && code <= 122;
    if (!digit && !lower && ch !== '-') return false;
  }
  return true;
}

function sameLogin(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Repository variables name the review controller App. Both must be set.
 * Absent configuration leaves the owner SSHSIG path unchanged. A partial or
 * malformed pair cannot be used to match a check run.
 */
function readReceiptControllerConfig(env = process.env) {
  const idRaw = env[RECEIPT_APP_ID_VAR];
  const slugRaw = env[RECEIPT_APP_SLUG_VAR];
  const idPresent = typeof idRaw === 'string' && idRaw.length > 0;
  const slugPresent = typeof slugRaw === 'string' && slugRaw.length > 0;
  if (!idPresent && !slugPresent) return null;
  const appId = idPresent ? parsePositiveInt(idRaw) : null;
  const appSlug = slugPresent && validAppSlug(slugRaw) ? slugRaw : null;
  if (appId === null || appSlug === null) return { ok: false };
  return { ok: true, appId, appSlug };
}

/**
 * A passing receipt is a completed success check on the exact head SHA whose
 * app id and slug both match configuration. The check name is required and
 * is not sufficient.
 */
function verifyAppReceiptCheck({ headSha, checkRuns, appId, appSlug }) {
  if (!Number.isSafeInteger(appId) || appId <= 0) return { ok: false, reason: 'app-id-unconfigured' };
  if (!validAppSlug(appSlug)) return { ok: false, reason: 'app-slug-unconfigured' };
  if (typeof headSha !== 'string' || headSha.length < 40) return { ok: false, reason: 'invalid-head' };
  const named = [];
  for (const run of Array.isArray(checkRuns) ? checkRuns : []) {
    if (run && run.name === RECEIPT_CHECK_NAME) named.push(run);
  }
  const identity = [];
  for (const run of named) {
    const runAppId = run.app && run.app.id;
    const runSlug = run.app && run.app.slug;
    if (runAppId !== appId || runSlug !== appSlug) continue;
    if (run.head_sha !== headSha) continue;
    identity.push(run);
  }
  if (identity.length === 0) {
    const stale = named.some(
      (run) => run.app && run.app.id === appId && run.app.slug === appSlug && run.head_sha !== headSha,
    );
    if (stale) return { ok: false, reason: 'stale-head' };
    const otherApp = named.some((run) => {
      if (!run.app || run.head_sha !== headSha) return false;
      return run.app.id !== appId || run.app.slug !== appSlug;
    });
    if (otherApp) return { ok: false, reason: 'receipt-app-mismatch' };
    return { ok: false, reason: 'receipt-check-missing' };
  }
  let latest = identity[0];
  for (const run of identity) {
    if (typeof run.id !== 'number' || typeof latest.id !== 'number') {
      return { ok: false, reason: 'receipt-check-missing' };
    }
    if (run.id > latest.id) latest = run;
  }
  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    return { ok: false, reason: 'receipt-check-not-success' };
  }
  return {
    ok: true,
    url: typeof latest.html_url === 'string' ? latest.html_url : '',
    checkRunId: latest.id,
  };
}

/**
 * One current APPROVED review from an account that is neither the PR author
 * nor the review controller App. Author self-approval does not count.
 * Reviews use the normalized discussion shape from fetchPrDiscussion.
 */
function verifyIndependentApproval({ authorLogin, appSlug, reviews }) {
  if (typeof authorLogin !== 'string' || authorLogin.length === 0) {
    return { ok: false, reason: 'missing-author' };
  }
  if (!validAppSlug(appSlug)) return { ok: false, reason: 'missing-app-slug' };
  const appBot = `${appSlug}[bot]`;
  const latest = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const login = review && review.author && review.author.login;
    if (typeof login !== 'string' || login.length === 0) continue;
    const submitted = typeof review.submittedAt === 'string' ? review.submittedAt : '';
    const prev = latest.get(login);
    if (!prev || submitted >= prev.submittedAt) latest.set(login, review);
  }
  for (const review of latest.values()) {
    const login = review.author.login;
    if (sameLogin(login, authorLogin) || sameLogin(login, appBot)) continue;
    if (review.state === 'APPROVED') return { ok: true, reviewer: login };
  }
  return { ok: false, reason: 'no-independent-approval' };
}

/** Check runs recorded on one commit. Injectable ghImpl for tests. */
function fetchCommitCheckRuns(sha, repo, ghImpl) {
  const run =
    ghImpl ||
    ((args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        timeout: 60000,
        maxBuffer: 8 * 1024 * 1024,
      }));
  const endpoint = `repos/${repo || '{owner}/{repo}'}/commits/${sha}/check-runs?per_page=100`;
  const pages = JSON.parse(run(['api', endpoint, '--paginate', '--slurp']));
  if (!Array.isArray(pages)) throw new Error('invalid check-run response');
  const runs = [];
  for (const page of pages) {
    if (!page || !Array.isArray(page.check_runs)) throw new Error('invalid check-run page');
    for (const item of page.check_runs) runs.push(item);
  }
  if (runs.length >= 1000) throw new Error('check-run list ceiling');
  return runs;
}

/**
 * Receipt and independent-review evidence for one head. File classification
 * always comes from the supplied list. Check runs are fetched only when the
 * App id and slug are configured.
 */
function buildReceiptAdmission({ headSha, authorLogin, reviews, files, repo, ghImpl }, env = process.env) {
  const classified = reviewAdmission(files);
  const config = readReceiptControllerConfig(env);
  if (!config) {
    return {
      receiptVerification: { ok: false, reason: 'receipt-not-configured' },
      independentApproval: { ok: false, reason: 'receipt-not-configured' },
      sensitive: classified.sensitive,
    };
  }
  if (!config.ok) {
    return {
      receiptVerification: { ok: false, reason: 'receipt-controller-config-invalid' },
      independentApproval: { ok: false, reason: 'receipt-controller-config-invalid' },
      sensitive: classified.sensitive,
    };
  }
  let receiptVerification = { ok: false, reason: 'receipt-check-lookup-failed' };
  try {
    const checkRuns = fetchCommitCheckRuns(headSha, repo, ghImpl);
    receiptVerification = verifyAppReceiptCheck({
      headSha,
      checkRuns,
      appId: config.appId,
      appSlug: config.appSlug,
    });
  } catch {
    receiptVerification = { ok: false, reason: 'receipt-check-lookup-failed' };
  }
  return {
    receiptVerification,
    independentApproval: verifyIndependentApproval({
      authorLogin,
      appSlug: config.appSlug,
      reviews,
    }),
    sensitive: classified.sensitive,
  };
}

/**
 * Owner SSHSIG remains a full grant, including on sensitive paths.
 * An App receipt grants non-sensitive paths. Sensitive paths need that
 * receipt and an independent approval. A live REQUEST-CHANGES still holds.
 */
function decideReviewGate({
  verdict,
  labels = [],
  ownerVerification = { ok: false },
  receiptVerification = { ok: false },
  independentApproval = { ok: false },
  sensitive = false,
}) {
  if (verdict && verdict.status === 'hold') {
    return { action: 'hold', kind: 'request-changes', reviewer: verdict.reviewer, timestamp: verdict.timestamp };
  }
  const requested = labels.some((label) => SEC_REVIEW_LABELS.has(label));
  if (requested && ownerVerification.ok === true) {
    return { action: 'clear', kind: 'owner-signature', url: ownerVerification.url };
  }
  if (receiptVerification.ok === true && sensitive !== true) {
    return { action: 'clear', kind: 'app-receipt', url: receiptVerification.url };
  }
  if (receiptVerification.ok === true && sensitive === true && independentApproval.ok === true) {
    return {
      action: 'clear',
      kind: 'app-receipt-and-review',
      url: receiptVerification.url,
      reviewer: independentApproval.reviewer,
    };
  }
  if (receiptVerification.ok === true && sensitive === true) {
    return {
      action: 'hold',
      kind: 'sensitive-needs-independent-review',
      reason: 'app-receipt-without-independent-review',
    };
  }
  return {
    action: 'hold',
    kind: 'no-owner-signature',
    reason: ownerVerification.reason || (requested ? 'missing-owner-signature' : 'missing-request-label'),
  };
}

/** REST pagination supplies complete discussion history, or throws closed. */
function fetchPrDiscussion(prNumber, repo, ghImpl = gh) {
  function list(kind) {
    const endpoint = kind === 'comments' ? `issues/${prNumber}/comments` : `pulls/${prNumber}/reviews`;
    const pages = JSON.parse(ghImpl(['api', `repos/${repo}/${endpoint}?per_page=100`, '--paginate', '--slurp']));
    if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) throw new Error('invalid paginated discussion response');
    const rows = pages.flat();
    if (rows.length > 1000 || rows.some((row) => !row || typeof row.body !== 'string')) throw new Error('unbounded or invalid discussion response');
    return rows.map((row) => ({
      body: row.body,
      url: row.html_url,
      author: { login: row.user?.login || '' },
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      state: typeof row.state === 'string' ? row.state : '',
    }));
  }
  return { comments: list('comments'), reviews: list('reviews') };
}

function verifyPrOwnerRecord(data, prNumber, repo, discussion, allowedSigners = process.env.REVEALFLEET_OVERRIDE_SIGNERS || '', verifyImpl, admission) {
  const verdict = evaluateGuardrail2({ ...discussion, authorLogin: data.author?.login || '' });
  if (verdict.status === 'hold') return decideReviewGate({ verdict });
  const labels = (data.labels || []).map((label) => typeof label === 'string' ? label : label.name);
  const receiptVerification = admission && admission.receiptVerification ? admission.receiptVerification : { ok: false };
  const independentApproval = admission && admission.independentApproval ? admission.independentApproval : { ok: false };
  const sensitive = Boolean(admission && admission.sensitive);
  if (!labels.some((label) => SEC_REVIEW_LABELS.has(label))) {
    return decideReviewGate({
      verdict,
      labels,
      ownerVerification: { ok: false, reason: 'missing-request-label' },
      receiptVerification,
      independentApproval,
      sensitive,
    });
  }
  const verifier = verifyImpl || resolveGatesModule()?.verifyOwnerOverrideComments;
  if (typeof verifier !== 'function') throw new Error('shared owner-signature verifier unavailable');
  const ownerVerification = verifier({ comments: discussion.comments, allowedSigners, expected: { repo, pr: Number(prNumber), head: data.headRefOid, gate: 'sec-review' } });
  return decideReviewGate({ verdict, labels, ownerVerification, receiptVerification, independentApproval, sensitive });
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
      let admission;
      if (readReceiptControllerConfig()) {
        let files;
        try {
          files = fetchPrFiles(number, repo, ghImpl);
        } catch {
          files = Array.from({ length: MAX_CLASSIFIABLE_FILES }, () => 'unreadable');
        }
        admission = buildReceiptAdmission({
          headSha: data.headRefOid,
          authorLogin: data.author?.login || '',
          reviews: discussion.reviews,
          files,
          repo,
          ghImpl,
        });
      }
      const decision = verifyPrOwnerRecord(data, number, repo, discussion, options.allowedSigners ?? undefined, options.verifyImpl, admission);
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
    const files = fetchPrFiles(prNumber, target);
    const classified = reviewAdmission(files);
    if (!classified.gated) {
      process.stdout.write(`PR #${prNumber}: no security-sensitive or sensitive files touched. No review gate.\n`);
      process.exitCode = 0;
      return;
    }
    const discussion = fetchPrDiscussion(prNumber, target);
    const receiptAdmission = buildReceiptAdmission({
      headSha: data.headRefOid,
      authorLogin: data.author?.login || '',
      reviews: discussion.reviews,
      files,
      repo: target,
    });
    const decision = verifyPrOwnerRecord(data, prNumber, target, discussion, undefined, undefined, receiptAdmission);
    if (decision.action === 'clear') {
      if (decision.kind === 'app-receipt') {
        process.stdout.write(`PR #${prNumber}: verified exact-head RevealUI Receipt check from the review controller App (${decision.url || 'check run'}).\n`);
      } else if (decision.kind === 'app-receipt-and-review') {
        process.stdout.write(`PR #${prNumber}: verified exact-head RevealUI Receipt check and an independent approval (${decision.reviewer || 'reviewer'}).\n`);
      } else {
        process.stdout.write(`PR #${prNumber}: verified exact-head owner sec-review signature (${decision.url || 'recorded comment'}).\n`);
      }
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
    const door = classified.sensitive
      ? 'an owner SSHSIG, or a passing exact-head RevealUI Receipt check from the review controller App plus an approving review from an account other than the PR author and the App'
      : 'an owner SSHSIG, or a passing exact-head RevealUI Receipt check from the review controller App';
    process.stderr.write(`HOLD: PR #${prNumber} requires ${door} (${decision.reason || decision.kind}). Labels alone cannot clear it.\n`);
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
  const admission = reviewAdmission(files);
  if (!admission.gated) {
    process.stdout.write(
      `Current branch vs ${base}: no security-sensitive or sensitive files. No review gate.\n`,
    );
    process.exit(0);
  }
  const touched = [
    ...admission.security,
    ...admission.sensitiveHits.map((hit) => hit.file),
  ];
  const requirement = admission.sensitive
    ? 'an exact-head owner SSHSIG, or a passing RevealUI Receipt check from the review controller App plus an independent approval'
    : 'an exact-head owner SSHSIG, or a passing RevealUI Receipt check from the review controller App';
  process.stderr.write(
    `Current branch is ${admission.sensitive ? 'SENSITIVE' : 'SECURITY-SENSITIVE'} (vs ${base}). Touched: ${[...new Set(touched)].join(', ')}\n` +
      `   The PR will need ${requirement} before merge.\n`,
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
  SENSITIVE_PATH_CLASSES,
  RECEIPT_CHECK_NAME,
  RECEIPT_APP_ID_VAR,
  RECEIPT_APP_SLUG_VAR,
  classifyFiles,
  classifySensitiveFiles,
  reviewAdmission,
  decideReviewGate,
  verifyAppReceiptCheck,
  verifyIndependentApproval,
  readReceiptControllerConfig,
  buildReceiptAdmission,
  fetchCommitCheckRuns,
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
