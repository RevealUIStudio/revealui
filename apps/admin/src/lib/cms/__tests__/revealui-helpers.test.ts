/**
 * getLinkUrl — CMS nav-link resolution.
 *
 * Header nav items render getLinkUrl's return directly into <Link href>, so
 * the custom-URL branch is a stored-XSS sink and must sanitize (the Footer's
 * identical navItems data renders through CMSLink, which sanitizes itself).
 *
 * No regex authored (fleet posture): assertions use equality.
 */

import { describe, expect, it } from 'vitest';
import { getLinkUrl } from '../revealui-helpers';

type NavLink = Parameters<typeof getLinkUrl>[0];

function customLink(url: string): NavLink {
  return { type: 'custom', url } as NavLink;
}

describe('getLinkUrl — custom URLs (author-controlled)', () => {
  it('collapses javascript: to "#"', () => {
    expect(getLinkUrl(customLink('javascript:alert(document.cookie)'))).toBe('#');
  });

  it('collapses vbscript: to "#"', () => {
    expect(getLinkUrl(customLink('vbscript:MsgBox(1)'))).toBe('#');
  });

  it('collapses data:text/html to "#"', () => {
    expect(getLinkUrl(customLink('data:text/html,<script>alert(1)</script>'))).toBe('#');
  });

  it('collapses whitespace-prefixed javascript: to "#"', () => {
    expect(getLinkUrl(customLink(' javascript:alert(1)'))).toBe('#');
  });

  it('preserves https URLs', () => {
    expect(getLinkUrl(customLink('https://example.com/docs'))).toBe('https://example.com/docs');
  });

  it('preserves relative paths', () => {
    expect(getLinkUrl(customLink('/pricing'))).toBe('/pricing');
  });

  it('preserves mailto: URLs', () => {
    expect(getLinkUrl(customLink('mailto:hi@example.com'))).toBe('mailto:hi@example.com');
  });
});

describe('getLinkUrl — reference links', () => {
  it('builds page hrefs from populated slugs', () => {
    const link = {
      type: 'reference',
      reference: { relationTo: 'pages', value: { slug: 'about' } },
    } as unknown as NavLink;
    expect(getLinkUrl(link)).toBe('/about');
  });

  it('builds post hrefs from populated slugs', () => {
    const link = {
      type: 'reference',
      reference: { relationTo: 'posts', value: { slug: 'hello' } },
    } as unknown as NavLink;
    expect(getLinkUrl(link)).toBe('/posts/hello');
  });

  it('falls back to id paths for unpopulated references', () => {
    const link = {
      type: 'reference',
      reference: { relationTo: 'pages', value: '42' },
    } as unknown as NavLink;
    expect(getLinkUrl(link)).toBe('/pages/42');
  });

  it('returns "/" when nothing resolves', () => {
    expect(getLinkUrl({ type: 'custom' } as NavLink)).toBe('/');
  });
});
