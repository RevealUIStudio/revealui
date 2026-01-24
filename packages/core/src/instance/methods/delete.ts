/**
 * Delete Method
 *
 * Deletes a document from a collection.
 */

import type { RevealDeleteOptions, RevealDocument, RevealUIInstance } from '../../types/index.js'

export async function deleteMethod(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealDeleteOptions & { collection: string },
): Promise<RevealDocument> {
  await ensureDbConnected()
  const { collection } = options

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  return instance.collections[collection].delete(options)
}
