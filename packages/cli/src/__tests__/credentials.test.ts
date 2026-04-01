import { describe, expect, it } from 'vitest';
import {
  validateNeonUrl,
  validateOpenAIKey,
  validateStripeKey,
  validateSupabaseUrl,
  validateVercelToken,
} from '../validators/credentials.js';

describe('Credential Validators', () => {
  describe('validateStripeKey', () => {
    it('accepts sk_test_ keys', () => {
      const result = validateStripeKey('sk_test_abc123');
      expect(result.valid).toBe(true);
    });

    it('accepts sk_live_ keys', () => {
      const result = validateStripeKey('sk_live_abc123');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid prefixes', () => {
      const result = validateStripeKey('pk_test_abc123');
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('validateNeonUrl', () => {
    it('accepts postgresql:// URLs', () => {
      const result = validateNeonUrl('postgresql://user:pass@host/db');
      expect(result.valid).toBe(true);
    });

    it('accepts postgres:// URLs', () => {
      const result = validateNeonUrl('postgres://user:pass@host/db');
      expect(result.valid).toBe(true);
    });

    it('rejects non-postgres URLs', () => {
      const result = validateNeonUrl('http://example.com');
      expect(result.valid).toBe(false);
    });

    it('rejects invalid URLs', () => {
      const result = validateNeonUrl('not-a-url');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateVercelToken', () => {
    it('accepts tokens with 20+ characters', () => {
      const result = validateVercelToken('a'.repeat(20));
      expect(result.valid).toBe(true);
    });

    it('rejects tokens shorter than 20 characters', () => {
      const result = validateVercelToken('short');
      expect(result.valid).toBe(false);
    });

    it('rejects empty strings', () => {
      const result = validateVercelToken('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSupabaseUrl', () => {
    it('accepts valid Supabase URLs', () => {
      const result = validateSupabaseUrl('https://myproject.supabase.co');
      expect(result.valid).toBe(true);
    });

    it('accepts non-supabase URLs with a warning', () => {
      const result = validateSupabaseUrl('https://example.com');
      expect(result.valid).toBe(true); // valid URL, just warns
    });

    it('rejects invalid URLs', () => {
      const result = validateSupabaseUrl('not-a-url');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateOpenAIKey', () => {
    it('accepts keys starting with sk-', () => {
      const result = validateOpenAIKey('sk-abc123');
      expect(result.valid).toBe(true);
    });

    it('rejects keys without sk- prefix', () => {
      const result = validateOpenAIKey('invalid-key');
      expect(result.valid).toBe(false);
    });
  });
});
