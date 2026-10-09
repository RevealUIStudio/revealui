import { type GitHubAppClient, GitHubAppError } from './github-app.js';
import type { ClaimedWebhook } from './inbox.js';
import { fetchPullRequestSnapshot, type PullRequestSnapshot } from './snapshot.js';
import { matchesTrustedReviewBinding, trustedReviewBinding } from './trusted-review-binding.js';
import {
  REVIEW_CHECKLIST,
  REVIEW_INSTRUCTIONS,
  REVIEW_LENSES,
  REVIEW_MAX_ATTEMPTS,
  REVIEW_MIN_CONFIDENCE,
  REVIEW_SCHEMA,
} from './trusted-review-contract.js';
import type { WebhookHandler } from './worker.js';

const MAX_MODEL_INPUT_BYTES = 512 * 1024;
const MAX_MODEL_RESPONSE_BYTES = 64 * 1024;
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export interface TrustedReviewerConfig {
  repositoryId: number;
  reviewer: { id: number; login: string };
  policyVersion: string;
  model: string;
}

export interface ReviewDecision {
  verdict: 'approve' | 'request_changes';
  summary: string;
  findings: string[];
}

export class TrustedReviewerWebhookHandler implements WebhookHandler {
  constructor(
    private readonly github: GitHubAppClient,
    private readonly config: TrustedReviewerConfig,
    private readonly review: (snapshot: PullRequestSnapshot) => Promise<ReviewDecision>,
  ) {}

  async process(webhook: ClaimedWebhook): Promise<void> {
    if (
      webhook.repositoryId !== this.config.repositoryId ||
      webhook.repositoryId !== this.github.repositoryId
    )
      throw new GitHubAppError('repository_scope_mismatch');
    if (
      webhook.eventName !== 'pull_request' ||
      !['opened', 'synchronize', 'reopened', 'ready_for_review'].includes(
        String(webhook.payload.action),
      )
    )
      return;
    const pr = webhook.payload.pull_request;
    if (
      typeof pr !== 'object' ||
      pr === null ||
      !('number' in pr) ||
      !Number.isSafeInteger(pr.number) ||
      Number(pr.number) <= 0
    )
      throw new GitHubAppError('invalid_pull_request_event');
    await this.reviewPullRequest(Number(pr.number));
  }

  async reviewPullRequest(number: number): Promise<void> {
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new Error('invalid pull request number');
    const snapshot = await fetchPullRequestSnapshot(this.github, number);
    if (snapshot.state !== 'open' || snapshot.draft) return;
    if (await this.hasBoundReview(number, snapshot)) return;
    const decision = await this.review(snapshot);
    if (!validDecision(decision)) throw new GitHubAppError('invalid_model_review');
    const current = await fetchPullRequestSnapshot(this.github, number);
    if (
      current.state !== 'open' ||
      current.draft ||
      current.headSha !== snapshot.headSha ||
      current.baseSha !== snapshot.baseSha ||
      current.baseRef !== snapshot.baseRef ||
      current.manifest.sha256 !== snapshot.manifest.sha256
    )
      throw new GitHubAppError('pull_request_changed_during_review');
    if (await this.hasBoundReview(number, snapshot)) return;
    const body = JSON.stringify({
      binding: trustedReviewBinding(snapshot, this.config.policyVersion, this.config.model),
      summary:
        decision.verdict === 'approve'
          ? 'Trusted review completed. <!-- guardrail2-verdict: APPROVE -->'
          : 'Trusted review requires changes. <!-- guardrail2-verdict: REQUEST-CHANGES -->',
      findings: decision.verdict === 'approve' ? [] : ['Trusted reviewer requested changes.'],
    });
    const event =
      decision.verdict === 'approve' && decision.findings.length === 0
        ? 'APPROVE'
        : 'REQUEST_CHANGES';
    await this.github.submitPullRequestReview({
      pullNumber: number,
      commitId: snapshot.headSha,
      event,
      body,
      reviewer: this.config.reviewer,
    });
  }

  private async hasBoundReview(number: number, snapshot: PullRequestSnapshot): Promise<boolean> {
    return (await this.github.listPullRequestReviews(number)).some(
      (review) =>
        review.user.id === this.config.reviewer.id &&
        review.user.login === this.config.reviewer.login &&
        review.user.type === 'Bot' &&
        review.commit_id === snapshot.headSha &&
        ['APPROVED', 'CHANGES_REQUESTED'].includes(review.state) &&
        matchesTrustedReviewBinding(
          review.body,
          snapshot,
          this.config.policyVersion,
          this.config.model,
        ),
    );
  }
}

type ReviewInput = {
  snapshot: PullRequestSnapshot;
  apiKey: string;
  projectId: string;
  model: string;
  policyVersion: string;
  fetchImpl?: typeof fetch;
};
interface Assessment {
  verdict: 'approve' | 'request_changes' | 'uncertain';
  summary: string;
  findings: string[];
  confidence: number;
  needs: string[];
  checklist: Record<string, string>;
}

