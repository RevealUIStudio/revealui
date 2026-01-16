/**
 * Instance Hooks
 *
 * Utilities for calling instance-level hooks.
 */

import type {
  RevealAfterChangeHook,
  RevealDocument,
  RevealHookContext,
  RevealRequest,
  RevealUIInstance,
} from '../../types/index.js'

/**
 * Helper function to call hooks
 */
export async function callHooks(
  hooks: RevealAfterChangeHook[] | undefined,
  args: {
    doc: RevealDocument
    context: RevealHookContext
  },
  revealui: RevealUIInstance,
): Promise<RevealDocument> {
  let result = args.doc

  if (!hooks) return result

  for (const hook of hooks) {
    try {
      const hookResult = await hook({
        doc: result,
        context: args.context,
        req: args.context.req || ({} as RevealRequest),
        operation: args.context.operation,
        previousDoc: args.context.previousDoc,
        collection: args.context.collection,
      })
      if (hookResult !== undefined) {
        result = hookResult as RevealDocument
      }
    } catch (error) {
      revealui.logger.error(`Hook execution failed: ${error}`)
    }
  }

  return result
}
