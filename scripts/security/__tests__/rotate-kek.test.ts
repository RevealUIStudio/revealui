import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { encryptWithKey } from '../../../packages/db/src/crypto';
import {
  type DataSource,
  planRotation,
  rotateSurface,
  type Surface,
  type SurfaceRow,
} from '../rotate-kek';

const KEY_OLD = randomBytes(32);
const KEY_NEW = randomBytes(32);

// ============================================================================
// In-memory DataSource — tests exercise the rotation against this fake
// rather than a live Postgres. Mirrors the contract PostgresDataSource
// implements in production.
// ============================================================================

class InMemorySource implements DataSource {
  private store: Record<Surface, Map<string, string | null>> = {
    'api-keys': new Map(),
    mfa: new Map(),
  };
  // Optional crash-injection: throws on the Nth update if set.
  public crashOnUpdate?: number;
  private updateCount = 0;

  seed(surface: Surface, rows: Array<{ id: string; value: string | null }>): void {
    for (const row of rows) this.store[surface].set(row.id, row.value);
  }

  snapshot(surface: Surface): Array<{ id: string; value: string | null }> {
    return Array.from(this.store[surface].entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => ({ id, value }));
  }

  async count(surface: Surface): Promise<number> {
    return Array.from(this.store[surface].values()).filter((v) => v !== null).length;
  }

  async *iterate(surface: Surface, fromId: string, _batchSize: number): AsyncIterable<SurfaceRow> {
    const sorted = Array.from(this.store[surface].entries())
      .filter(([id, value]) => id > fromId && value !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [id, value] of sorted) yield { id, value };
  }

  async update(surface: Surface, id: string, newValue: string): Promise<void> {
    this.updateCount += 1;
    if (this.crashOnUpdate !== undefined && this.updateCount === this.crashOnUpdate) {
      throw new Error(`simulated crash at update #${this.updateCount}`);
    }
    this.store[surface].set(id, newValue);
  }
}

// ============================================================================
// planRotation — pure decision logic
// ============================================================================

describe('planRotation', () => {
  it('rotates a value encrypted under OLD_KEK', () => {
    const enc = encryptWithKey(KEY_OLD, 'totp-secret');
    const decision = planRotation(enc, KEY_OLD, KEY_NEW, { allowPlaintext: false });
    expect(decision.kind).toBe('rotate');
  });

  it('skips a value already encrypted under NEW_KEK (idempotency)', () => {
    const enc = encryptWithKey(KEY_NEW, 'totp-secret');
    const decision = planRotation(enc, KEY_OLD, KEY_NEW, { allowPlaintext: false });
    expect(decision.kind).toBe('skip-already-new');
  });

  it('errors on an envelope decryptable under neither key', () => {
    const ROGUE = randomBytes(32);
    const enc = encryptWithKey(ROGUE, 'rogue');
    const decision = planRotation(enc, KEY_OLD, KEY_NEW, { allowPlaintext: false });
    expect(decision.kind).toBe('error');
    if (decision.kind === 'error') {
      expect(decision.reason).toMatch(/not decryptable/);
    }
  });

  it('errors on a non-envelope value when allowPlaintext=false (api-keys)', () => {
    const decision = planRotation('JBSWY3DPEHPK3PXP', KEY_OLD, KEY_NEW, {
      allowPlaintext: false,
    });
    expect(decision.kind).toBe('error');
    if (decision.kind === 'error') {
      expect(decision.reason).toMatch(/not in encrypted-envelope format/);
    }
  });

  it('encrypts a non-envelope plaintext value when allowPlaintext=true (mfa rolling migration)', () => {
    const decision = planRotation('JBSWY3DPEHPK3PXP', KEY_OLD, KEY_NEW, {
      allowPlaintext: true,
    });
    expect(decision.kind).toBe('plaintext-encrypt');
  });

  it('rotated value, when re-checked, classifies as skip-already-new (no infinite re-rotate)', () => {
    const original = encryptWithKey(KEY_OLD, 'value');
    const first = planRotation(original, KEY_OLD, KEY_NEW, { allowPlaintext: false });
    if (first.kind !== 'rotate') throw new Error('expected rotate');
    const second = planRotation(first.newValue, KEY_OLD, KEY_NEW, { allowPlaintext: false });
    expect(second.kind).toBe('skip-already-new');
  });

  it('plaintext-encrypted value, when re-checked, classifies as skip-already-new', () => {
    const first = planRotation('legacy-plain', KEY_OLD, KEY_NEW, { allowPlaintext: true });
    if (first.kind !== 'plaintext-encrypt') throw new Error('expected plaintext-encrypt');
    const second = planRotation(first.newValue, KEY_OLD, KEY_NEW, { allowPlaintext: true });
    expect(second.kind).toBe('skip-already-new');
  });

  it('throws-during-encrypt is reported as error (not propagated)', () => {
    const tooShort = Buffer.from('aabb', 'hex'); // 2 bytes, not 32
    const decision = planRotation('plain', KEY_OLD, tooShort, { allowPlaintext: true });
    expect(decision.kind).toBe('error');
  });
});

