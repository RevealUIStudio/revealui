/**
 * Unified CLI Command Dispatcher
 *
 * Consolidates the two different dispatch patterns used across CLIs:
 * 1. Import pattern: import(scriptPath) - Used by setup.ts
 * 2. Subprocess pattern: execCommand('pnpm tsx', scriptPath) - Used by analyze.ts, maintain.ts
 *
 * Provides a single, consistent API for dispatching to script files.
 */

import { type ParsedArgs } from '../args.js'
import { ErrorCode, notFound, ScriptError } from '../errors.js'
import { execCommand } from '../exec.js'

/**
 * Dispatch mode
 * - 'import': Loads and executes script in same process (faster, shares context)
 * - 'subprocess': Spawns new process with pnpm tsx (isolated, better for long-running tasks)
 * - 'auto': Chooses best mode based on script characteristics (default)
 */
export type DispatchMode = 'import' | 'subprocess' | 'auto'

/**
 * Options for command dispatch
 */
export interface DispatchOptions {
  /** Dispatch mode (default: 'auto') */
  mode?: DispatchMode
  /** Working directory for subprocess mode */
  cwd?: string
  /** Additional arguments to pass to the script */
  args?: ParsedArgs
  /** Environment variables for subprocess mode */
  env?: Record<string, string>
  /** Timeout for subprocess in milliseconds */
  timeout?: number
  /** Whether to capture output (subprocess mode only) */
  captureOutput?: boolean
}

/**
 * Result from dispatching a command
 */
export interface DispatchResult {
  /** Whether the command succeeded */
  success: boolean
  /** Output from the command (if captureOutput was true) */
  output?: string
  /** Error message if command failed */
  error?: string
  /** Exit code (subprocess mode only) */
  exitCode?: number
  /** Dispatch mode that was used */
  mode: DispatchMode
  /** Script path that was executed */
  scriptPath: string
}

/**
 * Determine if a script should run in subprocess mode
 * Heuristics:
 * - Scripts in 'workflows/' should run in subprocess (long-running)
 * - Scripts with 'build' or 'deploy' in name should run in subprocess (resource-intensive)
 * - Everything else can use import mode (faster)
 */
function shouldUseSubprocess(scriptPath: string): boolean {
  const path = scriptPath.toLowerCase()

  // Long-running or resource-intensive tasks
  if (path.includes('/workflows/')) return true
  if (path.includes('build')) return true
  if (path.includes('deploy')) return true
  if (path.includes('release')) return true

  // Short analysis/validation scripts can use import
  return false
}

/**
 * Dispatch a command using the import pattern
 * Loads and executes the script in the same process
 */
async function dispatchImport(
  scriptPath: string,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  try {
    // Import the script module
    await import(scriptPath)

    return {
      success: true,
      mode: 'import',
      scriptPath,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw notFound('Script', scriptPath)
    }

    return {
      success: false,
      mode: 'import',
      scriptPath,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Dispatch a command using the subprocess pattern
 * Spawns a new process with pnpm tsx
 */
async function dispatchSubprocess(
  scriptPath: string,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const {
    cwd,
    args = {},
    env = {},
    timeout,
    captureOutput = false,
  } = options

  // Build command arguments
  const cmdArgs = ['tsx', scriptPath]

  // Add parsed arguments to command
  if (args.command) cmdArgs.push(args.command as string)

  // Add flags
  Object.entries(args.flags || {}).forEach(([key, value]) => {
    if (typeof value === 'boolean' && value) {
      cmdArgs.push(`--${key}`)
    } else if (value !== undefined && value !== false) {
      cmdArgs.push(`--${key}`, String(value))
    }
  })

  // Add positional arguments
  if (args.positional && args.positional.length > 0) {
    cmdArgs.push(...args.positional.map(String))
  }

  try {
    const result = await execCommand('pnpm', cmdArgs, {
      cwd,
      env,
      timeout,
    })

    return {
      success: result.success,
      mode: 'subprocess',
      scriptPath,
      output: captureOutput ? result.stdout : undefined,
      error: result.success ? undefined : result.stderr,
      exitCode: result.code,
    }
  } catch (error) {
    return {
      success: false,
      mode: 'subprocess',
      scriptPath,
      error: error instanceof Error ? error.message : String(error),
      exitCode: ErrorCode.EXECUTION_ERROR,
    }
  }
}

/**
 * Dispatch a CLI command to its implementation script
 *
 * This is the main entry point for command dispatch. It automatically
 * chooses the best dispatch mode based on the script characteristics.
 *
 * @param scriptPath - Absolute or relative path to the script file
 * @param options - Dispatch options
 * @returns Result of the dispatch operation
 *
 * @example
 * ```typescript
 * // Auto mode (recommended)
 * const result = await dispatchCommand('scripts/analyze/console-usage.ts')
 *
 * // Force subprocess mode
 * const result = await dispatchCommand('scripts/build/production.ts', {
 *   mode: 'subprocess',
 *   args: { flags: { verbose: true } }
 * })
 *
 * // Force import mode (faster for quick scripts)
 * const result = await dispatchCommand('scripts/validate/types.ts', {
 *   mode: 'import'
 * })
 * ```
 */
export async function dispatchCommand(
  scriptPath: string,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const { mode = 'auto' } = options

  // Determine dispatch mode
  let actualMode: Exclude<DispatchMode, 'auto'>
  if (mode === 'auto') {
    actualMode = shouldUseSubprocess(scriptPath) ? 'subprocess' : 'import'
  } else {
    actualMode = mode
  }

  // Dispatch based on mode
  if (actualMode === 'import') {
    return dispatchImport(scriptPath, options)
  } else {
    return dispatchSubprocess(scriptPath, options)
  }
}

/**
 * Helper to dispatch and throw on failure
 * Useful when you want to fail fast on command errors
 */
export async function dispatchOrThrow(
  scriptPath: string,
  options: DispatchOptions = {},
): Promise<void> {
  const result = await dispatchCommand(scriptPath, options)

  if (!result.success) {
    throw new ScriptError(
      result.error || `Command failed: ${scriptPath}`,
      result.exitCode || ErrorCode.EXECUTION_ERROR,
      {
        context: {
          scriptPath: result.scriptPath,
          mode: result.mode,
        },
        suggestions: [
          'Check the script path is correct',
          'Verify the script has no syntax errors',
          'Review the error message above for details',
        ],
      },
    )
  }
}
