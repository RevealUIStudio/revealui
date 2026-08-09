/**
 * GAP-256 PR-4 — admission token hash + pure helpers (no DB).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateAdmissionToken,
  hashAdmissionToken,
  maskAdmissionEmail,
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

describe('maskAdmissionEmail', () => {
  it('masks local part', () => {
    expect(maskAdmissionEmail('alice@example.com')).toBe('a***@example.com');
  });

  it('normalizes case', () => {
    expect(maskAdmissionEmail('  Bob@Example.COM ')).toBe('b***@example.com');
  });
});
