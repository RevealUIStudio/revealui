/**
 * Create Method
 *
 * Creates a new document in a collection with hook handling.
 */

import type {
  CollectionConfig,
  RevealCreateOptions,
  RevealDocument,
  RevealUIInstance,
} from '../../types/index.js'
import { callHooks } from './hooks.js'

export async function create(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealCreateOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected()
  const { collection, req } = options

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  const collectionConfig = instance.config.collections?.find(
    (c: CollectionConfig) => c.slug === collection,
  )
  let doc = await instance.collections[collection].create(options)

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
    )
  }

  return doc
}
