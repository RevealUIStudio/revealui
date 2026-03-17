/**
 * CLI Utilities Module
 *
 * Exports CLI-related utilities including unified command dispatcher.
 *
 * @dependencies
 * - scripts/lib/cli/dispatch.ts - Command dispatch implementation
 */

export {
  type DispatchMode,
  type DispatchOptions,
  type DispatchResult,
  dispatchCommand,
  dispatchOrThrow,
} from './dispatch.js';
