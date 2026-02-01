/**
 * CLI Utilities Module
 *
 * Exports CLI-related utilities including unified command dispatcher.
 */

export {
  dispatchCommand,
  dispatchOrThrow,
  type DispatchMode,
  type DispatchOptions,
  type DispatchResult,
} from './dispatch.js'
