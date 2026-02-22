/**
 * Find Method
 *
 * Finds multiple documents from a collection with validation and DataLoader setup.
 */

import { getDataLoader } from '../../dataloader.js'
import type {
  RevealFindOptions,
  RevealPaginatedResult,
  RevealUIInstance,
} from '../../types/index.js'
import { validateJWTFromRequest } from '../../utils/jwt-validation.js'

export async function find(
  instance: RevealUIInstance,
  ensureDbConnected: () => Promise<void>,
  options: RevealFindOptions & { collection: string },
): Promise<RevealPaginatedResult> {
  await ensureDbConnected()
  const { collection, req } = options

  // Validate JWT token if authorization header is provided
  await validateJWTFromRequest(req)

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  // Ensure request context has DataLoader if needed
  if (req && !req.dataLoader) {
    req.revealui = instance
    req.transactionID = req.transactionID || 'default'
    req.dataLoader = getDataLoader(req)
  }

  return instance.collections[collection].find(options)
}
