import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Router } from '@revealui/router';
import { describe, expect, it } from 'vitest';
import { ContactPage } from '../routes/ContactPage';
import { CookiesPage } from '../routes/CookiesPage';
import { HomePage } from '../routes/HomePage';
import { NotFoundPage } from '../routes/NotFoundPage';
import { PricingPage } from '../routes/PricingPage';
import { PrivacyPage } from '../routes/PrivacyPage';
import { RefundPolicyPage } from '../routes/RefundPolicyPage';
import { StatusPage } from '../routes/StatusPage';
import { SupportPage } from '../routes/SupportPage';
import { TermsPage } from '../routes/TermsPage';

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
}

function readRedirects(): VercelRedirect[] {
  const vercelConfig = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { redirects?: VercelRedirect[] };
  return vercelConfig.redirects ?? [];
}

describe('marketing route registry', () => {
  it('matches every advertised path to a component', () => {
    const router = new Router();
    router.registerRoutes([
      { path: '/', component: HomePage },
      { path: '/pricing', component: PricingPage },
      { path: '/contact', component: ContactPage },
      { path: '/privacy', component: PrivacyPage },
      { path: '/cookies', component: CookiesPage },
      { path: '/terms', component: TermsPage },
      { path: '/support', component: SupportPage },
      { path: '/refund-policy', component: RefundPolicyPage },
      { path: '/status', component: StatusPage },
      { path: '/*notfound', component: NotFoundPage },
    ]);

    const advertisedPaths = [
      '/',
      '/pricing',
      '/contact',
      '/privacy',
      '/cookies',
      '/terms',
      '/support',
      '/refund-policy',
      '/status',
    ];

    for (const advertised of advertisedPaths) {
      const match = router.match(advertised);
      expect(match, `path ${advertised} did not match any route`).not.toBeNull();
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
    const redirect = readRedirects().find((entry) => entry.source === '/coming-soon');
    expect(redirect, 'the /coming-soon → /roadmap redirect must survive the rename').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('redirects the removed /marketplace path to /roadmap', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/marketplace');
    expect(redirect, 'the /marketplace → /roadmap redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('redirects the retired /for-operators path to /pricing', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/for-operators');
    expect(redirect, 'the /for-operators → /pricing redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/pricing');
    expect(redirect?.permanent).toBe(true);
  });

  it('keeps the community.revealui.com host rule pointed at Discussions', () => {
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      redirects?: Array<{
        source: string;
        destination: string;
        permanent?: boolean;
        has?: Array<{ type: string; value: string }>;
      }>;
    };
    const community = (vercelConfig.redirects ?? []).find((entry) =>
      (entry.has ?? []).some(
        (rule) => rule.type === 'host' && rule.value === 'community.revealui.com',
      ),
    );
    expect(
      community,
      'community.revealui.com host redirect must stay ahead of the SPA rewrite',
    ).toBeDefined();
    expect(community?.destination).toBe('https://github.com/RevealUIStudio/revealui/discussions');
    expect(community?.permanent).toBe(true);
    expect(community?.source).toBe('/:path*');
  });

  it('redirects /services and /products off the leftover storefronts', () => {
    const redirects = readRedirects();
    const services = redirects.find((entry) => entry.source === '/services');
    const products = redirects.find((entry) => entry.source === '/products');
    expect(services?.destination).toBe('/pricing');
    expect(services?.permanent).toBe(true);
    expect(products?.destination).toBe('https://docs.revealui.com/revfleet');
    expect(products?.permanent).toBe(true);
  });

  it('redirects the removed /sponsor path to /roadmap', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/sponsor');
    expect(redirect, 'the /sponsor → /roadmap redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('hops marketing /signup, /checkout, and /login to admin without dropping plan=', () => {
    // These paths have no marketing page. The SPA rewrite used to serve the
    // same empty shell, so a stranger who followed a relative /signup?plan=pro
    // (API catalog, bookmark, or no-JS) never reached admin checkout.
    // Destinations omit a query string so Vercel forwards ?plan=pro unchanged.
    const vercelConfig = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { redirects?: Array<{ source: string; destination: string; permanent?: boolean }> };
    const bySource = new Map((vercelConfig.redirects ?? []).map((entry) => [entry.source, entry]));

    const signup = bySource.get('/signup');
    expect(signup, 'the /signup → admin signup hop must be present').toBeDefined();
    expect(signup?.destination).toBe('https://admin.revealui.com/signup');
    expect(signup?.destination.includes('?')).toBe(false);
    expect(signup?.permanent).toBe(true);

    const checkout = bySource.get('/checkout');
    expect(checkout, 'the /checkout → admin signup hop must be present').toBeDefined();
    expect(checkout?.destination).toBe('https://admin.revealui.com/signup');
    expect(checkout?.destination.includes('?')).toBe(false);
    expect(checkout?.permanent).toBe(true);

    const login = bySource.get('/login');
    expect(login, 'the /login → admin login hop must be present').toBeDefined();
    expect(login?.destination).toBe('https://admin.revealui.com/login');
    expect(login?.destination.includes('?')).toBe(false);
    expect(login?.permanent).toBe(true);
  });
});
