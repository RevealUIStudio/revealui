/**
 * Regression guard for the 2026-07-21 production outage:
 * module-level font reads in og.ts threw during `import ogRoute`, which
 * aborted the entire serverless handler (FUNCTION_INVOCATION_FAILED on
 * /health, not just /api/og).
 *
 * Importing the route module must never throw. Font load is deferred to
 * the first /api/og request (loadOgFonts).
 */
import { describe, expect, it } from 'vitest';
import { loadOgFonts, readOgFont, resetOgFontsCacheForTests } from '../og.js';

describe('OG route boot safety (no module-level asset throw)', () => {
  it('imports the og route without requiring fonts at evaluation time', async () => {
    // Dynamic re-import exercises the module graph; a top-level throw would fail here.
    const mod = await import('../og.js');
    expect(mod.default).toBeDefined();
    expect(typeof mod.loadOgFonts).toBe('function');
  });

  it('loadOgFonts resolves the committed static faces', () => {
    resetOgFontsCacheForTests();
    const fonts = loadOgFonts();
    expect(fonts.regular.byteLength).toBeGreaterThan(1000);
    expect(fonts.bold.byteLength).toBeGreaterThan(1000);
    // Singleton
    expect(loadOgFonts()).toBe(fonts);
  });

  it('readOgFont throws a clear error for a missing face name', () => {
    expect(() => readOgFont('Does-Not-Exist.ttf')).toThrow(/OG font not found/);
  });
});
