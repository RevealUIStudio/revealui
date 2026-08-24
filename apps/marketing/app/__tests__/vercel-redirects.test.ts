import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: Array<{ type: string; value: string }>;
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
});
