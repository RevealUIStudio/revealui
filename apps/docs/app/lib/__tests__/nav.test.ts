import { describe, expect, it } from 'vitest';
import {
  isDocsBlogPath,
  NAV_DOCS_LOCK_IDS,
} from '../../../../../packages/contracts/src/nav-docs-boundary.ts';
import { buildDocNavSections, initialOpenSectionTitles } from '../nav.js';

describe('docs public nav', () => {
  it('labels Enterprise and points at /enterprise, not /forge', () => {
    const sections = buildDocNavSections([]);
    const pro = sections.find((section) => section.title === 'Pro & Enterprise');
    expect(pro).toBeDefined();
    const enterprise = pro?.items.find((item) => item.label === 'Enterprise');
    expect(enterprise?.path).toBe('/enterprise');
    expect(pro?.items.some((item) => item.path === '/forge')).toBe(false);
    expect(pro?.items.some((item) => item.label === 'Forge')).toBe(false);
  });

  it('does not list companion products or /revealfleet as a get-started path', () => {
    const sections = buildDocNavSections([]);
    expect(sections.some((section) => section.title.includes('RevealFleet'))).toBe(false);
    expect(sections.some((section) => section.title.includes('companion'))).toBe(false);
    const paths = sections.flatMap((section) => section.items.map((item) => item.path));
    expect(paths.includes('/revealfleet')).toBe(false);
    expect(paths.includes('/fleet')).toBe(false);
  });

  it('does not present Blog as a docs sidebar pillar', () => {
    expect(NAV_DOCS_LOCK_IDS.docsProduct).toBe('nav-docs-product-2026-09-26');
    const sections = buildDocNavSections([]);
    expect(sections.some((section) => section.title === 'Blog')).toBe(false);
    const paths = sections.flatMap((section) => section.items.map((item) => item.path));
    expect(paths.some((path) => isDocsBlogPath(path))).toBe(false);
  });

  it('opens the section that owns the current path, otherwise Getting Started', () => {
    const sections = buildDocNavSections([{ label: 'Button', path: '/showcase/button' }]);

    expect(initialOpenSectionTitles(sections, '/auth')).toEqual(['Core Guides']);
    expect(initialOpenSectionTitles(sections, '/showcase/button')).toEqual(['Showcase']);
    expect(initialOpenSectionTitles(sections, '/')).toEqual(['Getting Started']);
    expect(initialOpenSectionTitles(sections, '/blog/01-why-we-built-revealui')).toEqual([
      'Getting Started',
    ]);
  });
});
