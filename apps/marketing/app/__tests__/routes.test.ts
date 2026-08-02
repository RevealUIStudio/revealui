import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Router } from '@revealui/router';
import { describe, expect, it } from 'vitest';
import { BlogIndexPage } from '../routes/BlogIndexPage';
import { BlogPostPage } from '../routes/BlogPostPage';
import { ClaimsPage } from '../routes/ClaimsPage';
import { ContactPage } from '../routes/ContactPage';
import { FairSourcePage } from '../routes/FairSourcePage';
import { HomePage } from '../routes/HomePage';
import { NotFoundPage } from '../routes/NotFoundPage';
import { PricingPage } from '../routes/PricingPage';
import { PrivacyPage } from '../routes/PrivacyPage';
import { ProductsPage } from '../routes/ProductsPage';
import { RoadmapPage } from '../routes/RoadmapPage';
import { TermsPage } from '../routes/TermsPage';

describe('marketing route registry', () => {
  it('matches every advertised path to a component', () => {
    const router = new Router();
    router.registerRoutes([
      { path: '/', component: HomePage },
      { path: '/products', component: ProductsPage },
      { path: '/pricing', component: PricingPage },
      { path: '/blog', component: BlogIndexPage },
      { path: '/blog/:slug', component: BlogPostPage },
      { path: '/contact', component: ContactPage },
      { path: '/fair-source', component: FairSourcePage },
      { path: '/roadmap', component: RoadmapPage },
      { path: '/claims', component: ClaimsPage },
      { path: '/privacy', component: PrivacyPage },
      { path: '/terms', component: TermsPage },
      { path: '/*notfound', component: NotFoundPage },
    ]);

    // Every path the marketing site advertises (in NavBar, Footer, sitemap.xml)
    // must resolve to a registered route. A regression here typically means
    // a route was renamed or removed without updating the corresponding link.
    const advertisedPaths = [
      '/',
      '/products',
      '/pricing',
      '/blog',
      '/blog/getting-started',
      '/blog/ui-of-the-future',
      '/blog/shareable-upside',
      '/blog/open-runtime-for-fde-work',
      '/contact',
      '/fair-source',
      '/roadmap',
      '/claims',
      '/privacy',
      '/terms',
    ];

    for (const path of advertisedPaths) {
      const match = router.match(path);
      expect(match, `path ${path} did not match any route`).not.toBeNull();
    }
  });

  it('catches unknown paths via the wildcard 404 route', () => {
    const router = new Router();
    router.registerRoutes([
      { path: '/', component: HomePage },
      { path: '/*notfound', component: NotFoundPage },
    ]);

    const match = router.match('/nonexistent-path');
    expect(match).not.toBeNull();
    expect(match?.route.component).toBe(NotFoundPage);
  });

  it('redirects the legacy /coming-soon path to /roadmap', () => {
    // /coming-soon was the route's path before the Phase 4 rename. A permanent
    // edge redirect (vercel.json) keeps old bookmarks and indexed links alive.
    // Resolve from cwd (the marketing package root under vitest), not
    // import.meta.url — vitest's module URL is not a file: scheme in CI.
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { redirects?: Array<{ source: string; destination: string; permanent?: boolean }> };
    const redirect = vercelConfig.redirects?.find((entry) => entry.source === '/coming-soon');
    expect(redirect, 'the /coming-soon → /roadmap redirect must survive the rename').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('redirects the removed /marketplace path to /roadmap', () => {
    // /marketplace was removed as a standalone page (marketplace-reframe ADR).
    // The transactional venue moves to revmarket; the marketing site points at
    // /roadmap where RevMarket is listed as planned. A permanent 308 edge
    // redirect (vercel.json) preserves indexed links and bookmarks.
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { redirects?: Array<{ source: string; destination: string; permanent?: boolean }> };
    const redirect = vercelConfig.redirects?.find((entry) => entry.source === '/marketplace');
    expect(redirect, 'the /marketplace → /roadmap redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('redirects the retired /for-operators path to /services', () => {
    // Funnel collapse 2026-08-02: operator entry is /services (not the
    // homepage ?for=non-technical alias). Permanent edge redirect preserves
    // bookmarks and indexed links.
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { redirects?: Array<{ source: string; destination: string; permanent?: boolean }> };
    const redirect = vercelConfig.redirects?.find((entry) => entry.source === '/for-operators');
    expect(redirect, 'the /for-operators → /services redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/services');
    expect(redirect?.permanent).toBe(true);
  });

  it('redirects the removed /sponsor path to /roadmap', () => {
    // /sponsor was removed (GAP-305): every sponsorship CTA pointed at a GitHub
    // Sponsors listing that was never enabled (hasSponsorsListing: false), so
    // the page was a dead end. A permanent edge redirect (vercel.json)
    // preserves the repo's FUNDING.yml custom link and any indexed links.
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { redirects?: Array<{ source: string; destination: string; permanent?: boolean }> };
    const redirect = vercelConfig.redirects?.find((entry) => entry.source === '/sponsor');
    expect(redirect, 'the /sponsor → /roadmap redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });
});
