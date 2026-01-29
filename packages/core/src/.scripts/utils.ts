/**
 * Shared Utilities - Re-export from scripts/lib
 *
 * This file provides backward compatibility for scripts that import from
 * this legacy location. New scripts should import directly from
 * '@revealui/scripts-lib' or the scripts/lib directory.
 *
 * @deprecated Import from '@revealui/scripts-lib' instead
 */

export {
  confirm,
  createLogger,
  execCommand,
  fileExists,
  getProjectRoot,
  handleASTParseError,
  prompt,
  type Logger,
  type ScriptResult,
} from '../../../../scripts/lib/index.js'
