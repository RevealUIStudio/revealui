import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRestClient } = vi.hoisted(() => ({ getRestClient: vi.fn(() => ({})) }));
vi.mock('@revealui/db/client', () => ({ getRestClient }));
vi.mock('@revealui/db/queries/sites', () => ({ getAllSites: vi.fn(), getSiteById: vi.fn() }));

import { getAllSites, getSiteById } from '@revealui/db/queries/sites';
import {
  DEFAULT_CMS_SITE_ID,
  resolveDefaultSiteId,
  SiteSelectionRequiredError,
} from '../defaultSite';

const mockGetAllSites = vi.mocked(getAllSites);
const mockGetSiteById = vi.mocked(getSiteById);
type Sites = Awaited<ReturnType<typeof getAllSites>>;
const asSites = (rows: Array<{ id: string; ownerId?: string }>): Sites => rows as Sites;
describe('resolveDefaultSiteId', () => {
  beforeEach(() => vi.resetAllMocks());
  it('resolves only the authenticated caller single owned site', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([{ id: 'acme', ownerId: 'actor' }]));
    await expect(resolveDefaultSiteId('actor')).resolves.toBe('acme');
    expect(mockGetAllSites).toHaveBeenCalledWith(expect.anything(), { ownerId: 'actor', limit: 2 });
  });
  it('retains a canonical default only when the caller owns it', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([{ id: 'a' }, { id: 'b' }]));
    mockGetSiteById.mockResolvedValueOnce(
      asSites([{ id: DEFAULT_CMS_SITE_ID, ownerId: 'actor' }])[0]!,
    );
    await expect(resolveDefaultSiteId('actor')).resolves.toBe(DEFAULT_CMS_SITE_ID);
  });
  it.each([undefined, { id: DEFAULT_CMS_SITE_ID, ownerId: 'other' }])(
    'never falls back to an absent or another user canonical site: %j',
    async (canonical) => {
      mockGetAllSites.mockResolvedValueOnce([]);
      mockGetSiteById.mockResolvedValueOnce(
        (canonical ?? null) as Awaited<ReturnType<typeof getSiteById>>,
      );
      await expect(resolveDefaultSiteId('actor')).rejects.toBeInstanceOf(
        SiteSelectionRequiredError,
      );
    },
  );
  it('requires an authenticated caller before querying global sites', async () => {
    await expect(resolveDefaultSiteId('')).rejects.toThrow('Authenticated');
    expect(mockGetAllSites).not.toHaveBeenCalled();
  });
});
