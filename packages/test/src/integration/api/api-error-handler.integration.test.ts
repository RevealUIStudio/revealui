/**
 * API Error Handler Integration Tests
 *
 * PURPOSE: Verify error handler does NOT leak internal errors (PRODUCTION BLOCKER FIX)
 *
 * CRITICAL CONTEXT: Production blocker #5 - API error handler previously leaked internal
 * details at apps/server/src/middleware/error.ts:30-35. These tests verify the fix.
 *
 * TESTS:
 * - Generic errors return safe message (no internal details)
 * - Stack traces are never exposed
 * - Database connection strings are never exposed
 * - File paths are never exposed
 * - HTTPExceptions are properly handled
 * - Validation errors (ZodError) are properly formatted
 */

import { errorHandler } from '@api/middleware/error.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it } from 'vitest';

describe('API Error Handler Integration Tests', () => {
  let app: Hono;

  beforeEach(() => {
    // Create fresh Hono app for each test
    app = new Hono();
    app.onError(errorHandler);
  });

  // =============================================================================
  // Generic Error Handling (Production Blocker Fix)
  // =============================================================================

  describe('Generic Error Handling (Production Blocker Fix)', () => {
    it('should NOT leak database connection strings', async () => {
      app.get('/test', () => {
        throw new Error('connection refused to postgres://admin:secretpass@db.internal:5432/prod');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('postgres');
      expect(JSON.stringify(json)).not.toContain('secretpass');
      expect(JSON.stringify(json)).not.toContain('admin');
      expect(JSON.stringify(json)).not.toContain('db.internal');
    });

    it('should NOT leak stack traces', async () => {
      app.get('/test', () => {
        const error = new Error('Internal error');
        throw error;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.stack).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain('at ');
      expect(JSON.stringify(json)).not.toContain('.ts:');
      expect(JSON.stringify(json)).not.toContain('.js:');
    });

    it('should NOT leak file paths', async () => {
      app.get('/test', () => {
        throw new Error(
          'ENOENT: no such file or directory, open /home/user/projects/RevealUI/.env.production',
        );
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('/home/');
      expect(JSON.stringify(json)).not.toContain('.env');
      expect(JSON.stringify(json)).not.toContain('ENOENT');
    });

    it('should NOT leak environment variables', async () => {
      app.get('/test', () => {
        throw new Error('STRIPE_SECRET_KEY=sk_live_1234567890abcdef is not valid');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('STRIPE_SECRET_KEY');
      expect(JSON.stringify(json)).not.toContain('sk_live_');
    });

    it('should NOT leak API keys or tokens', async () => {
      app.get('/test', () => {
        throw new Error(
          'Authentication failed: token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.invalid',
        );
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(JSON.stringify(json)).not.toContain('token');
    });

    it('should NOT leak internal service URLs', async () => {
      app.get('/test', () => {
        throw new Error('Failed to connect to https://internal-api.company.local:8080/admin');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('internal-api');
      expect(JSON.stringify(json)).not.toContain('company.local');
    });

    it('should return generic message for all unknown errors', async () => {
      app.get('/test', () => {
        throw new Error('Extremely detailed internal error message with sensitive information');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(json.error.length).toBeLessThan(100); // Generic message is short
    });
  });

  // =============================================================================
  // HTTP Exception Handling
  // =============================================================================

  describe('HTTP Exception Handling', () => {
    it('should handle 404 Not Found', async () => {
      app.get('/test', () => {
        throw new HTTPException(404, { message: 'Resource not found' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Resource not found');
    });

    it('should handle 401 Unauthorized', async () => {
      app.get('/test', () => {
        throw new HTTPException(401, { message: 'Unauthorized' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden', async () => {
      app.get('/test', () => {
        throw new HTTPException(403, { message: 'Forbidden' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('should handle 400 Bad Request', async () => {
      app.get('/test', () => {
        throw new HTTPException(400, { message: 'Invalid request' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
    });

    it('should handle custom HTTP exception messages', async () => {
      app.get('/test', () => {
        throw new HTTPException(422, { message: 'Unprocessable entity' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error).toBe('Unprocessable entity');
    });
  });

  // =============================================================================
  // Validation Error Handling (ZodError)
  // =============================================================================

  describe('Validation Error Handling (ZodError)', () => {
    it('should handle ZodError with details', async () => {
      app.get('/test', () => {
        const zodError = new Error('Validation error details here');
        zodError.name = 'ZodError';
        throw zodError;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation failed');
      expect(json.details).toBeDefined();
    });

    it('should return 400 status for validation errors', async () => {
      app.get('/test', () => {
        const zodError = new Error('Email is required');
        zodError.name = 'ZodError';
        throw zodError;
      });

      const res = await app.request('/test');

      expect(res.status).toBe(400);
    });

    it('should include validation error details', async () => {
      app.get('/test', () => {
        const zodError = new Error('Expected string, received number');
        zodError.name = 'ZodError';
        throw zodError;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(json.error).toBe('Validation failed');
      expect(json.details).toContain('Expected string, received number');
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle non-Error objects', async () => {
      app.get('/test', () => {
        throw 'string error';
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
    });

    it('should handle null errors', async () => {
      app.get('/test', () => {
        throw null;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
    });

    it('should handle undefined errors', async () => {
      app.get('/test', () => {
        throw undefined;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
    });

    it('should handle errors with circular references', async () => {
      app.get('/test', () => {
        const circularError = new Error('Circular error') as Error & { self?: unknown };
        circularError.self = circularError;
        throw circularError;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
    });

    it('should handle errors with special characters', async () => {
      app.get('/test', () => {
        throw new Error('Error with <script>alert("xss")</script> injection attempt');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(JSON.stringify(json)).not.toContain('<script>');
    });

    it('should handle very long error messages', async () => {
      app.get('/test', () => {
        const longMessage = 'Error: '.repeat(1000);
        throw new Error(longMessage);
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('An error occurred while processing your request');
      expect(json.error.length).toBeLessThan(100); // Should not leak long message
    });
  });

  // =============================================================================
  // Response Format Validation
  // =============================================================================

  describe('Response Format Validation', () => {
    it('should always return JSON', async () => {
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/test');

      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('should have error field in response', async () => {
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(json).toHaveProperty('error');
      expect(typeof json.error).toBe('string');
    });

    it('should NOT include success:true for errors', async () => {
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(json.success).not.toBe(true);
    });

    it('should NOT include data field for errors', async () => {
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(json.data).toBeUndefined();
    });
  });
});
