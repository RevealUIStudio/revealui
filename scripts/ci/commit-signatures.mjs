/**
 * Decide whether every commit in a Commits API compare payload is GitHub-verified.
 * The workflow checks this file out from the base commit. It does not check out
 * the pull request.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {unknown} payload Compare two commits response.
 * @returns {{ ok: boolean, reason: string, unverified: { sha: string, reason: string }[] }}
 */
export function evaluateComparePayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'missing-commits', unverified: [] };
  }
  const record = /** @type {{ commits?: unknown, total_commits?: unknown }} */ (payload);
  if (!Array.isArray(record.commits)) {
    return { ok: false, reason: 'missing-commits', unverified: [] };
  }
  if (typeof record.total_commits !== 'number' || record.total_commits !== record.commits.length) {
    return { ok: false, reason: 'partial-range', unverified: [] };
  }

  const unverified = [];
  for (const commit of record.commits) {
    const sha =
      commit && typeof commit.sha === 'string' && commit.sha.length > 0
        ? commit.sha
        : '(missing sha)';
    const verification = commit && commit.commit ? commit.commit.verification : undefined;
    const verified = Boolean(verification) && verification.verified === true;
    if (!verified) {
      const reason =
        verification && typeof verification.reason === 'string' && verification.reason.length > 0
          ? verification.reason
          : 'missing';
      unverified.push({ sha, reason });
    }
  }
  if (unverified.length > 0) return { ok: false, reason: 'unverified', unverified };
  return { ok: true, reason: 'ok', unverified: [] };
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    console.error('::error::Commits compare payload was not JSON');
    process.exit(1);
  }
  const result = evaluateComparePayload(payload);
  if (!result.ok) {
    if (result.reason === 'partial-range') {
      console.error(
        '::error::Compare payload did not include every commit in the range. Refusing to pass on a partial list.',
      );
    } else if (result.reason === 'missing-commits') {
      console.error('::error::Compare payload has no commits array.');
    } else {
      for (const item of result.unverified) {
        console.error(`::error::Commit ${item.sha} is not GitHub-verified (${item.reason})`);
      }
    }
    process.exit(1);
  }
  const count = Array.isArray(payload.commits) ? payload.commits.length : 0;
  console.log(`GitHub-verified commits: ${count}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
