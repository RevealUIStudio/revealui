/**
 * Waitlist API Test - Production Blocker #3 Verification
 *
 * Verifies that waitlist endpoint:
 * 1. Stores emails in database (not in-memory)
 * 2. Includes proper validation and rate limiting
 * 3. Handles duplicates correctly
 * 4. GET endpoint returns 410 (removed for GDPR)
 *
 * @see docs/PRODUCTION_BLOCKERS.md - Critical Fix #3
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../route';

// Create a mock that supports two Drizzle query shapes:
// 1. Rate limit: db.select({total}).from(t).where(cond) → awaited directly → [{ total: N }]
// 2. Duplicate check: db.select().from(t).where(cond).limit(1) → [{ email: '...' }]
function createMockDb() {
  let limitResult: unknown[] = [];
  let rateResult: unknown[] = [{ total: 0 }];

  // Create a thenable chain result that supports both .limit() and direct await
  function createWhereResult() {
    const result = {
      // For duplicate check path: .where().limit(1)
      limit: vi.fn(async () => limitResult),
      // For rate limit path: await .where() directly (must be thenable to match Drizzle API)
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Drizzle query mock
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        Promise.resolve(rateResult).then(resolve, reject);
      },
    };
    return result;
  }

  const db: Record<string, unknown> = {
    select: vi.fn(() => db),
    from: vi.fn(() => db),
    where: vi.fn(() => createWhereResult()),
    insert: vi.fn(() => db),
    values: vi.fn(async () => [{ id: 'test-id' }]),
    // Test helpers to control mock behavior
    __setLimitResult(result: unknown[]) {
      limitResult = result;
    },
    __setRateResult(result: unknown[]) {
      rateResult = result;
    },
  };

  return db;
}

let mockDb = createMockDb();

// Mock database client
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

// Mock schema - provide enough structure for Drizzle's eq/gte/and/count to work
vi.mock('@revealui/db/schema', () => ({
  waitlist: {
    email: 'email',
    ipAddress: 'ipAddress',
    createdAt: 'createdAt',
  },
}));

// Mock drizzle-orm operators to pass through
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => 'count'),
}));

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockRequest(body: unknown, ip = '127.0.0.1'): NextRequest {
  return {
    json: async () => body,
    ip,
    headers: {
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return ip;
        if (name === 'referer') return 'https://example.com';
        if (name === 'user-agent') return 'Test Agent';
        return null;
      }),
    },
  } as unknown as NextRequest;
}

describe('Critical Fix #3: Waitlist Database Storage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    // Re-wire the mock so getClient returns the fresh mock
    const mod = await import('@revealui/db/client');
    vi.mocked(mod.getClient).mockReturnValue(mockDb as unknown as ReturnType<typeof mod.getClient>);
  });

  describe('POST /api/waitlist', () => {
    it('stores email in database', async () => {
      const request = createMockRequest({ email: 'test@example.com' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });

    it('validates email format', async () => {
      const request = createMockRequest({ email: 'invalid-email' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('handles duplicate emails gracefully', async () => {
      // Mock existing email found in duplicate check
      (mockDb.__setLimitResult as (r: unknown[]) => void)([{ email: 'existing@example.com' }]);

      const request = createMockRequest({ email: 'existing@example.com' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200); // Success (don't leak information)
      expect(data.success).toBe(true);
      expect(mockDb.insert).not.toHaveBeenCalled(); // Don't insert duplicate
    });

    it('enforces rate limiting (5 requests per hour)', async () => {
      const ip = '192.168.1.1';

      // First 5 succeed (rate count starts at 0, increments)
      for (let i = 0; i < 5; i++) {
        (mockDb.__setRateResult as (r: unknown[]) => void)([{ total: i }]);
        const request = createMockRequest({ email: `test${i}@example.com` }, ip);
        const response = await POST(request);
        expect(response.status).toBe(201);
      }
      // 6th request: rate limit reports 5 existing requests
      (mockDb.__setRateResult as (r: unknown[]) => void)([{ total: 5 }]);
      const request = createMockRequest({ email: 'test6@example.com' }, ip);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('includes rate limit headers', async () => {
      const request = createMockRequest({ email: 'test@example.com' });

      const response = await POST(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });

    it('stores metadata (source, referrer, user agent, IP)', async () => {
      const request = createMockRequest(
        {
          email: 'test@example.com',
          source: 'blog',
        },
        '10.0.0.1',
      );

      await POST(request);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          source: 'blog',
          referrer: 'https://example.com',
          userAgent: 'Test Agent',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('uses default source if not provided', async () => {
      const request = createMockRequest({ email: 'test@example.com' });

      await POST(request);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'landing-page',
        }),
      );
    });

    it('handles database errors gracefully', async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const request = createMockRequest({ email: 'test@example.com' }, '10.1.1.1');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe(
        'An error occurred while processing your request. Please try again later.',
      );
      // Should not expose internal error
      expect(data.error).not.toContain('Database error');
    });

    it('masks email in logs for privacy', async () => {
      const { logger } = await import('@revealui/core/observability/logger');
      const request = createMockRequest({ email: 'test@example.com' }, '10.2.2.2');

      await POST(request);

      expect(logger.info).toHaveBeenCalledWith(
        'New waitlist signup',
        expect.objectContaining({
          email: 'tes***', // First 3 chars + ***
        }),
      );
    });
  });

  describe('GET /api/waitlist', () => {
    it('returns 410 Gone (endpoint removed for GDPR)', () => {
      const response = GET();

      expect(response.status).toBe(410);
    });

    it('suggests using admin panel', async () => {
      const response = GET();
      const data = await response.json();

      expect(data.error).toContain('admin panel');
    });
  });
});
