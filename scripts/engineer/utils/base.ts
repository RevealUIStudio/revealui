/**
 * Base Utilities - Re-export from scripts/lib
 *
 * This file provides backward compatibility for scripts that import from
 * './utils/base.ts' or '../utils/base.ts'. New scripts should import
 * directly from '@revealui/scripts-lib' or '../../lib/index.ts'.
 *
 * @deprecated Import from '@revealui/scripts-lib' instead
 */

export {
  commandExists,
  confirm,
  createLogger,
  execCommand,
  fileExists,
  getProjectRoot,
  handleASTParseError,
  prompt,
  requireEnv,
  validateDependencies,
  waitFor,
  type Logger,
  type ScriptResult,
} from '../../lib/index.js'
