/**
 * Supplemental CDN config tests covering branches not reached by the primary
 * cdn-config.test.ts suite.
 */

import { describe, expect, it, vi } from 'vitest';
import { getCacheTTL, warmCDNCache } from '../cdn-config.js';

// ---------------------------------------------------------------------------
// getCacheTTL — malformed directive values
// ---------------------------------------------------------------------------

describe('getCacheTTL — malformed directive values', () => {
  it('skips non-numeric s-maxage and falls back to max-age', () => {
    const headers = new Headers({ 'cache-control': 's-maxage=abc, max-age=120' });
    expect(getCacheTTL(headers)).toBe(120);
  });

  it('skips non-numeric max-age and returns 0', () => {
    const headers = new Headers({ 'cache-control': 'max-age=abc' });
    expect(getCacheTTL(headers)).toBe(0);
  });

  it('handles directive with no value after s-maxage=', () => {
    const headers = new Headers({ 'cache-control': 's-maxage=' });
    expect(getCacheTTL(headers)).toBe(0);
  });

  it('handles directive with no value after max-age=', () => {
    const headers = new Headers({ 'cache-control': 'max-age=' });
    expect(getCacheTTL(headers)).toBe(0);
  });

  it('prefers numeric s-maxage=0 over max-age', () => {
    const headers = new Headers({ 'cache-control': 's-maxage=0, max-age=300' });
    expect(getCacheTTL(headers)).toBe(0);
  });

  it('returns correct value when s-maxage has leading whitespace after comma', () => {
    const headers = new Headers({ 'cache-control': 'public, s-maxage=600' });
    expect(getCacheTTL(headers)).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// warmCDNCache — non-Error rejection in fetch
// ---------------------------------------------------------------------------

describe('warmCDNCache — non-Error fetch rejection', () => {
  it('converts a non-Error thrown value to "Unknown error"', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('string error');

    const result = await warmCDNCache(['https://example.com/a']);

    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(['Unknown error']);

    mockFetch.mockRestore();
  });

  it('handles a mix of success, http-error, and thrown error across chunks', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await warmCDNCache(
      ['https://example.com/ok', 'https://example.com/missing', 'https://example.com/down'],
      { concurrency: 3 },
    );

    expect(result.warmed).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toContain('404 Not Found');
    expect(result.errors).toContain('ECONNREFUSED');

    mockFetch.mockRestore();
  });
});
