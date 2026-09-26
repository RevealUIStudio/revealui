import { describe, expect, it } from 'vitest';
import {
  NAV_DOCS_LOCK_IDS,
  pointsAtDocsBlog,
  STUDIO_BLOG_HREF,
} from '../../../../../packages/contracts/src/nav-docs-boundary.ts';
import { FOOTER_COLUMNS, FOOTER_SERVICE_LINKS, PRODUCT_FOOTER_LINKS } from '../nav';

function footerBlob(): string {
  const columns = FOOTER_COLUMNS.flatMap((column) =>
    column.links.map((link) => `${link.label} ${link.href}`),
  );
  const services = FOOTER_SERVICE_LINKS.map((link) => `${link.prefix} ${link.label} ${link.href}`);
  return [...columns, ...services].join('\n').toLowerCase();
}

describe('public product footer paths', () => {
  it('points Blog at the Studio blog', () => {
    expect(NAV_DOCS_LOCK_IDS.productBlogPointsStudio).toBe(
      'nav-product-blog-points-studio-2026-09-26',
    );
    const blogs = [
      ...PRODUCT_FOOTER_LINKS,
      ...FOOTER_COLUMNS.flatMap((column) => column.links),
    ].filter((link) => link.label === 'Blog');
    expect(blogs.length).toBeGreaterThan(0);
    for (const link of blogs) {
      expect(link.href).toBe(STUDIO_BLOG_HREF);
      expect(pointsAtDocsBlog(link.href)).toBe(false);
      expect(link.external).toBe(true);
    }
  });

  it('does not publish agency licensing or a Studio agency footer path', () => {
    const blob = footerBlob();
    expect(blob.includes('agency licensing')).toBe(false);
    expect(blob.includes('revealui studio (agency)')).toBe(false);
    expect(blob.includes('/pricing#perpetual')).toBe(false);
  });
});
