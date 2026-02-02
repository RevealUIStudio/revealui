/**
 * Update Method
 *
 * Updates an existing document in a collection with hook handling.
 */

import type {
  CollectionConfig,
  RevealDocument,
  RevealUIInstance,
  RevealUpdateOptions,
} from '../../types/index.js'
import { validateJWTFromRequest } from '../../utils/jwt-validation.js'
import { callHooks } from './hooks.js'

export async function update(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealUpdateOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected()
  const { collection, req } = options

  // Validate JWT token if authorization header is provided
  validateJWTFromRequest(req)

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  const collectionConfig = instance.config.collections?.find(
    (c: CollectionConfig) => c.slug === collection,
  )
  const previousDoc = await instance.collections[collection].findByID({
    id: options.id,
  })
  let doc = await instance.collections[collection].update(options)

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
    )
  }

  return doc
}