export async function requestStructuredReview(input: ReviewInput): Promise<ReviewDecision> {
  for (const lens of REVIEW_LENSES) {
    let approved = false;
    for (let attempt = 0; attempt < REVIEW_MAX_ATTEMPTS; attempt++) {
      const decision = await requestAssessment(input, lens);
      if (decision.verdict === 'request_changes' || decision.findings.length > 0)
        return {
          verdict: 'request_changes',
          summary: decision.summary,
          findings: decision.findings,
        };
      if (
        decision.verdict === 'approve' &&
        decision.confidence >= REVIEW_MIN_CONFIDENCE &&
        decision.needs.length === 0
      ) {
        approved = true;
        break;
      }
    }
    if (!approved) throw new GitHubAppError('review_model_uncertain');
  }
  return { verdict: 'approve', summary: 'Trusted review completed.', findings: [] };
}

async function requestAssessment(input: ReviewInput, lens: string): Promise<Assessment> {
  if (
    !(
      /^sk-[A-Za-z0-9_-]{16,256}$/.test(input.apiKey) &&
      /^proj_[A-Za-z0-9]{8,128}$/.test(input.projectId) &&
      /^[A-Za-z0-9._-]{1,128}$/.test(input.model)
    )
  )
    throw new GitHubAppError('invalid_model_configuration');
  const changedContent = JSON.stringify({
    binding: trustedReviewBinding(input.snapshot, input.policyVersion, input.model),
    files: input.snapshot.manifest.files,
    content: input.snapshot.content,
  });
  if (Buffer.byteLength(changedContent, 'utf8') > MAX_MODEL_INPUT_BYTES)
    throw new GitHubAppError('review_model_input_limit');
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(OPENAI_RESPONSES_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(180_000),
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'OpenAI-Project': input.projectId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        max_output_tokens: 5000,
        tools: [],
        tool_choice: 'none',
        instructions: `${REVIEW_INSTRUCTIONS}\nReview lens: ${lens}`,
        input: changedContent,
        text: {
          format: {
            type: 'json_schema',
            name: 'revealui_review_decision',
            strict: true,
            schema: REVIEW_SCHEMA,
          },
        },
      }),
    });
  } catch {
    throw new GitHubAppError('review_model_unavailable');
  }
  if (!response.ok) throw new GitHubAppError(`review_model_http_${response.status}`);
  let raw: string;
  try {
    raw = await readBoundedResponse(response);
  } catch (error) {
    if (error instanceof GitHubAppError) throw error;
    throw new GitHubAppError('review_model_unavailable');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_MODEL_RESPONSE_BYTES)
    throw new GitHubAppError('review_model_response_limit');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GitHubAppError('invalid_model_response');
  }
  if (!isRecord(value) || value.status !== 'completed' || !Array.isArray(value.output))
    throw new GitHubAppError('incomplete_model_response');
  if (
    value.output.some(
      (item) => !(isRecord(item) && ['message', 'reasoning'].includes(String(item.type))),
    )
  )
    throw new GitHubAppError('unexpected_model_output');
  const messages = value.output.filter((item) => isRecord(item) && item.type === 'message');
  if (messages.length !== 1) throw new GitHubAppError('invalid_model_response');
  const parts = messages.flatMap((message) =>
    isRecord(message) && Array.isArray(message.content) ? message.content : [],
  );
  if (parts.some((part) => isRecord(part) && part.type === 'refusal'))
    throw new GitHubAppError('model_review_refused');
  if (parts.some((part) => !isRecord(part) || part.type !== 'output_text'))
    throw new GitHubAppError('unexpected_model_output');
  const texts = parts.filter((part) => isRecord(part) && part.type === 'output_text');
  if (texts.length !== 1 || !isRecord(texts[0]) || typeof texts[0].text !== 'string')
    throw new GitHubAppError('invalid_model_response');
  let decision: unknown;
  try {
    decision = JSON.parse(texts[0].text);
  } catch {
    throw new GitHubAppError('invalid_model_response');
  }
  if (!validAssessment(decision)) throw new GitHubAppError('invalid_model_review');
  return decision;
}

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) throw new GitHubAppError('invalid_model_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_MODEL_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GitHubAppError('review_model_response_limit');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validDecision(value: unknown): value is ReviewDecision {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join(',') === 'findings,summary,verdict' &&
    (value.verdict === 'approve' || value.verdict === 'request_changes') &&
    typeof value.summary === 'string' &&
    value.summary.length <= 2000 &&
    Array.isArray(value.findings) &&
    value.findings.length <= 20 &&
    value.findings.every((finding) => typeof finding === 'string' && finding.length <= 2000) &&
    (value.verdict !== 'approve' || value.findings.length === 0)
  );
}

function validAssessment(value: unknown): value is Assessment {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(',') !== 'checklist,confidence,findings,needs,summary,verdict'
  )
    return false;
  if (!['approve', 'request_changes', 'uncertain'].includes(String(value.verdict))) return false;
  if (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 2000)
    return false;
  if (
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  )
    return false;
  for (const list of [value.findings, value.needs]) {
    if (
      !Array.isArray(list) ||
      list.length > 20 ||
      list.some((item) => typeof item !== 'string' || !item.trim() || item.length > 2000)
    )
      return false;
  }
  if (!isRecord(value.checklist) || Object.keys(value.checklist).length !== REVIEW_CHECKLIST.length)
    return false;
  return REVIEW_CHECKLIST.every((_, index) => {
    const evidence = (value.checklist as Record<string, unknown>)[String(index + 1)];
    return typeof evidence === 'string' && evidence.trim().length > 0 && evidence.length <= 2000;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
