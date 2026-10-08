import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { GitHubAppError } from './github-app.js';
import { type ClaimedWebhook, MAX_WEBHOOK_ATTEMPTS, type WebhookInbox } from './inbox.js';

export type WebhookWorkResult =
  | 'idle'
  | 'completed'
  | 'retry-scheduled'
  | 'terminal-failure'
  | 'lease-lost';

const TERMINAL_SNAPSHOT_CODES = new Set([
  'review_file_limit',
  'review_blob_limit',
  'review_content_limit',
  'unsupported_review_file_type',
  'unsafe_review_symlink',
  'dangling_review_symlink',
  'unsupported_review_symlink_target',
  'binary_review_file',
  'non_utf8_review_file',
]);

export interface WebhookHandler {
  process(webhook: ClaimedWebhook): Promise<void>;
}

/** Process one durable delivery. The handler must be idempotent across retries. */
export async function processNextWebhook(input: {
  inbox: Pick<WebhookInbox, 'claimNext' | 'complete' | 'fail' | 'retry'>;
  handler: WebhookHandler;
  leaseDurationMs?: number;
  createLeaseToken?: () => string;
  now?: () => Date;
}): Promise<WebhookWorkResult> {
  const leaseToken = (input.createLeaseToken ?? randomUUID)();
  const claimed = await input.inbox.claimNext(leaseToken, input.leaseDurationMs ?? 60_000);
  if (!claimed) return 'idle';

  try {
    await input.handler.process(claimed);
  } catch (error) {
    if (
      claimed.eventName !== 'receipt_expiration' &&
      error instanceof GitHubAppError &&
      TERMINAL_SNAPSHOT_CODES.has(error.code)
    ) {
      return (await input.inbox.fail(claimed.deliveryId, leaseToken, error.code))
        ? 'terminal-failure'
        : 'lease-lost';
    }
    const now = (input.now ?? (() => new Date()))().getTime();
    const delayMs = Math.min(60 * 60_000, 5_000 * 2 ** Math.min(claimed.attempts - 1, 10));
    const rateReset =
      error instanceof GitHubAppError &&
      error.code === 'github_rate_limited' &&
      Number.isFinite(error.retryAt) &&
      (error.retryAt ?? 0) > now
        ? error.retryAt
        : undefined;
    const retryAt = new Date(rateReset ?? now + delayMs);
    const errorCode =
      error instanceof GitHubAppError && /^[a-z0-9_]{1,64}$/.test(error.code)
        ? error.code
        : 'handler_error';
    const updated = await input.inbox.retry(claimed.deliveryId, leaseToken, errorCode, retryAt);
    if (!updated) return 'lease-lost';
    return claimed.attempts >= MAX_WEBHOOK_ATTEMPTS && claimed.eventName !== 'receipt_expiration'
      ? 'terminal-failure'
      : 'retry-scheduled';
  }

  return (await input.inbox.complete(claimed.deliveryId, leaseToken)) ? 'completed' : 'lease-lost';
}

export async function runWebhookWorker(input: {
  inbox: Pick<WebhookInbox, 'claimNext' | 'complete' | 'fail' | 'retry'>;
  handler: WebhookHandler;
  signal: AbortSignal;
  pollIntervalMs?: number;
}): Promise<void> {
  const pollIntervalMs = input.pollIntervalMs ?? 1_000;
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 60_000)
    throw new Error('invalid poll interval');
  while (!input.signal.aborted) {
    try {
      const result = await processNextWebhook({ inbox: input.inbox, handler: input.handler });
      if (result === 'idle') await delay(pollIntervalMs, undefined, { signal: input.signal });
    } catch {
      if (input.signal.aborted) break;
      await delay(Math.max(pollIntervalMs, 5_000), undefined, { signal: input.signal });
    }
  }
}
