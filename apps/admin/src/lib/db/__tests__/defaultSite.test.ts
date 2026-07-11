import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRestClient } = vi.hoisted(() => ({
  getRestClient: vi.fn(() => ({})),
}));

vi.mock('@revealui/db/client', () => ({
  getRestClient,
}));

import { getAllSites } from '@revealui/db/queries/sites';

vi.mock('@revealui/db/queries/sites', () => ({
  getAllSites: vi.fn(),
}));

import { DEFAULT_CMS_SITE_ID, resolveDefaultSiteId } from '../defaultSite';

const mockGetAllSites = vi.mocked(getAllSites);

type Sites = Awaited<ReturnType<typeof getAllSites>>;
const asSites = (rows: Array<{ id: string }>): Sites => rows as unknown as Sites;

describe('resolveDefaultSiteId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the single site id for a single-site operator (no picker needed)', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([{ id: 'acme' }]));
    await expect(resolveDefaultSiteId()).resolves.toBe('acme');
  });

  it('falls back to the canonical CMS site when no sites exist yet', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([]));
    await expect(resolveDefaultSiteId()).resolves.toBe(DEFAULT_CMS_SITE_ID);
  });

  it('falls back to the canonical CMS site when more than one site exists', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([{ id: 'a' }, { id: 'b' }]));
    await expect(resolveDefaultSiteId()).resolves.toBe(DEFAULT_CMS_SITE_ID);
  });

  it('requests at most two sites so single-versus-many stays distinguishable', async () => {
    mockGetAllSites.mockResolvedValueOnce(asSites([{ id: 'a' }]));
    await resolveDefaultSiteId();
    expect(mockGetAllSites).toHaveBeenCalledWith(expect.anything(), { limit: 2 });
  });
});
