import { createPrivateKey, createSign } from 'node:crypto';
import { parseReviewReceiptEnvelope } from '@revealui/security/review-receipt';
import { GITHUB_INSTALLATION_PERMISSIONS } from './github-app-policy.js';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_BLOB_BYTES = 256 * 1024;
const MAX_PAGES = 30;

function normalizeAppPrivateKey(value: string): string {
  const pem = value.replace(/\\n/g, '\n').trim();
  if (pem.includes('\n')) return pem;

  // Secret editors can collapse PEM line breaks into spaces. Restore only a
  // complete, recognized private-key envelope; crypto still validates the key.
  const label = (['RSA PRIVATE KEY', 'PRIVATE KEY'] as const).find((candidate) =>
    pem.startsWith(`-----BEGIN ${candidate}-----`),
  );
  if (!label) return pem;
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!pem.endsWith(end)) return pem;
  const body = pem.slice(begin.length, -end.length).trim();
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) return pem;
  return `${begin}\n${body.replace(/\s+/g, '')}\n${end}`;
}

export interface GitHubAppConfig {
  appId: number;
  installationId: number;
  repositoryId: number;
  repositoryFullName: string;
  privateKey: string;
}

export interface PullRequestFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  previous_filename?: string;
  sha: string | null;
  additions: number;
  deletions: number;
  changes: number;
}

export interface GitTreeEntry {
  path: string;
  mode: '040000' | '100644' | '100755' | '120000' | '160000';
  type: 'tree' | 'blob' | 'commit';
  sha: string;
  size?: number;
}

export interface GitHubCheckRun {
  id: number;
  check_suite: { id: number };
  name: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  completed_at: string | null;
  external_id?: string | null;
  app: { id: number; slug: string };
}

export interface ReceiptCheckRunResult {
  id: number;
  name: 'RevealUI Receipt';
  head_sha: string;
  status: 'completed';
  conclusion: 'success' | 'failure';
  external_id: string;
}

export interface GitHubBlob {
  sha: string;
  size: number;
  content: string;
  encoding: 'base64';
}

export interface GitHubPullRequestReviewComment {
  id: number;
  pull_request_review_id: number;
  path: string;
  line: number | null;
  commit_id: string;
  body: string;
  user: { id: number; login: string; type: string };
}

export class GitHubAppError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'GitHubAppError';
  }
}

export class GitHubAppClient {
  private readonly key;
  private cachedToken?: { value: string; expiresAt: number };
  private tokenPromise?: Promise<string>;

