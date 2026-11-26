import { getRestClient } from '@revealui/db/client';
import { getAllSites, getSiteById } from '@revealui/db/queries/sites';

/**
 * Canonical site used by maintained internal seeds. Authenticated dashboard
 * writes resolve an owned default through resolveDefaultSiteId instead.
 */
export const DEFAULT_CMS_SITE_ID = 'fleet-marketing';

export class SiteSelectionRequiredError extends Error {}

/** Resolve only an authenticated caller's owned site, never a global default. */
export async function resolveDefaultSiteId(userId: string): Promise<string> {
  if (!userId) throw new Error('Authenticated site owner is required');
  const db = getRestClient();
  const owned = await getAllSites(db, { ownerId: userId, limit: 2 });
  if (owned.length === 1 && owned[0]) return owned[0].id;
  // Multi-site operators may retain their canonical site only when they own it.
  const canonical = await getSiteById(db, DEFAULT_CMS_SITE_ID);
  if (canonical?.ownerId === userId) return canonical.id;
  throw new SiteSelectionRequiredError('Select a site you own before creating or listing pages');
}
