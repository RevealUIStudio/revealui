/**
 * Delete Method
 *
 * Deletes a document from a collection.
 */

import type { RevealDeleteOptions, RevealDocument, RevealUIInstance } from '../../types/index.js'
import { validateJWTFromRequest } from '../../utils/jwt-validation.js'

export async function deleteMethod(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealDeleteOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected()
  const { collection, req } = options

  // Validate JWT token if authorization header is provided
  await validateJWTFromRequest(req)

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  // Enforce collection-level access control
  const collectionConfig = instance.config.collections?.find((c) => c.slug === collection)
  if (collectionConfig?.access?.delete && options.req) {
    const canDelete = await collectionConfig.access.delete({ req: options.req, id: options.id })
    if (!canDelete) {
      throw new Error('Access denied: you do not have permission to delete in this collection')
    }
  }

  return instance.collections[collection].delete(options)
}
