import { createPrivateKey, createPublicKey } from 'node:crypto';
import { deriveAuditKid } from '@revealui/security/server';
import { describe, expect, it } from 'vitest';
import {
  generateAuditSigningKeypair,
  generatePassword,
  generateSecret,
  parseEnvContent,
  updateEnvValue,
} from '../environment/generators.js';

describe('Generators', () => {
  describe('generateAuditSigningKeypair', () => {
    it('generates a valid Ed25519 keypair with real-newline PEMs', () => {
      const { privateKeyPem, publicKeyPem } = generateAuditSigningKeypair();
      // createPrivateKey/createPublicKey throw on a malformed PEM.
      expect(createPrivateKey(privateKeyPem).asymmetricKeyType).toBe('ed25519');
      expect(createPublicKey(publicKeyPem).asymmetricKeyType).toBe('ed25519');
      expect(publicKeyPem).toContain('PUBLIC KEY');
      // Real newlines, not literal backslash-n (GAP-396 does not apply here).
      expect(privateKeyPem).toContain('\n');
      expect(privateKeyPem).not.toContain('\\n');
    });

    it('prints a kid the runtime signer derives identically from the same key', () => {
      const { privateKeyPem, publicKeyPem, kid } = generateAuditSigningKeypair();
      expect(kid.startsWith('ed25519-')).toBe(true);
      // Derived from the private half and the public half — must match, so the
      // operator-printed kid equals what each signature carries.
      expect(deriveAuditKid(createPublicKey(createPrivateKey(privateKeyPem)))).toBe(kid);
      expect(deriveAuditKid(createPublicKey(publicKeyPem))).toBe(kid);
    });

    it('generates a distinct key each call (no shared key ever ships)', () => {
      const a = generateAuditSigningKeypair();
      const b = generateAuditSigningKeypair();
      expect(a.privateKeyPem).not.toBe(b.privateKeyPem);
      expect(a.kid).not.toBe(b.kid);
    });
  });

  describe('generateSecret', () => {
    it('returns a 64-character hex string by default (32 bytes)', () => {
      const secret = generateSecret();
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[0-9a-f]+$/);
    });

    it('respects custom length', () => {
      const secret = generateSecret(16);
      expect(secret).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('generates unique values', () => {
      const a = generateSecret();
      const b = generateSecret();
      expect(a).not.toBe(b);
    });
  });

  describe('generatePassword', () => {
    it('returns a 16-character password by default', () => {
      const password = generatePassword();
      expect(password).toHaveLength(16);
    });

    it('respects custom length', () => {
      const password = generatePassword(32);
      expect(password).toHaveLength(32);
    });

    it('generates unique values', () => {
      const a = generatePassword();
      const b = generatePassword();
      expect(a).not.toBe(b);
    });

    it('uses characters from the expected charset', () => {
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      const password = generatePassword(100); // large sample
      for (const char of password) {
        expect(charset).toContain(char);
      }
    });
  });

  describe('updateEnvValue', () => {
    it('replaces an existing value', () => {
      const content = 'DB_URL=old\nAPI_KEY=abc';
      const result = updateEnvValue(content, 'DB_URL', 'new');
      expect(result).toContain('DB_URL=new');
      expect(result).toContain('API_KEY=abc');
      expect(result).not.toContain('DB_URL=old');
    });

    it('adds a new key when missing', () => {
      const content = 'DB_URL=test';
      const result = updateEnvValue(content, 'NEW_KEY', 'value');
      expect(result).toContain('DB_URL=test');
      expect(result).toContain('NEW_KEY=value');
    });

    it('handles empty content', () => {
      const result = updateEnvValue('', 'KEY', 'value');
      expect(result).toContain('KEY=value');
    });
  });

  describe('parseEnvContent', () => {
    it('parses key=value pairs', () => {
      const result = parseEnvContent('DB_URL=postgresql://localhost\nAPI_KEY=abc123');
      expect(result).toEqual({
        DB_URL: 'postgresql://localhost',
        API_KEY: 'abc123',
      });
    });

    it('skips comments', () => {
      const result = parseEnvContent('# This is a comment\nKEY=value');
      expect(result).toEqual({ KEY: 'value' });
    });

    it('skips empty lines', () => {
      const result = parseEnvContent('KEY1=a\n\n\nKEY2=b');
      expect(result).toEqual({ KEY1: 'a', KEY2: 'b' });
    });

    it('trims whitespace from keys and values', () => {
      const result = parseEnvContent('  KEY  =  value  ');
      expect(result).toEqual({ KEY: 'value' });
    });

    it('handles values with equals signs', () => {
      const result = parseEnvContent('DB_URL=postgres://user:pass=123@host/db');
      expect(result).toEqual({ DB_URL: 'postgres://user:pass=123@host/db' });
    });

    it('returns empty object for empty content', () => {
      expect(parseEnvContent('')).toEqual({});
    });
  });
});
