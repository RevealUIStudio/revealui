/**
 * Health Live Route Tests
 *
 * Tests for GET /api/health/live — liveness probe endpoint.
 * Simple check that always returns 200 with status and timestamp.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../app/api/health/live/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health/live', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns 200 status code', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
  });

  it('returns status "alive"', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json.status).toBe('alive');
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json.timestamp).toBeDefined();
    const parsed = new Date(json.timestamp);
    expect(parsed.toISOString()).toBe(json.timestamp);
  });

  it('returns the current timestamp', async () => {
    const now = new Date('2026-03-09T12:00:00.000Z');
    vi.setSystemTime(now);

    const res = await GET();
    const json = await res.json();

    expect(json.timestamp).toBe('2026-03-09T12:00:00.000Z');

    vi.useRealTimers();
  });

  it('returns JSON content type', async () => {
    const res = await GET();

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns exactly two fields in the response body', async () => {
    const res = await GET();
    const json = await res.json();

    expect(Object.keys(json)).toHaveLength(2);
    expect(Object.keys(json).sort()).toEqual(['status', 'timestamp']);
  });

  it('returns different timestamps on successive calls', async () => {
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
    const res1 = await GET();
    const json1 = await res1.json();

    vi.setSystemTime(new Date('2026-03-09T12:00:01.000Z'));
    const res2 = await GET();
    const json2 = await res2.json();

    expect(json1.timestamp).not.toBe(json2.timestamp);

    vi.useRealTimers();
  });
});
