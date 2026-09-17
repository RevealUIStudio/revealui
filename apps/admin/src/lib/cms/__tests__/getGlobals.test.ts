import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.fn();
const getGlobalHeader = vi.fn();
const getGlobalFooter = vi.fn();
const getGlobalSettings = vi.fn();

vi.mock('@revealui/cache', () => ({
  createCachedFunction: (fn: () => unknown) => fn,
}));

vi.mock('@revealui/db', () => ({
  getClient: (...args: unknown[]) => getClient(...args),
}));

vi.mock('@revealui/db/queries/globals', () => ({
  isGlobalSlug: (value: string) => ['header', 'footer', 'settings'].includes(value),
  getGlobalHeader: (...args: unknown[]) => getGlobalHeader(...args),
  getGlobalFooter: (...args: unknown[]) => getGlobalFooter(...args),
  getGlobalSettings: (...args: unknown[]) => getGlobalSettings(...args),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { footerToCms, headerToCms, loadGlobal } from '../getGlobals';

describe('headerToCms / footerToCms', () => {
  it('nests drizzle header nav items under link for the CMS Header', () => {
    const cms = headerToCms({
      id: '1',
      schemaVersion: '1',
      navItems: [{ label: 'Home', url: '/', newTab: true }],
      logoId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(cms.navItems).toEqual([
      { link: { type: 'custom', label: 'Home', url: '/', newTab: true } },
    ]);
    expect(cms.id).toBe('1');
    expect(cms.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('flattens drizzle footer columns into CMS navItems', () => {
    const cms = footerToCms({
      id: '1',
      schemaVersion: '1',
      columns: [
        {
          label: 'Legal',
          links: [{ label: 'Privacy', url: '/privacy' }],
        },
      ],
      copyright: 'RevealUI',
      socialLinks: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(cms.navItems).toEqual([
      { link: { type: 'custom', label: 'Privacy', url: '/privacy', newTab: false } },
    ]);
    expect(cms.copyright).toBe('RevealUI');
  });
});

describe('loadGlobal', () => {
  const db = { kind: 'db' };

  beforeEach(() => {
    getClient.mockReset().mockReturnValue(db);
    getGlobalHeader.mockReset();
    getGlobalFooter.mockReset();
    getGlobalSettings.mockReset();
  });

  it('reads header via drizzle getGlobalHeader', async () => {
    getGlobalHeader.mockResolvedValueOnce({
      id: '1',
      schemaVersion: '1',
      navItems: [{ label: 'Posts', url: '/posts' }],
      logoId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const row = await loadGlobal('header');
    expect(getGlobalHeader).toHaveBeenCalledWith(db);
    expect(row?.id).toBe('1');
    expect(row?.navItems).toEqual([
      { link: { type: 'custom', label: 'Posts', url: '/posts', newTab: false } },
    ]);
  });

  it('returns null for unregistered slugs (MainMenu stays WIRE-UP-PENDING)', async () => {
    expect(await loadGlobal('main-menu')).toBeNull();
    expect(getClient).not.toHaveBeenCalled();
  });

  it('returns null when the getter has no row', async () => {
    getGlobalHeader.mockResolvedValueOnce(undefined);
    expect(await loadGlobal('header')).toBeNull();
  });
});
