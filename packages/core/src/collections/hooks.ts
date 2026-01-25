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

  const hooks = config.hooks.afterChange as Array<
    (args: {
      doc: RevealDocument
      context: {
        revealui?: RevealUIInstance
        collection: string
        operation: 'create' | 'update'
        previousDoc?: RevealDocument
        req: RevealRequest
      }
      req: RevealRequest
      operation: 'create' | 'update'
      previousDoc?: RevealDocument
      collection: string
    }) => Promise<RevealDocument | undefined> | RevealDocument | undefined
  >

  let result = doc
  for (const hook of hooks) {
    const hookResult = await hook({
      doc: result,
      context: {
        revealui,
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
      result = hookResult
    }
  }
  return result
}