// ============================================================================
// rotateSurface — DataSource-driven flow
// ============================================================================

describe('rotateSurface', () => {
  it('rotates every row when all rows are under OLD_KEK (api-keys)', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'sk-aaa') },
      { id: '02', value: encryptWithKey(KEY_OLD, 'sk-bbb') },
      { id: '03', value: encryptWithKey(KEY_OLD, 'sk-ccc') },
    ]);

    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });

    expect(counts.scanned).toBe(3);
    expect(counts.rotated).toBe(3);
    expect(counts.skippedAlreadyNew).toBe(0);
    expect(counts.errors).toEqual([]);
    expect(counts.lastId).toBe('03');

    // Every row now decrypts under NEW_KEK
    const after = src.snapshot('api-keys');
    for (const row of after) {
      expect(row.value).toBeTruthy();
      // a fresh planRotation should now classify all as skip-already-new
      if (row.value) {
        const re = planRotation(row.value, KEY_OLD, KEY_NEW, { allowPlaintext: false });
        expect(re.kind).toBe('skip-already-new');
      }
    }
  });

  it('is idempotent: a second pass over already-rotated rows is a no-op', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'sk-1') },
      { id: '02', value: encryptWithKey(KEY_OLD, 'sk-2') },
    ]);

    const first = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });
    expect(first.rotated).toBe(2);

    const second = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });
    expect(second.rotated).toBe(0);
    expect(second.skippedAlreadyNew).toBe(2);
  });

  it('handles mixed state: some rows under OLD, some already under NEW', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'old-1') },
      { id: '02', value: encryptWithKey(KEY_NEW, 'new-1') },
      { id: '03', value: encryptWithKey(KEY_OLD, 'old-2') },
      { id: '04', value: encryptWithKey(KEY_NEW, 'new-2') },
    ]);

    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });

    expect(counts.scanned).toBe(4);
    expect(counts.rotated).toBe(2);
    expect(counts.skippedAlreadyNew).toBe(2);
  });

  it('handles mfa rolling migration: legacy plaintext encrypted in place', async () => {
    const src = new InMemorySource();
    src.seed('mfa', [
      { id: 'u1', value: 'JBSWY3DPEHPK3PXP' }, // legacy plaintext
      { id: 'u2', value: encryptWithKey(KEY_OLD, 'JBSWY3DPEH2222') }, // already encrypted under OLD
      { id: 'u3', value: encryptWithKey(KEY_NEW, 'JBSWY3DPEH3333') }, // already under NEW
      { id: 'u4', value: 'JBSWY3DPEH4444' }, // legacy plaintext
    ]);

    const counts = await rotateSurface(src, 'mfa', KEY_OLD, KEY_NEW, { dryRun: false });

    expect(counts.scanned).toBe(4);
    expect(counts.rotated).toBe(1);
    expect(counts.plaintextEncrypted).toBe(2);
    expect(counts.skippedAlreadyNew).toBe(1);
    expect(counts.errors).toEqual([]);
  });

  it('mfa: null/empty mfa_secret rows do not crash; null filtered upstream, empty counted as skipped', async () => {
    // PostgresDataSource WHERE mfa_secret IS NOT NULL filters NULL rows in
    // the SQL — they never reach rotateSurface. Empty strings pass that
    // filter and reach the row.value === '' branch, counted as
    // skippedNullOrEmpty. The in-memory source mirrors that contract.
    const src = new InMemorySource();
    src.seed('mfa', [
      { id: 'u1', value: encryptWithKey(KEY_OLD, 'secret') },
      { id: 'u2', value: null },
      { id: 'u3', value: '' },
    ]);

    const counts = await rotateSurface(src, 'mfa', KEY_OLD, KEY_NEW, { dryRun: false });

    expect(counts.scanned).toBe(2); // u1 + u3 (u2 filtered upstream)
    expect(counts.rotated).toBe(1); // u1
    expect(counts.skippedNullOrEmpty).toBe(1); // u3 (empty string)
    expect(counts.errors).toEqual([]);
  });

  it('dry-run does not write any updates', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'a') },
      { id: '02', value: encryptWithKey(KEY_OLD, 'b') },
    ]);
    const before = src.snapshot('api-keys');

    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: true });

    expect(counts.rotated).toBe(2);
    expect(src.snapshot('api-keys')).toEqual(before);
  });

  it('reports per-row errors but does not halt the run', async () => {
    const ROGUE = randomBytes(32);
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'good-1') },
      { id: '02', value: encryptWithKey(ROGUE, 'rogue') }, // un-decryptable
      { id: '03', value: encryptWithKey(KEY_OLD, 'good-2') },
    ]);

    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });

    expect(counts.scanned).toBe(3);
    expect(counts.rotated).toBe(2);
    expect(counts.errors).toHaveLength(1);
    expect(counts.errors[0]?.id).toBe('02');
  });

  it('resumes from --from cursor (skips earlier rows entirely)', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'a') },
      { id: '02', value: encryptWithKey(KEY_OLD, 'b') },
      { id: '03', value: encryptWithKey(KEY_OLD, 'c') },
      { id: '04', value: encryptWithKey(KEY_OLD, 'd') },
    ]);

    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, {
      dryRun: false,
      fromId: '02',
    });

    expect(counts.scanned).toBe(2); // only 03, 04
    expect(counts.rotated).toBe(2);
    expect(counts.lastId).toBe('04');

    // Rows 01, 02 are still under OLD_KEK (not touched)
    const snap = src.snapshot('api-keys');
    const row01 = snap.find((r) => r.id === '01');
    expect(row01?.value).toBeTruthy();
    if (row01?.value) {
      const re = planRotation(row01.value, KEY_OLD, KEY_NEW, { allowPlaintext: false });
      expect(re.kind).toBe('rotate');
    }
  });

  it('mid-run crash recovery: restart with same OLD/NEW completes cleanly', async () => {
    const src = new InMemorySource();
    src.seed('api-keys', [
      { id: '01', value: encryptWithKey(KEY_OLD, 'a') },
      { id: '02', value: encryptWithKey(KEY_OLD, 'b') },
      { id: '03', value: encryptWithKey(KEY_OLD, 'c') },
      { id: '04', value: encryptWithKey(KEY_OLD, 'd') },
    ]);

    src.crashOnUpdate = 3; // crash on the 3rd update

    let lastId = '';
    try {
      const r = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });
      lastId = r.lastId;
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      // Last successful update was row 02; row 03 is mid-update
      lastId = '02';
    }

    // Restart from the last known successful row
    src.crashOnUpdate = undefined;
    const resume = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, {
      dryRun: false,
      fromId: lastId,
    });

    // Final state: every row decrypts under NEW_KEK
    const after = src.snapshot('api-keys');
    expect(after).toHaveLength(4);
    for (const row of after) {
      if (row.value) {
        const re = planRotation(row.value, KEY_OLD, KEY_NEW, { allowPlaintext: false });
        expect(re.kind).toBe('skip-already-new');
      }
    }
    expect(resume.errors).toEqual([]);
  });

  it('empty surface: zero rows, zero counts, no error', async () => {
    const src = new InMemorySource();
    const counts = await rotateSurface(src, 'api-keys', KEY_OLD, KEY_NEW, { dryRun: false });
    expect(counts.scanned).toBe(0);
    expect(counts.rotated).toBe(0);
    expect(counts.errors).toEqual([]);
    expect(counts.lastId).toBe('');
  });
});
