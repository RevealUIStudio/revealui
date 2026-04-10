/**
 * Update Method
 *
 * Updates an existing document in a collection with hook handling.
 */

import type { RevealRequest as ContractsRevealRequest } from '@revealui/contracts/admin';
import type { RevealDocument, RevealUIInstance, RevealUpdateOptions } from '../../types/index.js';
import { callHooks } from './hooks.js';

export async function update(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealUpdateOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected();
  const { collection, req } = options;

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`);
  }

  const collectionConfig = instance.config.collections?.find((c) => c.slug === collection);

  // Enforce collection-level access control
  if (collectionConfig?.access?.update && options.req) {
    const canUpdate = await collectionConfig.access.update({
      req: options.req as unknown as ContractsRevealRequest,
      id: options.id,
    });
    if (!canUpdate) {
      throw new Error('Access denied: you do not have permission to update in this collection');
    }
  }

  const previousDoc = await instance.collections[collection].findByID({
    id: options.id,
  });
  let doc = await instance.collections[collection].update(options);

  // Call afterChange hooks
  if (collectionConfig?.hooks?.afterChange && req) {
    doc = await callHooks(
      collectionConfig.hooks.afterChange,
      {
        doc,
        context: {
          revealui: instance,
          collection,
          operation: 'update',
          previousDoc: previousDoc as RevealDocument | undefined,
          req,
        },
      },
      instance,
    );
  }

  return doc;
}