  constructor(
    private readonly config: GitHubAppConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    if (
      !Number.isSafeInteger(config.appId) ||
      config.appId <= 0 ||
      !Number.isSafeInteger(config.installationId) ||
      config.installationId <= 0 ||
      !Number.isSafeInteger(config.repositoryId) ||
      config.repositoryId <= 0 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repositoryFullName)
    )
      throw new Error('invalid GitHub App configuration');
    try {
      this.key = createPrivateKey(normalizeAppPrivateKey(config.privateKey));
    } catch {
      throw new Error('invalid GitHub App private key');
    }
    if (this.key.asymmetricKeyType !== 'rsa') throw new Error('GitHub App key must be RSA');
  }

  isOwnReceiptCheckRun(value: unknown): boolean {
    return (
      isRecord(value) &&
      value.name === 'RevealUI Receipt' &&
      isRecord(value.app) &&
      value.app.id === this.config.appId
    );
  }

  get repositoryId(): number {
    return this.config.repositoryId;
  }

  async getPullRequest(number: number): Promise<Record<string, unknown>> {
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new Error('invalid pull request number');
    const result = await this.getJson(`/repos/${this.config.repositoryFullName}/pulls/${number}`);
    const base = isRecord(result) && isRecord(result.base) ? result.base : null;
    const baseRepo = base && isRecord(base.repo) ? base.repo : null;
    const head = isRecord(result) && isRecord(result.head) ? result.head : null;
    const headRepo = head && isRecord(head.repo) ? head.repo : null;
    if (
      !isRecord(result) ||
      Number(result.number) !== number ||
      Number(baseRepo?.id) !== this.config.repositoryId ||
      Number(headRepo?.id) !== this.config.repositoryId ||
      typeof head?.sha !== 'string' ||
      typeof base?.sha !== 'string'
    )
      throw new GitHubAppError('invalid_pull_request_response');
    return result;
  }

  async getFreshMergeCandidate(input: {
    pullNumber: number;
    expectedHeadSha: string;
    expectedBaseSha: string;
  }): Promise<{ mergeCommitSha: string; treeSha: string }> {
    const pullRequest = await this.getPullRequest(input.pullNumber);
    const head = isRecord(pullRequest.head) ? pullRequest.head : null;
    const base = isRecord(pullRequest.base) ? pullRequest.base : null;
    if (
      pullRequest.state !== 'open' ||
      pullRequest.draft !== false ||
      pullRequest.mergeable !== true
    )
      throw new GitHubAppError('merge_candidate_unavailable');
    if (head?.sha !== input.expectedHeadSha || base?.sha !== input.expectedBaseSha)
      throw new GitHubAppError('merge_candidate_pull_request_changed');
    if (
      typeof pullRequest.merge_commit_sha !== 'string' ||
      !/^[a-f0-9]{40,64}$/.test(pullRequest.merge_commit_sha)
    )
      throw new GitHubAppError('merge_candidate_unavailable');
    const mergeCommitSha = pullRequest.merge_commit_sha;
    return { mergeCommitSha, treeSha: await this.getCommitTree(mergeCommitSha) };
  }

  async listPullRequestFiles(number: number): Promise<PullRequestFile[]> {
    const files = await this.getPaginated(
      `/repos/${this.config.repositoryFullName}/pulls/${number}/files`,
    );
    if (files.length >= 3000) throw new GitHubAppError('pull_request_file_limit');
    return files.map((value) => {
      if (!isRecord(value)) throw new GitHubAppError('invalid_pull_request_file');
      const statuses = [
        'added',
        'removed',
        'modified',
        'renamed',
        'copied',
        'changed',
        'unchanged',
      ];
      if (
        typeof value.filename !== 'string' ||
        value.filename.length === 0 ||
        value.filename.length > 4096 ||
        typeof value.status !== 'string' ||
        !statuses.includes(value.status) ||
        !(
          value.sha === null ||
          (typeof value.sha === 'string' && /^[a-f0-9]{40,64}$/.test(value.sha))
        ) ||
        !Number.isSafeInteger(value.additions) ||
        !Number.isSafeInteger(value.deletions) ||
        !Number.isSafeInteger(value.changes) ||
        (value.previous_filename !== undefined && typeof value.previous_filename !== 'string')
      )
        throw new GitHubAppError('invalid_pull_request_file');
      return value as unknown as PullRequestFile;
    });
  }

  async getCommitTree(sha: string): Promise<string> {
    if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('invalid commit SHA');
    const result = await this.getJson(
      `/repos/${this.config.repositoryFullName}/git/commits/${sha}`,
    );
    if (
      !(isRecord(result) && isRecord(result.tree)) ||
      typeof result.tree.sha !== 'string' ||
      !/^[a-f0-9]{40,64}$/.test(result.tree.sha)
    )
      throw new GitHubAppError('invalid_commit_tree_response');
    return result.tree.sha;
  }

  async getTree(treeSha: string): Promise<GitTreeEntry[]> {
    if (!/^[a-f0-9]{40,64}$/.test(treeSha)) throw new Error('invalid tree SHA');
    const result = await this.getJson(
      `/repos/${this.config.repositoryFullName}/git/trees/${treeSha}?recursive=1`,
    );
    if (!isRecord(result) || result.truncated !== false || !Array.isArray(result.tree))
      throw new GitHubAppError('incomplete_git_tree');
    return result.tree.map((value) => {
      if (
        !isRecord(value) ||
        typeof value.path !== 'string' ||
        value.path.length === 0 ||
        !['040000', '100644', '100755', '120000', '160000'].includes(String(value.mode)) ||
        !['tree', 'blob', 'commit'].includes(String(value.type)) ||
        typeof value.sha !== 'string' ||
        !/^[a-f0-9]{40,64}$/.test(value.sha)
      )
        throw new GitHubAppError('invalid_git_tree_entry');
      return value as unknown as GitTreeEntry;
    });
  }

  async getBlob(blobSha: string): Promise<GitHubBlob> {
    if (!/^[a-f0-9]{40,64}$/.test(blobSha)) throw new Error('invalid blob SHA');
    const result = await this.getJson(
      `/repos/${this.config.repositoryFullName}/git/blobs/${blobSha}`,
    );
    if (
      !isRecord(result) ||
      result.sha !== blobSha ||
      !Number.isSafeInteger(result.size) ||
      Number(result.size) < 0 ||
      Number(result.size) > MAX_BLOB_BYTES ||
      result.encoding !== 'base64' ||
      typeof result.content !== 'string'
    )
      throw new GitHubAppError('invalid_or_oversized_git_blob');
    return result as unknown as GitHubBlob;
  }

  async listCheckRuns(sha: string): Promise<GitHubCheckRun[]> {
    if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('invalid commit SHA');
    const runs = await this.getPaginated(
      `/repos/${this.config.repositoryFullName}/commits/${sha}/check-runs?filter=latest`,
      'check_runs',
    );
    if (runs.length >= MAX_PAGES * 100) throw new GitHubAppError('check_run_limit');
    return runs.map((value) => {
      if (!isRecord(value)) throw new GitHubAppError('invalid_check_run');
      const app = isRecord(value.app) ? value.app : null;
      const suite = isRecord(value.check_suite) ? value.check_suite : null;
      if (
        !(Number.isSafeInteger(value.id) && suite && Number.isSafeInteger(suite.id)) ||
        typeof value.name !== 'string' ||
        value.name.length === 0 ||
        value.name.length > 200 ||
        value.head_sha !== sha ||
        typeof value.status !== 'string' ||
        !(value.conclusion === null || typeof value.conclusion === 'string') ||
        !(value.completed_at === null || typeof value.completed_at === 'string') ||
        !(
          value.external_id === undefined ||
          value.external_id === null ||
          typeof value.external_id === 'string'
        ) ||
        (typeof value.external_id === 'string' && value.external_id.length > 255) ||
        (typeof value.completed_at === 'string' &&
          !Number.isFinite(Date.parse(value.completed_at))) ||
        !app ||
        !Number.isSafeInteger(app.id) ||
        typeof app.slug !== 'string'
      )
        throw new GitHubAppError('invalid_check_run');
      return {
        id: Number(value.id),
        check_suite: { id: Number(suite.id) },
        name: value.name,
        head_sha: value.head_sha,
        status: value.status,
        conclusion: value.conclusion,
        completed_at: value.completed_at,
        ...(value.external_id === undefined ? {} : { external_id: value.external_id }),
        app: { id: Number(app.id), slug: app.slug },
      };
    });
  }

  async upsertReceiptCheckRun(input: {
    headSha: string;
    externalId: string;
    eligible: boolean;
    receiptEnvelope?: string;
  }): Promise<ReceiptCheckRunResult> {
    if (!/^[a-f0-9]{40,64}$/.test(input.headSha)) throw new Error('invalid commit SHA');
    if (!/^[A-Za-z0-9._:-]{1,255}$/.test(input.externalId))
      throw new Error('invalid receipt check external ID');
    if (input.eligible && !input.receiptEnvelope)
      throw new Error('eligible receipt check requires a signed envelope');
    if (input.receiptEnvelope) parseReviewReceiptEnvelope(input.receiptEnvelope);
    const conclusion = input.eligible ? 'success' : 'failure';
    const output = input.eligible
      ? {
          title: 'Receipt evidence is ready',
          summary: `Exact-head review and required check evidence passed receipt evaluation.\n\n<!-- revealui-review-receipt:v1 -->\n${input.receiptEnvelope}`,
        }
      : {
          title: 'Receipt evidence is not ready',
          summary: 'Receipt evaluation did not pass. Existing branch protection remains in force.',
        };
    const currentRuns = await this.listCheckRuns(input.headSha);
    const matches = currentRuns.filter(
      (run) =>
        run.name === 'RevealUI Receipt' &&
        run.app.id === this.config.appId &&
        run.external_id === input.externalId,
    );
    if (matches.length > 1) throw new GitHubAppError('receipt_check_run_ambiguous');
    const existing = matches[0];
    if (existing?.status === 'completed' && existing.conclusion === conclusion)
      return {
        id: existing.id,
        name: 'RevealUI Receipt',
        head_sha: input.headSha,
        status: 'completed',
        conclusion,
        external_id: input.externalId,
      };
    const body = {
      name: 'RevealUI Receipt',
      external_id: input.externalId,
      status: 'completed',
      conclusion,
      completed_at: new Date(this.now()).toISOString(),
      output,
    };
    const result = existing
      ? await this.patchJson(
          `/repos/${this.config.repositoryFullName}/check-runs/${existing.id}`,
          body,
        )
      : await this.postJson(`/repos/${this.config.repositoryFullName}/check-runs`, {
          ...body,
          head_sha: input.headSha,
        });
    if (
      !(isRecord(result) && Number.isSafeInteger(result.id)) ||
      result.name !== 'RevealUI Receipt' ||
      result.head_sha !== input.headSha ||
      result.status !== 'completed' ||
      result.conclusion !== conclusion ||
      result.external_id !== input.externalId
    )
      throw new GitHubAppError('invalid_receipt_check_run_response');
    return {
      id: Number(result.id),
      name: 'RevealUI Receipt',
      head_sha: input.headSha,
      status: 'completed',
      conclusion,
      external_id: input.externalId,
    };
  }

  async listPullRequestReviewComments(
    pullNumber: number,
    reviewId: number,
    expectedHeadSha: string,
  ): Promise<GitHubPullRequestReviewComment[]> {
    if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0)
      throw new Error('invalid pull request number');
    if (!Number.isSafeInteger(reviewId) || reviewId <= 0) throw new Error('invalid review id');
    if (!/^[a-f0-9]{40,64}$/.test(expectedHeadSha)) throw new Error('invalid commit SHA');
    const comments = await this.getPaginated(
      `/repos/${this.config.repositoryFullName}/pulls/${pullNumber}/reviews/${reviewId}/comments`,
    );
    if (comments.length > MAX_PAGES * 100) throw new GitHubAppError('review_comment_limit');
    return comments.map((value) => {
      const user = isRecord(value) && isRecord(value.user) ? value.user : null;
      if (
        !(isRecord(value) && Number.isSafeInteger(value.id)) ||
        Number(value.id) <= 0 ||
        value.pull_request_review_id !== reviewId ||
        typeof value.path !== 'string' ||
        value.path.length === 0 ||
        value.path.length > 4096 ||
        !(value.line === null || (Number.isSafeInteger(value.line) && Number(value.line) > 0)) ||
        value.commit_id !== expectedHeadSha ||
        typeof value.body !== 'string' ||
        Buffer.byteLength(value.body, 'utf8') > 64 * 1024 ||
        !user ||
        !Number.isSafeInteger(user.id) ||
        Number(user.id) <= 0 ||
        typeof user.login !== 'string' ||
        typeof user.type !== 'string'
      )
        throw new GitHubAppError('invalid_review_comment');
      return {
        id: Number(value.id),
        pull_request_review_id: reviewId,
        path: value.path,
        line: value.line as number | null,
        commit_id: value.commit_id,
        body: value.body,
        user: { id: Number(user.id), login: user.login, type: user.type },
      };
    });
  }

  private async getPaginated(path: string, resultField?: string): Promise<unknown[]> {
    const values: unknown[] = [];
    let expectedCount: number | undefined;
    let next: URL | undefined = new URL(path, GITHUB_API);
    next.searchParams.set('per_page', '100');
    for (let page = 0; next && page < MAX_PAGES; page += 1) {
      const response = await this.request(next);
      let pageValues: unknown;
      if (resultField) {
        if (!(isRecord(response.body) && Array.isArray(response.body[resultField])))
          throw new GitHubAppError('invalid_paginated_response');
        if (page === 0) {
          if (
            !Number.isSafeInteger(response.body.total_count) ||
            Number(response.body.total_count) < 0
          )
            throw new GitHubAppError('invalid_paginated_response');
          expectedCount = Number(response.body.total_count);
        }
        pageValues = response.body[resultField];
      } else {
        pageValues = response.body;
      }
      if (!Array.isArray(pageValues)) throw new GitHubAppError('invalid_paginated_response');
      values.push(...pageValues);
      next = response.next;
    }
    if (next) throw new GitHubAppError('pagination_limit');
    if (expectedCount !== undefined && expectedCount !== values.length)
      throw new GitHubAppError('incomplete_paginated_response');
    return values;
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.request(new URL(path, GITHUB_API));
    return response.body;
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.request(new URL(path, GITHUB_API), {
      method: 'POST',
      body,
    });
    return response.body;
  }

  private async patchJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.request(new URL(path, GITHUB_API), {
      method: 'PATCH',
      body,
    });
    return response.body;
  }

  private async request(
    url: URL,
    options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {},
  ): Promise<{ body: unknown; next?: URL }> {
    const repositoryPath = `/repos/${this.config.repositoryFullName}/`;
    if (url.origin !== GITHUB_API || !url.pathname.startsWith(repositoryPath))
      throw new GitHubAppError('api_url_out_of_scope');
    const token = await this.installationToken();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method ?? 'GET',
        redirect: 'error',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          'x-github-api-version': API_VERSION,
          'user-agent': 'RevealFleet-Review-Controller',
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new GitHubAppError('github_api_unavailable');
    }
    if (!response.ok) throw new GitHubAppError(`github_http_${response.status}`);
    let raw: string;
    try {
      raw = await response.text();
    } catch {
      throw new GitHubAppError('github_response_unavailable');
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES)
      throw new GitHubAppError('github_response_too_large');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new GitHubAppError('invalid_github_json');
    }
    const next = parseNextLink(response.headers.get('link'), url.pathname);
    return { body, ...(next ? { next } : {}) };
  }

  private async installationToken(): Promise<string> {
    const now = this.now();
    if (this.cachedToken && this.cachedToken.expiresAt - 60_000 > now)
      return this.cachedToken.value;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = this.createInstallationToken();
    try {
      const token = await this.tokenPromise;
      return token;
    } finally {
      this.tokenPromise = undefined;
    }
  }

  private async createInstallationToken(): Promise<string> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const jwt = createAppJwt(this.config.appId, this.key, nowSeconds);
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${GITHUB_API}/app/installations/${this.config.installationId}/access_tokens`,
        {
          method: 'POST',
          redirect: 'error',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${jwt}`,
            'content-type': 'application/json',
            'x-github-api-version': API_VERSION,
            'user-agent': 'RevealFleet-Review-Controller',
          },
          body: JSON.stringify({
            repository_ids: [this.config.repositoryId],
            permissions: GITHUB_INSTALLATION_PERMISSIONS,
          }),
        },
      );
    } catch {
      throw new GitHubAppError('github_token_unavailable');
    }
    if (!response.ok) throw new GitHubAppError(`github_token_http_${response.status}`);
    let body: unknown;
    try {
      body = JSON.parse(await response.text());
    } catch {
      throw new GitHubAppError('invalid_github_token_response');
    }
    if (
      !isRecord(body) ||
      typeof body.token !== 'string' ||
      body.token.length < 20 ||
      typeof body.expires_at !== 'string' ||
      !Number.isFinite(Date.parse(body.expires_at))
    )
      throw new GitHubAppError('invalid_github_token_response');
    const expiresAt = Date.parse(body.expires_at);
    if (expiresAt - this.now() <= 60_000) throw new GitHubAppError('short_github_token_lifetime');
    this.cachedToken = { value: body.token, expiresAt };
    return body.token;
  }
}

function createAppJwt(
  appId: number,
  key: ReturnType<typeof createPrivateKey>,
  nowSeconds: number,
): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iat: nowSeconds - 60,
    exp: nowSeconds + 8 * 60,
    iss: String(appId),
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(key).toString('base64url')}`;
}

function parseNextLink(linkHeader: string | null, expectedPath: string): URL | undefined {
  if (!linkHeader) return undefined;
  for (const segment of linkHeader.split(',')) {
    const match = segment.match(/^\s*<([^>]+)>\s*;\s*rel="next"\s*$/);
    if (!match?.[1]) continue;
    let next: URL;
    try {
      next = new URL(match[1]);
    } catch {
      throw new GitHubAppError('invalid_pagination_link');
    }
    if (next.origin !== GITHUB_API || next.pathname !== expectedPath)
      throw new GitHubAppError('pagination_link_out_of_scope');
    return next;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
