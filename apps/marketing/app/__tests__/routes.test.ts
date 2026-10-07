import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { NotFoundPage } from '../routes/NotFoundPage';

// Keep route registration and destination calculation real without leaving jsdom.
vi.mock('../routes/MovedPage', () => ({
  MovedPage: ({ to }: { to: string }) => createElement('a', { href: to }, 'Moved destination'),
}));

afterEach(cleanup);

function appRouter(): Router {
  window.history.replaceState({}, '', '/');
  const router = new Router();
  const app = render(createElement(RouterProvider, { router, children: createElement(App) }));
  app.unmount();
  return router;
}

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: Array<{ type: string; value: string }>;
}

function readRedirects(): VercelRedirect[] {
  const vercelConfig = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { redirects?: VercelRedirect[] };
  return (vercelConfig.redirects ?? []).filter(
    (entry) => !(entry.has ?? []).some((condition) => condition.type === 'host'),
  );
}

describe('marketing route registry', () => {
  it('discovers every active page through the sitemap and matches the actual App registry', () => {
    const router = appRouter();
    const redirects = readRedirects();
    const sitemap = readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
    const sitemapXml = new DOMParser().parseFromString(sitemap, 'application/xml');
    const sitemapPaths = Array.from(
      sitemapXml.getElementsByTagName('loc'),
      (node) => new URL(node.textContent ?? '').pathname,
    );
    const activeRoutes = router
      .getRoutes()
      .filter(
        (route) =>
          route.meta?.description && !redirects.some((entry) => entry.source === route.path),
      );
    expect(sitemapPaths).toContain('/');
    for (const route of activeRoutes) {
      expect(sitemapPaths, `${route.path} is active but missing from discovery`).toContain(
        route.path,
      );
    }
    for (const advertised of sitemapPaths) {
      expect(router.match(advertised)?.route.component).toBeDefined();
      expect(router.match(advertised)?.route.component).not.toBe(NotFoundPage);
      expect(redirects.find((entry) => entry.source === advertised)).toBeUndefined();
    }
  });

  it('keeps every registered moved page aligned with its hosting redirect', () => {
    const router = appRouter();
    const redirects = readRedirects();
    for (const route of router.getRoutes()) {
      if (route.meta?.title !== 'Moved | RevealUI' && route.path !== '/upgrade') continue;
      const source = route.path === '/blog/:slug' ? '/blog/:path*' : route.path;
      const redirect = redirects.find((entry) => entry.source === source);
      // Legal procurement notices intentionally remain on this site.
      if (route.path.startsWith('/legal/')) continue;
      expect(redirect, `missing hosting redirect for ${route.path}`).toBeDefined();
      if (!route.component) throw new Error(`missing moved component for ${route.path}`);
      const page = render(
        createElement(RouterProvider, { router, children: createElement(route.component) }),
      );
      expect(screen.getByRole('link', { name: 'Moved destination' }).getAttribute('href')).toBe(
        route.path === '/blog/:slug' ? 'https://revealuistudio.com/blog' : redirect?.destination,
      );
      page.unmount();
    }
  });

  it('keeps machine-readable local page links on active registered pages', () => {
    const router = appRouter();
    const llms = readFileSync(path.resolve(process.cwd(), 'public/llms.txt'), 'utf8');
    const links = llms
      .split('](')
      .slice(1)
      .map((part) => part.split(')')[0] ?? '')
      .filter((href) => href.startsWith('https://revealui.com/'))
      .map((href) => new URL(href).pathname);
    expect(links).toContain('/claims');
    expect(links).toContain('/templates');
    for (const link of links) {
      const match = router.match(link);
      expect(match?.route.component, `undiscovered page ${link}`).toBeDefined();
      expect(match?.route.component).not.toBe(NotFoundPage);
      expect(readRedirects().find((entry) => entry.source === link)).toBeUndefined();
    }
  });

  it('replaces homepage social-card metadata on an actual subpage', () => {
    const previousHead = document.head.innerHTML;
    try {
      document.head.innerHTML = '';
      for (const property of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:url']) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', property);
        meta.content = 'Previous home preview';
        document.head.appendChild(meta);
      }
      for (const name of ['description', 'twitter:title', 'twitter:description', 'twitter:image']) {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = 'Previous home preview';
        document.head.appendChild(meta);
      }
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = 'https://revealui.com';
      document.head.appendChild(canonical);
      window.history.replaceState({}, '', '/contact');
      const router = new Router();
      render(createElement(RouterProvider, { router, children: createElement(App) }));
      const route = router.match('/contact')?.route;
      expect(document.title).toBe('Contact | RevealUI');
      expect(canonical.href).toBe('https://revealui.com/contact');
      const image = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
      expect(new URL(image ?? '').searchParams.get('title')).toBe(route?.meta?.title);
      expect(new URL(image ?? '').searchParams.get('description')).toBe(route?.meta?.description);
      expect(
        document.querySelector<HTMLMetaElement>('meta[property="og:image:alt"]')?.content,
      ).toBe(document.title);
      expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content).toBe(
        image,
      );
    } finally {
      document.head.innerHTML = previousHead;
    }
  });

  it('catches unknown paths through the actual App wildcard route', () => {
    expect(appRouter().match('/nonexistent-path')?.route.component).toBe(NotFoundPage);
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

  it('redirects the community.revealui.com apex and every other path to Discussions', () => {
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
    const communityRules = (vercelConfig.redirects ?? []).filter((entry) =>
      (entry.has ?? []).some(
        (rule) => rule.type === 'host' && rule.value === 'community.revealui.com',
      ),
    );
    expect(
      communityRules.length,
      'community.revealui.com host redirects must stay ahead of the SPA rewrite',
    ).toBeGreaterThanOrEqual(2);

    const discussions = 'https://github.com/RevealUIStudio/revealui/discussions';
    const apex = communityRules.find((entry) => entry.source === '/');
    const wildcard = communityRules.find((entry) => entry.source === '/:path*');

    // Vercel path-to-regexp does not match /:path* against the empty path /,
    // so community.revealui.com/ falls through to the SPA rewrite without this
    // explicit apex host rule. Live 2026-08-24: / was 200 marketing HTML;
    // /login, /pricing, /signup, /discussions already 308'd to Discussions.
    expect(
      apex,
      'community.revealui.com/ needs an explicit / host rule; /:path* misses the apex',
    ).toBeDefined();
    expect(apex?.destination).toBe(discussions);
    expect(apex?.permanent).toBe(true);

    expect(wildcard, 'non-apex community paths still need the /:path* host rule').toBeDefined();
    expect(wildcard?.destination).toBe(discussions);
    expect(wildcard?.permanent).toBe(true);
  });

  it('does not redirect /templates away from the marketing SPA', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/templates');
    expect(redirect, '/templates must render on this site, not hop away').toBeUndefined();
    const appSource = readFileSync(path.resolve(process.cwd(), 'app/App.tsx'), 'utf8');
    expect(appSource.includes("path: '/templates'")).toBe(true);
    expect(appSource.includes('TemplatesPage')).toBe(true);
    expect(appSource.includes("title: 'Templates | RevealUI'")).toBe(true);
  });

  it('redirects /services off leftover storefronts and keeps /products as licenses', () => {
    const redirects = readRedirects();
    const services = redirects.find((entry) => entry.source === '/services');
    const products = redirects.find((entry) => entry.source === '/products');
    expect(services?.destination).toBe('/pricing');
    expect(services?.permanent).toBe(true);
    expect(
      products,
      '/products must stay on the product site as licenses, not RevealFleet docs',
    ).toBeUndefined();
  });

  it('redirects the removed /sponsor path to /roadmap', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/sponsor');
    expect(redirect, 'the /sponsor → /roadmap redirect must be present').toBeDefined();
    expect(redirect?.destination).toBe('/roadmap');
    expect(redirect?.permanent).toBe(true);
  });

  it('hops marketing /signup and /login to admin without dropping plan=', () => {
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

    const login = bySource.get('/login');
    expect(login, 'the /login → admin login hop must be present').toBeDefined();
    expect(login?.destination).toBe('https://admin.revealui.com/login');
    expect(login?.destination.includes('?')).toBe(false);
    expect(login?.permanent).toBe(true);
  });

  it('hops the soft-404 /upgrade path to admin Pro signup', () => {
    const redirect = readRedirects().find((entry) => entry.source === '/upgrade');
    expect(redirect, 'the /upgrade → admin signup hop must be present').toBeDefined();
    expect(redirect?.destination).toBe('https://admin.revealui.com/signup?plan=pro');
    expect(redirect?.permanent).toBe(true);

    const appSource = readFileSync(path.resolve(process.cwd(), 'app/App.tsx'), 'utf8');
    expect(appSource.includes("path: '/upgrade'")).toBe(true);
    expect(appSource.includes('https://admin.revealui.com/signup?plan=pro')).toBe(true);
  });
});
