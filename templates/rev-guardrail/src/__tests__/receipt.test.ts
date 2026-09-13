import { describe, expect, it } from 'vitest';
import { createReceiptLog, hashArtifact } from '../receipt.js';

describe('REV Guardrail receipts', () => {
  it('appends receipts without mutating earlier entries', () => {
    const log = createReceiptLog();
    log.append({
      actor: 'a',
      contentHash: hashArtifact('first'),
      lockId: 'overclaim',
      matchedString: 'SOC 2 certified',
      outcome: 'blocked',
      pathOrUrl: 'a.md',
      timestamp: '2026-09-13T00:00:00.000Z',
    });
    const first = log.entries[0];
    log.append({
      actor: 'b',
      contentHash: hashArtifact('second'),
      lockId: 'snapshot_before_checkpoint',
      matchedString: 'checkpoint',
      outcome: 'required',
      pathOrUrl: 'b.md',
      timestamp: '2026-09-13T00:00:01.000Z',
    });

    expect(log.entries).toHaveLength(2);
    expect(log.entries[0]).toEqual(first);
    expect(Object.isFrozen(log.entries[0])).toBe(true);
    expect(log.entries[1]?.lockId).toBe('snapshot_before_checkpoint');
  });

  it('hashes artifact bytes with sha256 hex', () => {
    const hash = hashArtifact('RevealUI Studio is SOC 2 certified');
    expect(hash).toBe(hashArtifact('RevealUI Studio is SOC 2 certified'));
    expect(hash).not.toBe(hashArtifact('other'));
    expect(hash.length).toBe(64);
  });
});
