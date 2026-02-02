/**
 * CLI Utilities Module
 *
 * Exports CLI-related utilities including unified command dispatcher.
 */

export {
  type DispatchMode,
  type DispatchOptions,
  type DispatchResult,
  dispatchCommand,
  dispatchOrThrow,
} from './dispatch.js'
