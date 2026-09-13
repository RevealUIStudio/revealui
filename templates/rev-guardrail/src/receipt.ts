import { createHash } from 'node:crypto';
import type { GuardrailReceipt, ReceiptWriter } from './types.js';

const HASH_ALGORITHM = 'sha256';

export function hashArtifact(text: string): string {
  return createHash(HASH_ALGORITHM).update(text, 'utf8').digest('hex');
}

export function createReceipt(
  input: Omit<GuardrailReceipt, 'contentHash'> & { artifactText: string },
): GuardrailReceipt {
  return {
    actor: input.actor,
    contentHash: hashArtifact(input.artifactText),
    lockId: input.lockId,
    matchedString: input.matchedString,
    outcome: input.outcome,
    pathOrUrl: input.pathOrUrl,
    timestamp: input.timestamp,
  };
}

/**
 * Append-only receipt log. Inspired by governed-run receipts, but local to
 * this template: no Apify coupling and no Vercel Web Analytics.
 */
export function createReceiptLog(): ReceiptWriter {
  const entries: GuardrailReceipt[] = [];
  return {
    get entries(): readonly GuardrailReceipt[] {
      return entries;
    },
    append(receipt: GuardrailReceipt): void {
      entries.push(Object.freeze({ ...receipt }));
    },
  };
}
