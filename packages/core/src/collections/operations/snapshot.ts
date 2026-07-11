/**
 * Snapshot Operations
 *
 * Point-in-time revisions of a document, modeled on the `page_revisions`
 * pattern (per-doc revision number, content snapshot, createdBy,
 * changeDescription).
 *
 * Persistence lives behind the `collectionStorage` seam so the typed store owns
 * the revision table — the same seam `create`/`update`/`delete` already use.
 * Core owns the access gate. This deliberately does NOT introduce a parallel
 * dynamic revisions table: snapshots require a registered typed storage
 * adapter, keeping core drafts thin (the edit-session layer owns its own
 * snapshot path and does not route through here).
 */

import type {
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDocument,
  RevealRequest,
  RevealWhere,
} from '../../types/index.js';
import { find } from './find.js';

function accessDenied(): Error {
  return new Error('Access denied: insufficient permissions to snapshot this document');
}

function snapshotUnsupported(slug: string): Error {
  const err = new Error(
    `Snapshots are not supported for collection '${slug}': no typed storage adapter is registered.`,
  );
  (err as Error & { statusCode: number }).statusCode = 501;
  return err;
}

/**
 * Confirm the caller may write the target document — snapshotting and restoring
 * are part of the edit lifecycle. Reuses `access.update` and the same row-level
 * scoping `update()` uses, so a caller cannot snapshot or restore a row outside
 * its scope.
 */
async function assertWriteAccess(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  id: string | number,
  req: RevealRequest | undefined,
  overrideAccess: boolean | undefined,
): Promise<void> {
  if (overrideAccess) return;
  const updateAccess = (
    config as {
      access?: { update?: (args: { req: RevealRequest; id?: string | number }) => unknown };
    }
  ).access?.update;
  if (!updateAccess) return;
  if (!req) throw accessDenied();
  const result = await updateAccess({ req, id });
  if (result === false) throw accessDenied();
  if (result !== true) {
    const scoped = await find(config, db, {
      where: { and: [{ id: { equals: id } }, result as RevealWhere] },
      limit: 1,
      req,
      overrideAccess: true,
    });
    if (scoped.docs.length === 0) throw accessDenied();
  }
}

export interface SnapshotOptions {
  id: string | number;
  req?: RevealRequest;
  changeDescription?: string;
  overrideAccess?: boolean;
}

export interface RestoreOptions {
  id: string | number;
  revisionId: string | number;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

export async function createSnapshot(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: SnapshotOptions,
): Promise<RevealDocument> {
  const { id, req, changeDescription } = options;
  await assertWriteAccess(config, db, id, req, options.overrideAccess);

  const seam = db?.collectionStorage?.snapshot;
  if (!seam) throw snapshotUnsupported(config.slug);

  const revision = await seam(config, {
    id,
    ...(req ? { req } : {}),
    ...(changeDescription !== undefined ? { changeDescription } : {}),
  });
  if (revision === undefined) throw snapshotUnsupported(config.slug);
  return revision;
}

export async function restoreSnapshot(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RestoreOptions,
): Promise<RevealDocument> {
  const { id, revisionId, req } = options;
  await assertWriteAccess(config, db, id, req, options.overrideAccess);

  const seam = db?.collectionStorage?.restore;
  if (!seam) throw snapshotUnsupported(config.slug);

  const restored = await seam(config, {
    id,
    revisionId,
    ...(req ? { req } : {}),
  });
  if (restored === undefined) throw snapshotUnsupported(config.slug);
  return restored;
}
