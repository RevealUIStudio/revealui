import { describe, expect, it } from 'vitest';
import {
  DOCS_BLOG_PREFIX,
  isDocsBlogPath,
  NAV_DOCS_BOUNDARY_STATUS,
  NAV_DOCS_LOCK_IDS,
  NAV_DOCS_LOCKS,
  PRODUCT_BLOG_HOPS,
  pointsAtDocsBlog,
  STUDIO_BLOG_HREF,
  studioBlogPostHref,
  textPointsAtDocsBlog,
} from '../nav-docs-boundary.js';

describe('admitted nav/docs boundary', () => {
  it('keeps the locked ids and admitted status', () => {
    expect(NAV_DOCS_LOCK_IDS).toEqual({
      docsProduct: 'nav-docs-product-2026-09-26',
      productBlogPointsStudio: 'nav-product-blog-points-studio-2026-09-26',
      boundary: 'boundary-blog-studio-docs-ref-2026-09-26',
    });
    expect(NAV_DOCS_BOUNDARY_STATUS).toBe('admitted');
    expect(NAV_DOCS_LOCKS.map((lock) => lock.id)).toEqual([
      'nav-docs-product-2026-09-26',
      'nav-product-blog-points-studio-2026-09-26',
      'boundary-blog-studio-docs-ref-2026-09-26',
    ]);
    for (const lock of NAV_DOCS_LOCKS) {
      expect(lock.status).toBe('admitted');
      expect(lock.statement.length).toBeGreaterThan(0);
    }
  });

  it('sends product blog hops to the Studio blog', () => {
    expect(STUDIO_BLOG_HREF).toBe('https://revealuistudio.com/blog');
    expect(PRODUCT_BLOG_HOPS.index).toBe(STUDIO_BLOG_HREF);
    expect(PRODUCT_BLOG_HOPS.philosophy).toBe(
      'https://revealuistudio.com/blog/01-why-we-built-revealui',
    );
    expect(PRODUCT_BLOG_HOPS.postPattern).toBe('https://revealuistudio.com/blog/:path*');
    expect(pointsAtDocsBlog(PRODUCT_BLOG_HOPS.index)).toBe(false);
    expect(pointsAtDocsBlog(PRODUCT_BLOG_HOPS.philosophy)).toBe(false);
  });

  it('builds a single Studio post path and refuses a docs blog target', () => {
    expect(studioBlogPostHref('16-ui-of-the-future')).toBe(
      'https://revealuistudio.com/blog/16-ui-of-the-future',
    );
    expect(studioBlogPostHref('')).toBe(STUDIO_BLOG_HREF);
    expect(studioBlogPostHref('a/b')).toBe(STUDIO_BLOG_HREF);
    expect(DOCS_BLOG_PREFIX).toBe('https://docs.revealui.com/blog');
    expect(pointsAtDocsBlog('https://docs.revealui.com/blog')).toBe(true);
    expect(pointsAtDocsBlog('https://docs.revealui.com/blog/16-ui-of-the-future')).toBe(true);
    expect(pointsAtDocsBlog('https://docs.revealui.com/blog?x=1')).toBe(true);
    expect(pointsAtDocsBlog('https://docs.revealui.com/auth')).toBe(false);
    expect(pointsAtDocsBlog(STUDIO_BLOG_HREF)).toBe(false);
    expect(textPointsAtDocsBlog(`see ${DOCS_BLOG_PREFIX}/01-why-we-built-revealui`)).toBe(true);
    expect(textPointsAtDocsBlog(STUDIO_BLOG_HREF)).toBe(false);
  });

  it('treats /blog as a docs blog path and leaves product reference paths alone', () => {
    expect(isDocsBlogPath('/blog')).toBe(true);
    expect(isDocsBlogPath('/blog/01-why-we-built-revealui')).toBe(true);
    expect(isDocsBlogPath('/blogger')).toBe(false);
    expect(isDocsBlogPath('/auth')).toBe(false);
  });
});
