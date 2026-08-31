/**
 * GAP-256 PR-4 — admission token hash + pure helpers (no DB).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateAdmissionToken,
  hashAdmissionToken,
  maskAdmissionEmail,
  shouldExpireWaitlistRow,
} from '../admission-waitlist.js';

describe('hashAdmissionToken', () => {
  it('is deterministic sha256 hex', () => {
    const raw = 'abc123';
    const expected = createHash('sha256').update(raw).digest('hex');
    expect(hashAdmissionToken(raw)).toBe(expected);
    expect(hashAdmissionToken(raw)).toBe(hashAdmissionToken(raw));
  });

  it('differs for different tokens', () => {
    expect(hashAdmissionToken('a')).not.toBe(hashAdmissionToken('b'));
  });
});

describe('generateAdmissionToken', () => {
  it('returns 64 hex chars (32 bytes)', () => {
    const t = generateAdmissionToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is unique across calls', () => {
    expect(generateAdmissionToken()).not.toBe(generateAdmissionToken());
  });
});

describe('shouldExpireWaitlistRow', () => {
  it('expires pending past expiresAt', () => {
    const now = new Date('2026-08-31T00:00:00Z');
    expect(
      shouldExpireWaitlistRow(
        { status: 'pending', expiresAt: new Date('2026-08-30T00:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('keeps unexpired, converted, and null expiresAt', () => {
    const now = new Date('2026-08-31T00:00:00Z');
    expect(
      shouldExpireWaitlistRow(
        { status: 'pending', expiresAt: new Date('2026-09-01T00:00:00Z') },
        now,
      ),
    ).toBe(false);
    expect(shouldExpireWaitlistRow({ status: 'converted', expiresAt: now }, now)).toBe(false);
    expect(shouldExpireWaitlistRow({ status: 'pending', expiresAt: null }, now)).toBe(false);
  });
});

describe('maskAdmissionEmail', () => {
  it('masks local part', () => {
    expect(maskAdmissionEmail('alice@example.com')).toBe('a***@example.com');
  });

  it('normalizes case', () => {
    expect(maskAdmissionEmail('  Bob@Example.COM ')).toBe('b***@example.com');
  });
});
