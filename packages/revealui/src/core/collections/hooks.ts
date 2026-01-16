/**
 * Collection Hooks
 *
 * Utilities for calling collection hooks.
 */

import type {
  RevealCollectionConfig,
  RevealDocument,
  RevealRequest,
  RevealUIInstance,
} from '../types/index.js'

/**
 * Call afterChange hooks for a collection
 */
export async function callAfterChangeHooks(
  config: RevealCollectionConfig,
  doc: RevealDocument,
  req: RevealRequest,
  operation: 'create' | 'update',
  previousDoc?: RevealDocument,
  revealui?: RevealUIInstance,
): Promise<RevealDocument> {
  if (!config.hooks?.afterChange) {
    return doc
  }

  let result = doc
  for (const hook of config.hooks.afterChange) {
    const hookResult = await hook({
      doc: result,
      context: {
        revealui: revealui || ({} as RevealUIInstance),
        collection: config.slug,
        operation,
        previousDoc,
        req,
      },
      req,
      operation,
      previousDoc,
      collection: config.slug,
    })
    if (hookResult !== undefined) {
      result = hookResult as RevealDocument
    }
  }
  return result
}
