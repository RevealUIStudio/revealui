/**
 * Create Method
 *
 * Creates a new document in a collection with hook handling.
 */

import type { RevealRequest as ContractsRevealRequest } from '@revealui/contracts/admin';
import type { RevealCreateOptions, RevealDocument, RevealUIInstance } from '../../types/index.js';
import { callHooks } from './hooks.js';

export async function create(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealCreateOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected();
  const { collection, req } = options;

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`);
  }

  const collectionConfig = instance.config.collections?.find((c) => c.slug === collection);

  // Enforce collection-level access control (skip when overrideAccess is set,
  // matching the low-level create() guard in collections/operations/create.ts)
  if (collectionConfig?.access?.create && options.req && !options.overrideAccess) {
    const canCreate = await collectionConfig.access.create({
      req: options.req as unknown as ContractsRevealRequest,
      data: options.data,
    });
    if (!canCreate) {
      throw new Error('Access denied: you do not have permission to create in this collection');
    }
  }

  let doc = await instance.collections[collection].create(options);

  // Call afterChange hooks
  if (collectionConfig?.hooks?.afterChange && req) {
    doc = await callHooks(
      collectionConfig.hooks.afterChange,
      {
        doc,
        context: {
          revealui: instance,
          collection,
          operation: 'create',
          req,
        },
      },
      instance,
    );
  }

  return doc;
}
