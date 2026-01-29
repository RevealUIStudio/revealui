/**
 * Shared Utilities - Re-export from scripts/lib
 *
 * This file provides backward compatibility for scripts that import from
 * './shared/utils.ts' or '../shared/utils.ts'. New scripts should import
 * directly from '@revealui/scripts-lib' or '../../lib/index.ts'.
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
} from '../../lib/index.js'
