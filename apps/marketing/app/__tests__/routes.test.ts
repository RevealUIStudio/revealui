import { Router } from '@revealui/router';
import { describe, expect, it } from 'vitest';
import { BlogIndexPage } from '../routes/BlogIndexPage';
import { BlogPostPage } from '../routes/BlogPostPage';
import { ComingSoonPage } from '../routes/ComingSoonPage';
import { ContactPage } from '../routes/ContactPage';
import { FairSourcePage } from '../routes/FairSourcePage';
import { HomePage } from '../routes/HomePage';
import { MarketplacePage } from '../routes/MarketplacePage';
import { NotFoundPage } from '../routes/NotFoundPage';
import { PricingPage } from '../routes/PricingPage';
import { PrivacyPage } from '../routes/PrivacyPage';
import { ProductsPage } from '../routes/ProductsPage';
import { ServicesPage } from '../routes/ServicesPage';
import { SponsorPage } from '../routes/SponsorPage';
import { TermsPage } from '../routes/TermsPage';

describe('marketing route registry', () => {
  it('matches every advertised path to a component', () => {
    const router = new Router();
    router.registerRoutes([
      { path: '/', component: HomePage },
      { path: '/products', component: ProductsPage },
      { path: '/services', component: ServicesPage },
      { path: '/marketplace', component: MarketplacePage },
      { path: '/pricing', component: PricingPage },
      { path: '/blog', component: BlogIndexPage },
      { path: '/blog/:slug', component: BlogPostPage },
      { path: '/contact', component: ContactPage },
      { path: '/fair-source', component: FairSourcePage },
      { path: '/coming-soon', component: ComingSoonPage },
      { path: '/sponsor', component: SponsorPage },
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
      '/services',
      '/marketplace',
      '/pricing',
      '/blog',
      '/blog/getting-started',
      '/contact',
      '/fair-source',
      '/coming-soon',
      '/sponsor',
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
});
