/**
 * API CORS Configuration Integration Tests
 *
 * PURPOSE: Verify CORS configuration behaves correctly in production mode (PRODUCTION BLOCKER FIX)
 *
 * CRITICAL CONTEXT: Production blocker #2 - CORS_ORIGIN previously returned empty array [] in
 * production if not set, blocking ALL requests. These tests verify the fix.
 *
 * TESTS:
 * - Production mode requires CORS_ORIGIN to be set
 * - Only configured origins are allowed in production
 * - Development mode allows localhost origins
 * - Preflight requests are handled correctly
 * - Credentials are properly configured
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('API CORS Configuration Integration Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules to clear cached imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // =============================================================================
  // Production Mode CORS Validation (Production Blocker Fix)
  // =============================================================================

  describe('Production Mode CORS Validation (Production Blocker Fix)', () => {
    it('should throw error if CORS_ORIGIN not set in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', undefined as unknown as string);

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).rejects.toThrow('CORS_ORIGIN environment variable must be set in production');
    });

    it('should throw error if CORS_ORIGIN is empty string in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', '');

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).rejects.toThrow('CORS_ORIGIN environment variable must be set in production');
    });

    it('should throw error if CORS_ORIGIN is whitespace in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', '   ');

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).rejects.toThrow('CORS_ORIGIN environment variable must be set in production');
    });

    it('should accept single origin in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).resolves.not.toThrow();
    });

    it('should accept multiple origins in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com,https://www.example.com');

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).resolves.not.toThrow();
    });
  });

  // =============================================================================
  // Origin Allowlist Verification
  // =============================================================================

  describe('Origin Allowlist Verification', () => {
    it('should only allow configured origins in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com,https://www.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      // Allowed origin
      const res1 = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com' },
      });
      expect(res1.headers.get('access-control-allow-origin')).toBe('https://app.example.com');

      // Another allowed origin
      const res2 = await prodApp.request('/health', {
        headers: { Origin: 'https://www.example.com' },
      });
      expect(res2.headers.get('access-control-allow-origin')).toBe('https://www.example.com');

      // Disallowed origin
      const res3 = await prodApp.request('/health', {
        headers: { Origin: 'https://malicious.com' },
      });
      expect(res3.headers.get('access-control-allow-origin')).toBeFalsy();
    });

    it('should trim whitespace from configured origins', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', '  https://app.example.com  ,  https://www.example.com  ');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    });

    it('should reject localhost in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });

    it('should reject http origins in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'http://app.example.com' },
      });

      // Should not allow insecure http origin
      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });
  });

  // =============================================================================
  // Development Mode CORS
  // =============================================================================

  describe('Development Mode CORS', () => {
    it('should allow localhost origins in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CORS_ORIGIN', undefined as unknown as string);

      vi.resetModules();
      const { default: devApp } = await import('../../../../../apps/server/src/index.js');

      const res1 = await devApp.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res1.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

      const res2 = await devApp.request('/health', {
        headers: { Origin: 'http://localhost:3001' },
      });
      expect(res2.headers.get('access-control-allow-origin')).toBe('http://localhost:3001');

      const res3 = await devApp.request('/health', {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(res3.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });

    it('should not require CORS_ORIGIN in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CORS_ORIGIN', undefined as unknown as string);

      await expect(async () => {
        vi.resetModules();
        await import('../../../../../apps/server/src/index.js');
      }).resolves.not.toThrow();
    });

    it('should reject non-localhost origins in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CORS_ORIGIN', undefined as unknown as string);

      vi.resetModules();
      const { default: devApp } = await import('../../../../../apps/server/src/index.js');

      const res = await devApp.request('/health', {
        headers: { Origin: 'https://malicious.com' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });
  });

  // =============================================================================
  // Test Mode CORS
  // =============================================================================

  describe('Test Mode CORS', () => {
    it('should allow localhost origins in test mode', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('CORS_ORIGIN', undefined as unknown as string);

      vi.resetModules();
      const { default: testApp } = await import('../../../../../apps/server/src/index.js');

      const res = await testApp.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    });
  });

  // =============================================================================
  // Credentials Configuration
  // =============================================================================

  describe('Credentials Configuration', () => {
    it('should include credentials:true in CORS headers', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com' },
      });

      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });
  });

  // =============================================================================
  // Preflight Requests (OPTIONS)
  // =============================================================================

  describe('Preflight Requests (OPTIONS)', () => {
    it('should handle preflight OPTIONS requests', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
      expect(res.headers.get('access-control-allow-methods')).toBeTruthy();
    });

    it('should reject preflight from disallowed origin', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://malicious.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle missing Origin header', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health');

      // Should still respond (CORS headers just won't be present)
      expect(res.status).toBe(200);
    });

    it('should handle case-sensitive origins', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'https://APP.EXAMPLE.COM' },
      });

      // Origins are case-sensitive (should not match)
      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });

    it('should handle origin with port', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com:8080');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com:8080' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com:8080');
    });

    it('should handle origin with path (should not match)', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com/path' },
      });

      // Origins don't include paths (should not match)
      expect(res.headers.get('access-control-allow-origin')).toBeFalsy();
    });

    it('should handle subdomain variations', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('CORS_ORIGIN', 'https://app.example.com,https://api.example.com');

      vi.resetModules();
      const { default: prodApp } = await import('../../../../../apps/server/src/index.js');

      const res1 = await prodApp.request('/health', {
        headers: { Origin: 'https://app.example.com' },
      });
      expect(res1.headers.get('access-control-allow-origin')).toBe('https://app.example.com');

      const res2 = await prodApp.request('/health', {
        headers: { Origin: 'https://api.example.com' },
      });
      expect(res2.headers.get('access-control-allow-origin')).toBe('https://api.example.com');

      // Different subdomain not in list
      const res3 = await prodApp.request('/health', {
        headers: { Origin: 'https://admin.example.com' },
      });
      expect(res3.headers.get('access-control-allow-origin')).toBeFalsy();
    });
  });
});
