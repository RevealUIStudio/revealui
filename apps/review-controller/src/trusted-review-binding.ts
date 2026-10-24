import type { PullRequestSnapshot } from './snapshot.js';

export interface TrustedReviewBinding {
  version: 1;
  repositoryId: number;
  pullRequest: number;
  headSha: string;
  baseSha: string;
  manifestSha256: string;
  policyVersion: string;
  model: string;
}

/** A native App review is accepted only for the exact snapshot it evaluated. */
export function trustedReviewBinding(
  snapshot: PullRequestSnapshot,
  policyVersion: string,
  model: string,
): TrustedReviewBinding {
  return {
    version: 1,
    repositoryId: snapshot.repositoryId,
    pullRequest: snapshot.pullRequest,
    headSha: snapshot.headSha,
    baseSha: snapshot.baseSha,
    manifestSha256: snapshot.manifest.sha256,
    policyVersion,
    model,
  };
}

export function matchesTrustedReviewBinding(
  body: string,
  snapshot: PullRequestSnapshot,
  policyVersion: string,
  model: string,
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const expected = trustedReviewBinding(snapshot, policyVersion, model);
  const container = parsed as Record<string, unknown>;
  if (
    Object.keys(container).sort().join(',') !== 'binding,findings,summary' ||
    typeof container.summary !== 'string' ||
    container.summary.length > 2000 ||
    !Array.isArray(container.findings) ||
    container.findings.length > 20 ||
    container.findings.some((finding) => typeof finding !== 'string' || finding.length > 2000) ||
    typeof container.binding !== 'object' ||
    container.binding === null ||
    Array.isArray(container.binding)
  )
    return false;
  const value = container.binding as Record<string, unknown>;
  return (
    Object.keys(value).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, item]) => value[key] === item)
  );
}
