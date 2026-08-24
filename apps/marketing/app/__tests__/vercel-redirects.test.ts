import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelCondition {
  type: string;
  key?: string;
  value?: string;
}

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: VercelCondition[];
  missing?: VercelCondition[];
}

interface VercelRewrite {
  source: string;
  destination: string;
}

interface VercelConfig {
  redirects?: VercelRedirect[];
  rewrites?: VercelRewrite[];
}

function readVercelConfig(): VercelConfig {
  return JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
  ) as VercelConfig;
}

function incomingSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

function matchesQueryCondition(condition: VercelCondition, incoming: URLSearchParams): boolean {
  if (condition.type !== 'query' || condition.key === undefined) {
    return false;
  }
  if (condition.value === undefined) {
    return incoming.has(condition.key);
  }
  return incoming.get(condition.key) === condition.value;
}

function redirectMatchesPath(redirect: VercelRedirect, pathname: string, search: string): boolean {
  if (redirect.source !== pathname) {
    return false;
  }
  // Host-conditioned rules are for other apexes (www, community), not this hop.
  if ((redirect.has ?? []).some((condition) => condition.type === 'host')) {
    return false;
  }
  const incoming = incomingSearchParams(search);
  const hasOk = (redirect.has ?? []).every((condition) =>
    matchesQueryCondition(condition, incoming),
  );
  const missingOk = (redirect.missing ?? []).every(
    (condition) => !matchesQueryCondition(condition, incoming),
  );
  return hasOk && missingOk;
}

/** Vercel first-match + query-append, the live 308 behavior on revealui.com. */
function resolveMarketingHop(pathname: string, search = ''): string | undefined {
  const match = (readVercelConfig().redirects ?? []).find((redirect) =>
    redirectMatchesPath(redirect, pathname, search),
  );
  if (!match) {
    return undefined;
  }
  const incoming = search.startsWith('?') ? search.slice(1) : search;
  if (incoming.length === 0) {
    return match.destination;
  }
  const separator = match.destination.includes('?') ? '&' : '?';
  return `${match.destination}${separator}${incoming}`;
}

describe('marketing vercel.json redirects', () => {
  it('redirects the community.revealui.com apex and every other path to Discussions', () => {
    const communityRules = (readVercelConfig().redirects ?? []).filter((entry) =>
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
    // so community.revealui.com/ falls through to index.html without this
    // explicit apex host rule. Live 2026-08-24: / was 200 marketing HTML
    // (same index-DW5oh8RB.js as revealui.com); /login and /pricing 308'd.
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

  it('308s /quote and /calculator to /pricing before the SPA rewrite', () => {
    const config = readVercelConfig();
    const redirects = config.redirects ?? [];
    const rewrites = config.rewrites ?? [];
    const spaFallback = rewrites.find(
      (entry) => entry.source === '/(.*)' && entry.destination === '/index.html',
    );
    expect(spaFallback, 'the SPA catch-all rewrite must remain after redirects').toBeDefined();

    for (const source of ['/quote', '/calculator'] as const) {
      const redirect = redirects.find((entry) => entry.source === source);
      expect(redirect, `${source} must be a Vercel redirect, not the SPA rewrite`).toBeDefined();
      expect(redirect?.destination).toBe('/pricing');
      expect(redirect?.destination.includes('revealuistudio.com')).toBe(false);
      expect(redirect?.permanent).toBe(true);
      expect(rewrites.some((entry) => entry.source === source)).toBe(false);
    }
  });

  it('308s /security to the GitHub SECURITY.md policy, not the docs homepage', () => {
    // Live 2026-08-24: security.txt Policy + comment point at
    // https://revealui.com/security, which 308'd to docs.revealui.com/
    // (docs homepage). docs.revealui.com/security is a SPA shell, not the
    // policy. The real policy is SECURITY.md on main.
    const redirect = (readVercelConfig().redirects ?? []).find(
      (entry) => entry.source === '/security',
    );
    expect(redirect, '/security must stay a Vercel redirect').toBeDefined();
    expect(redirect?.destination).toBe(
      'https://github.com/RevealUIStudio/revealui/security/policy',
    );
    expect(redirect?.destination.includes('docs.revealui.com')).toBe(false);
    expect(redirect?.permanent).toBe(true);
  });

  it('308s bare /checkout onto admin signup with the Pro trial plan', () => {
    // Live 2026-08-24: /checkout 308'd to admin /signup with no plan, so
    // strangers landed on generic free signup. /checkout?plan=pro already
    // forwarded. Default the empty hop to Pro; keep ?plan= / ?license=.
    const dest = resolveMarketingHop('/checkout');
    expect(dest).toBe('https://admin.revealui.com/signup?plan=pro');
  });

  it('forwards existing /checkout?plan= and /checkout?license= without injecting plan=pro', () => {
    expect(resolveMarketingHop('/checkout', '?plan=pro')).toBe(
      'https://admin.revealui.com/signup?plan=pro',
    );
    expect(resolveMarketingHop('/checkout', '?plan=max')).toBe(
      'https://admin.revealui.com/signup?plan=max',
    );
    expect(resolveMarketingHop('/checkout', '?license=pro')).toBe(
      'https://admin.revealui.com/signup?license=pro',
    );
    expect(resolveMarketingHop('/checkout', '?license=pro')).not.toContain('plan=');
    expect(resolveMarketingHop('/checkout', '?plan=max')).not.toContain('plan=pro');
  });

  it('keeps /signup query-less so ?plan=pro still forwards, and bare /signup stays free', () => {
    expect(resolveMarketingHop('/signup')).toBe('https://admin.revealui.com/signup');
    expect(resolveMarketingHop('/signup', '?plan=pro')).toBe(
      'https://admin.revealui.com/signup?plan=pro',
    );
  });
});
