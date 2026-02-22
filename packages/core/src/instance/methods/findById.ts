/**
 * Find By ID Method
 *
 * Finds a single document by ID from a collection with validation and DataLoader setup.
 */

import { getDataLoader } from '../../dataloader.js'
import type { RevealDocument, RevealRequest, RevealUIInstance } from '../../types/index.js'
import { validateJWTFromRequest } from '../../utils/jwt-validation.js'

export async function findByID(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: {
    collection: string
    id: string | number
    depth?: number
    req?: RevealRequest
  },
): Promise<RevealDocument | null> {
  await ensureDbConnected()
  const { collection, req } = options

  // Validate JWT token if authorization header is provided
  await validateJWTFromRequest(req)

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  // Initialize DataLoader for the request if it doesn't exist
  if (req && !req.dataLoader) {
    req.revealui = instance
    req.transactionID = req.transactionID || 'default'
    req.dataLoader = getDataLoader(req)
  }

  return instance.collections[collection].findByID(options)
}
