/**
 * Tests for SSL Configuration Utility
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSSLConfig, validateSSLConfig } from '../ssl-config';

describe('getSSLConfig', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original environment variable
    originalEnv = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv === undefined) {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = undefined;
    } else {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = originalEnv;
    }
  });

  describe('SSL Mode Detection', () => {
    it('should return false for sslmode=disable', () => {
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=disable');
      expect(result).toBe(false);
    });

    it('should return false when sslmode is not specified', () => {
      const result = getSSLConfig('postgresql://localhost:5432/db');
      expect(result).toBe(false);
    });

    it('should return rejectUnauthorized: true for sslmode=require', () => {
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=require');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should return rejectUnauthorized: true for sslmode=verify-full', () => {
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=verify-full');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should return rejectUnauthorized: true for sslmode=verify-ca', () => {
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=verify-ca');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should return rejectUnauthorized: true for sslmode=prefer', () => {
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=prefer');
      expect(result).toEqual({ rejectUnauthorized: true });
    });
  });

  describe('Environment Variable Override', () => {
    it('should return rejectUnauthorized: false when DATABASE_SSL_REJECT_UNAUTHORIZED=false', () => {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=require');
      expect(result).toEqual({ rejectUnauthorized: false });
    });

    it('should return rejectUnauthorized: true when DATABASE_SSL_REJECT_UNAUTHORIZED=true', () => {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'true';
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=require');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should ignore DATABASE_SSL_REJECT_UNAUTHORIZED for sslmode=disable', () => {
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
      const result = getSSLConfig('postgresql://user:pass@host/db?sslmode=disable');
      expect(result).toBe(false);
    });
  });

  describe('Connection String Parsing', () => {
    it('should handle connection strings with multiple query parameters', () => {
      const result = getSSLConfig(
        'postgresql://user:pass@host/db?sslmode=require&channel_binding=require',
      );
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should handle connection strings with port numbers', () => {
      const result = getSSLConfig('postgresql://user:pass@host:5432/db?sslmode=require');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should handle connection strings without database name', () => {
      const result = getSSLConfig('postgresql://user:pass@host?sslmode=require');
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should handle invalid connection strings gracefully', () => {
      const result = getSSLConfig('not-a-valid-url');
      expect(result).toBe(false);
    });

    it('should handle empty connection strings', () => {
      const result = getSSLConfig('');
      expect(result).toBe(false);
    });
  });

  describe('Real-world Connection Strings', () => {
    it('should handle Neon connection string', () => {
      const result = getSSLConfig(
        'postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      );
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should handle Supabase connection string', () => {
      const result = getSSLConfig(
        'postgresql://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
      );
      expect(result).toEqual({ rejectUnauthorized: true });
    });

    it('should handle local PostgreSQL connection', () => {
      const result = getSSLConfig('postgresql://localhost:5432/mydb');
      expect(result).toBe(false);
    });
  });
});

describe('validateSSLConfig', () => {
  it('should return false when SSL is disabled in production', () => {
    const result = validateSSLConfig('postgresql://localhost:5432/db', 'production');
    expect(result).toBe(false);
  });

  it('should return true when SSL is disabled in development', () => {
    const result = validateSSLConfig('postgresql://localhost:5432/db', 'development');
    expect(result).toBe(true);
  });

  it('should return false when certificate verification is disabled in production', () => {
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
    const result = validateSSLConfig('postgresql://host/db?sslmode=require', 'production');
    expect(result).toBe(false);
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = undefined;
  });

  it('should return true when SSL is properly configured in production', () => {
    const result = validateSSLConfig('postgresql://host/db?sslmode=require', 'production');
    expect(result).toBe(true);
  });

  it('should use NODE_ENV when environment is not specified', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const result = validateSSLConfig('postgresql://localhost:5432/db');
    expect(result).toBe(false);

    process.env.NODE_ENV = originalNodeEnv;
  });
});
