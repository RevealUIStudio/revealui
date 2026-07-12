import { getRestClient } from '@revealui/db/client';
import { getAllSites } from '@revealui/db/queries/sites';

/**
 * Canonical CMS site that dashboard-authored pages belong to when the operator
 * runs a single site and the dashboard shows no site picker. Shared by the
 * typed pages bridge (engine write path) and the content proxy (list/create
 * forwarding) so both surfaces resolve one default and never drift apart.
 */
export const DEFAULT_CMS_SITE_ID = 'fleet-marketing';

/**
 * Resolve the site a page list or create belongs to when the caller supplies no
 * explicit siteId. A single-site operator gets their one site with no picker to
 * choose from. A fresh instance with no sites, or a multi-site instance, falls
 * back to the canonical CMS site until the dashboard grows a picker (multi-site
 * scoping is a later phase). The resolution runs server-side against the sites
 * table so the client never has to know which site it is editing.
 */
export async function resolveDefaultSiteId(): Promise<string> {
  const db = getRestClient();
  const sites = await getAllSites(db, { limit: 2 });
  const [only] = sites;
  if (sites.length === 1 && only) {
    return only.id;
  }
  return DEFAULT_CMS_SITE_ID;
}
