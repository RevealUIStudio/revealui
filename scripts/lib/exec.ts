/**
 * Command Execution Utilities for RevealUI Scripts
 *
 * Provides safe command execution with proper error handling,
 * timeout support, and cross-platform compatibility.
 */

import { spawn, type SpawnOptions } from 'node:child_process'
import { createLogger, type Logger } from './logger.js'

export interface ScriptResult {
  success: boolean
  message: string
  exitCode: number
  stdout?: string
  stderr?: string
}

export interface ExecOptions extends SpawnOptions {
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number
  /** Capture stdout/stderr instead of inheriting (default: false) */
  capture?: boolean
  /** Logger instance for output */
  logger?: Logger
  /** Working directory */
  cwd?: string
  /** Environment variables to merge with process.env */
  env?: Record<string, string>
}

/**
 * Executes a command with proper error handling and timeout support.
 *
 * @example
 * ```typescript
 * // Simple execution with inherited stdio
 * const result = await execCommand('pnpm', ['build'])
 *
 * // Capture output
 * const result = await execCommand('git', ['status'], { capture: true })
 * console.log(result.stdout)
 *
 * // With timeout
 * const result = await execCommand('pnpm', ['test'], { timeout: 300000 })
 * ```
 */
export async function execCommand(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<ScriptResult> {
  const {
    timeout = 120000,
    capture = false,
    logger: customLogger,
    cwd = process.cwd(),
    env,
    ...spawnOptions
  } = options

  const logger = customLogger || createLogger({ level: 'silent' })

  return new Promise((resolve) => {
    const mergedEnv = env ? { ...process.env, ...env } : process.env

    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: capture ? 'pipe' : 'inherit',
      shell: process.platform === 'win32',
      ...spawnOptions,
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    // Set up timeout
    const timeoutId = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
      logger.error(`Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`)
    }, timeout)

    // Capture output if requested
    if (capture && child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (capture && child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('error', (error) => {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        message: error.message,
        exitCode: 1,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      })
    })

    child.on('close', (code) => {
      clearTimeout(timeoutId)

      if (killed) {
        resolve({
          success: false,
          message: 'Command timed out',
          exitCode: code ?? 124,
          stdout: capture ? stdout : undefined,
          stderr: capture ? stderr : undefined,
        })
        return
      }

      resolve({
        success: code === 0,
        message: code === 0 ? 'Success' : `Exited with code ${code}`,
        exitCode: code ?? 1,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      })
    })
  })
}

/**
 * Executes multiple commands in sequence, stopping on first failure.
 *
 * @example
 * ```typescript
 * const results = await execSequence([
 *   ['pnpm', ['typecheck']],
 *   ['pnpm', ['lint']],
 *   ['pnpm', ['test']],
 * ])
 * ```
 */
export async function execSequence(
  commands: Array<[string, string[], ExecOptions?]>,
  options: ExecOptions = {},
): Promise<{ success: boolean; results: ScriptResult[] }> {
  const results: ScriptResult[] = []

  for (const [command, args, cmdOptions] of commands) {
    const result = await execCommand(command, args, { ...options, ...cmdOptions })
    results.push(result)

    if (!result.success) {
      return { success: false, results }
    }
  }

  return { success: true, results }
}

/**
 * Executes multiple commands in parallel.
 *
 * @example
 * ```typescript
 * const results = await execParallel([
 *   ['pnpm', ['--filter', 'cms', 'build']],
 *   ['pnpm', ['--filter', 'web', 'build']],
 * ])
 * ```
 */
export async function execParallel(
  commands: Array<[string, string[], ExecOptions?]>,
  options: ExecOptions = {},
): Promise<{ success: boolean; results: ScriptResult[] }> {
  const promises = commands.map(([command, args, cmdOptions]) =>
    execCommand(command, args, { ...options, ...cmdOptions }),
  )

  const results = await Promise.all(promises)
  const success = results.every((r) => r.success)

  return { success, results }
}

/**
 * Runs a pnpm script from package.json.
 *
 * @example
 * ```typescript
 * await runPnpmScript('build')
 * await runPnpmScript('test', { filter: 'cms' })
 * ```
 */
export async function runPnpmScript(
  script: string,
  options: ExecOptions & { filter?: string } = {},
): Promise<ScriptResult> {
  const { filter, ...execOptions } = options
  const args = filter ? ['--filter', filter, script] : [script]

  return execCommand('pnpm', args, execOptions)
}

/**
 * Checks if a command exists on the system.
 *
 * @example
 * ```typescript
 * if (await commandExists('docker')) {
 *   await execCommand('docker', ['build', '-t', 'myapp', '.'])
 * }
 * ```
 */
export async function commandExists(command: string): Promise<boolean> {
  const checkCmd = process.platform === 'win32' ? 'where' : 'which'

  try {
    const result = await execCommand(checkCmd, [command], { capture: true })
    return result.success
  } catch {
    return false
  }
}
