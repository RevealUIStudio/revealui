// console-allowed
/**
 * Soft check: refuse blog as a docs pillar and as a product hop target.
 *
 * Admitted boundary (2026-09-26):
 *   nav-docs-product-2026-09-26
 *   nav-product-blog-points-studio-2026-09-26
 *   boundary-blog-studio-docs-ref-2026-09-26
 *
 * Docs stay product reference. The Studio blog lives on revealuistudio.com.
 * Blog markdown may remain served. This check fails when public nav or
 * product redirects still send readers to docs.revealui.com/blog.
 *
 * Exit 0 when the scanned surfaces match the lock. Exit 1 on a violation.
 * Phase 1 registers this as warn-only.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildDocNavSections, type NavItem } from '../../apps/docs/app/lib/nav.ts';
import {
  DOCS_BLOG_PREFIX,
  isDocsBlogPath,
  NAV_DOCS_LOCK_IDS,
  PRODUCT_BLOG_HOPS,
  STUDIO_BLOG_HREF,
  textPointsAtDocsBlog,
} from '../../packages/contracts/src/nav-docs-boundary.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');

const TEXT_FILES = [
  'apps/marketing/app/App.tsx',
  'apps/marketing/vercel.json',
  'apps/marketing/app/content/nav.ts',
  'docs/INDEX.md',
] as const;

interface VercelRedirect {
  source?: string;
  destination?: string;
}

function collectPaths(items: readonly NavItem[], paths: string[]): void {
  for (const item of items) {
    paths.push(item.path);
    if (item.children) collectPaths(item.children, paths);
  }
}

function blogLabelHrefs(source: string): string[] {
  const hrefs: string[] = [];
  const marker = "label: 'Blog'";
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf(marker, cursor);
    if (at < 0) break;
    const window = source.slice(at, at + 220);
    const hrefKey = window.indexOf('href:');
    if (hrefKey >= 0) {
      const after = window.slice(hrefKey + 'href:'.length).trim();
      const end = after.indexOf(',');
      hrefs.push((end >= 0 ? after.slice(0, end) : after).trim());
    }
    cursor = at + marker.length;
  }
  return hrefs;
}

function indexBlogPillars(source: string): string[] {
  const hits: string[] = [];
  const markers = ['](./blog/', '](/blog/'];
  for (const marker of markers) {
    if (source.includes(marker)) hits.push(marker);
  }
  return hits;
}

export function findBlogInDocsViolations(root = ROOT): string[] {
  const violations: string[] = [];

  const sections = buildDocNavSections([]);
  const paths: string[] = [];
  for (const section of sections) {
    if (section.title === 'Blog') {
      violations.push(`${NAV_DOCS_LOCK_IDS.docsProduct}: docs sidebar still has a Blog section`);
    }
    collectPaths(section.items, paths);
  }
  for (const itemPath of paths) {
    if (isDocsBlogPath(itemPath)) {
      violations.push(
        `${NAV_DOCS_LOCK_IDS.docsProduct}: docs sidebar path ${itemPath} is a blog path`,
      );
    }
  }

  for (const rel of TEXT_FILES) {
    const abs = path.join(root, rel);
    const text = readFileSync(abs, 'utf8');
    if (textPointsAtDocsBlog(text)) {
      violations.push(`${NAV_DOCS_LOCK_IDS.boundary}: ${rel} still points at ${DOCS_BLOG_PREFIX}`);
    }
    if (rel === 'docs/INDEX.md') {
      for (const marker of indexBlogPillars(text)) {
        violations.push(
          `${NAV_DOCS_LOCK_IDS.docsProduct}: docs/INDEX.md still links with ${marker}`,
        );
      }
    }
    if (rel === 'apps/marketing/app/content/nav.ts') {
      for (const href of blogLabelHrefs(text)) {
        const pointsStudio =
          href === 'STUDIO_BLOG_HREF' ||
          href === `'${STUDIO_BLOG_HREF}'` ||
          href === `"${STUDIO_BLOG_HREF}"`;
        if (!pointsStudio) {
          violations.push(
            `${NAV_DOCS_LOCK_IDS.productBlogPointsStudio}: Blog href is ${href}, expected Studio blog`,
          );
        }
      }
    }
  }

  const vercel = JSON.parse(
    readFileSync(path.join(root, 'apps/marketing/vercel.json'), 'utf8'),
  ) as {
    redirects?: VercelRedirect[];
  };
  const redirects = vercel.redirects ?? [];
  const expect = new Map<string, string>([
    ['/blog', PRODUCT_BLOG_HOPS.index],
    ['/blog/:path*', PRODUCT_BLOG_HOPS.postPattern],
    ['/philosophy', PRODUCT_BLOG_HOPS.philosophy],
  ]);
  for (const [source, destination] of expect) {
    const match = redirects.find((entry) => entry.source === source);
    if (!match) {
      violations.push(`${NAV_DOCS_LOCK_IDS.productBlogPointsStudio}: missing redirect ${source}`);
      continue;
    }
    if (match.destination !== destination) {
      violations.push(
        `${NAV_DOCS_LOCK_IDS.productBlogPointsStudio}: ${source} destination is ${match.destination ?? ''}, expected ${destination}`,
      );
    }
  }

  return violations;
}

function main(): void {
  const violations = findBlogInDocsViolations();
  if (violations.length === 0) {
    process.stdout.write('refuse-blog-in-docs: public nav and hops match the admitted boundary\n');
    return;
  }
  process.stderr.write('refuse-blog-in-docs: blog still presented as docs\n');
  for (const violation of violations) {
    process.stderr.write(`  ${violation}\n`);
  }
  process.exitCode = 1;
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('refuse-blog-in-docs.ts')
) {
  main();
}
