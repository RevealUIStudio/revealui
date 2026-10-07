import { createHash } from 'node:crypto';
import { canonicalReviewReceiptEnvelope } from '@revealui/security/review-receipt';
import type { GitHubAppClient, ReceiptCheckRunResult } from './github-app.js';
import type { WebhookInbox } from './inbox.js';
import type { SignedReceiptStore } from './receipt-store.js';

export interface PublishedReceiptCheck {
  receiptId: string;
  envelopeSha256: string;
  checkRun: ReceiptCheckRunResult;
}

/** Persist immutable signed evidence before publishing its success check. */
export async function persistReceiptThenPublishCheck(input: {
  envelope: Parameters<SignedReceiptStore['append']>[0];
  store: SignedReceiptStore;
  inbox: Pick<WebhookInbox, 'scheduleReceiptExpiration'>;
  installationId: number;
  github: Pick<GitHubAppClient, 'upsertReceiptCheckRun'>;
}): Promise<PublishedReceiptCheck> {
  const receipt = input.envelope.receipt;
  const canonical = canonicalReviewReceiptEnvelope(input.envelope);
  const expectedSha256 = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const stored = await input.store.append(input.envelope);
  if (stored.receiptId !== receipt.receiptId || stored.sha256 !== expectedSha256)
    throw new Error('stored_receipt_identity_mismatch');
  await input.inbox.scheduleReceiptExpiration({
    receiptId: receipt.receiptId,
    repositoryId: receipt.repository.id,
    installationId: input.installationId,
    pullRequest: receipt.pullRequest,
    headSha: receipt.head.sha,
    baseSha: receipt.base.sha,
    expiresAt: new Date(receipt.expiresAt),
  });
  const checkRun = await input.github.upsertReceiptCheckRun({
    headSha: receipt.head.sha,
    externalId: `pr-${receipt.repository.id}-${receipt.pullRequest}`,
    eligible: true,
    receiptEnvelope: canonical,
  });
  if (checkRun.head_sha !== receipt.head.sha || checkRun.conclusion !== 'success')
    throw new Error('published_receipt_check_mismatch');
  return { receiptId: receipt.receiptId, envelopeSha256: stored.sha256, checkRun };
}
