import { describe, expect, it } from 'vitest';
import {
  generatePassword,
  generateSecret,
  parseEnvContent,
  updateEnvValue,
} from '../environment/generators.js';

describe('Generators', () => {
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
