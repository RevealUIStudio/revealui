import { describe, expect, it } from 'vitest';
import { docsPathnameFromUrl, isDocsSiteUrl } from '../docs-url';

describe('docsPathnameFromUrl', () => {
  it('extracts the pathname from a docs.revealui.com URL', () => {
    expect(docsPathnameFromUrl('https://docs.revealui.com/quick-start')).toBe('/quick-start');
    expect(docsPathnameFromUrl('https://docs.revealui.com/')).toBe('/');
    expect(docsPathnameFromUrl('https://docs.revealui.com')).toBe('/');
    expect(docsPathnameFromUrl('https://docs.revealui.com/guides/deployment#top')).toBe(
      '/guides/deployment',
    );
  });

  it('rejects lookalike hosts that only share an origin prefix', () => {
    expect(docsPathnameFromUrl('https://docs.revealui.com.evil.com/x')).toBeNull();
    expect(docsPathnameFromUrl('https://docs.revealui.com.evil.com')).toBeNull();
    expect(isDocsSiteUrl('http://docs.revealui.com/quick-start')).toBe(false);
    expect(isDocsSiteUrl('https://evil.com/https://docs.revealui.com/x')).toBe(false);
  });
});
