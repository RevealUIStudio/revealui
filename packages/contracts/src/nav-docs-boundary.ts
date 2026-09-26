/**
 * Admitted nav/docs boundary (2026-09-26).
 *
 * Docs stay product reference. The Studio blog lives on revealuistudio.com.
 * Product hops that used to land on docs.revealui.com/blog use these hops.
 */

export const NAV_DOCS_LOCK_IDS = {
  docsProduct: 'nav-docs-product-2026-09-26',
  productBlogPointsStudio: 'nav-product-blog-points-studio-2026-09-26',
  boundary: 'boundary-blog-studio-docs-ref-2026-09-26',
} as const;

export type NavDocsLockId = (typeof NAV_DOCS_LOCK_IDS)[keyof typeof NAV_DOCS_LOCK_IDS];

export const NAV_DOCS_BOUNDARY_STATUS = 'admitted' as const;

export interface NavDocsLock {
  readonly id: NavDocsLockId;
  readonly status: typeof NAV_DOCS_BOUNDARY_STATUS;
  readonly statement: string;
}

export const NAV_DOCS_LOCKS: readonly NavDocsLock[] = [
  {
    id: NAV_DOCS_LOCK_IDS.docsProduct,
    status: NAV_DOCS_BOUNDARY_STATUS,
    statement: 'Docs navigation is product reference only.',
  },
  {
    id: NAV_DOCS_LOCK_IDS.productBlogPointsStudio,
    status: NAV_DOCS_BOUNDARY_STATUS,
    statement: 'Product Blog points at the Studio blog.',
  },
  {
    id: NAV_DOCS_LOCK_IDS.boundary,
    status: NAV_DOCS_BOUNDARY_STATUS,
    statement: 'The Studio site hosts the blog. Docs stay product reference.',
  },
];

export const DOCS_ORIGIN = 'https://docs.revealui.com';
export const STUDIO_ORIGIN = 'https://revealuistudio.com';
export const STUDIO_BLOG_HREF = `${STUDIO_ORIGIN}/blog`;
export const DOCS_BLOG_PREFIX = `${DOCS_ORIGIN}/blog`;

export function studioBlogPostHref(slug: string): string {
  const trimmed = slug.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    trimmed.includes('..')
  ) {
    return STUDIO_BLOG_HREF;
  }
  return `${STUDIO_BLOG_HREF}/${trimmed}`;
}

/** Public product redirects. Docs blog URLs stay served until a later drop. */
export const PRODUCT_BLOG_HOPS = {
  index: STUDIO_BLOG_HREF,
  philosophy: studioBlogPostHref('01-why-we-built-revealui'),
  postPattern: `${STUDIO_BLOG_HREF}/:path*`,
} as const;

export function isDocsBlogPath(path: string): boolean {
  return path === '/blog' || path.startsWith('/blog/');
}

export function pointsAtDocsBlog(url: string): boolean {
  return (
    url === DOCS_BLOG_PREFIX ||
    url.startsWith(`${DOCS_BLOG_PREFIX}/`) ||
    url.startsWith(`${DOCS_BLOG_PREFIX}?`)
  );
}

export function textPointsAtDocsBlog(text: string): boolean {
  return text.includes(DOCS_BLOG_PREFIX);
}
