import { describe, expect, it } from 'vitest';
import { hashToken, verifyToken } from '../token.js';

describe('Token Utilities', () => {
  describe('hashToken', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
      const hash = hashToken('test-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });

  describe('verifyToken', () => {
    it('returns true for a matching token and hash', () => {
      const token = 'session-token-123';
      const hash = hashToken(token);
      expect(verifyToken(token, hash)).toBe(true);
    });

    it('returns false for a non-matching token', () => {
      const hash = hashToken('correct-token');
      expect(verifyToken('wrong-token', hash)).toBe(false);
    });

    it('returns false for a different-length hash', () => {
      expect(verifyToken('token', 'short')).toBe(false);
    });

    it('returns false for an empty hash', () => {
      expect(verifyToken('token', '')).toBe(false);
    });

    it('returns false for an empty token', () => {
      const hash = hashToken('real-token');
      expect(verifyToken('', hash)).toBe(false);
    });
  });
});
