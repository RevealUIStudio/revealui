/**
 * Base CLI Class
 *
 * Abstract base class for building CLI tools with dual-mode output support.
 * Provides common functionality for argument parsing, output handling,
 * error handling, and interactive prompts.
 *
 * @example
 * ```typescript
 * class MyTool extends BaseCLI {
 *   name = 'my-tool'
 *   description = 'My awesome tool'
 *
 *   defineCommands() {
 *     return [
 *       { name: 'list', description: 'List items', handler: () => this.list() },
 *       { name: 'get', description: 'Get item', handler: () => this.get() },
 *     ]
 *   }
 *
 *   async list() {
 *     const items = await fetchItems()
 *     return this.output.success(items)
 *   }
 * }
 *
 * // Run the CLI
 * const cli = new MyTool()
 * await cli.run()
 * ```
 */

import * as readline from 'node:readline'
import {
  type ArgDefinition,
  type CommandDefinition as BaseCommandDefinition,
  generateHelp,
  type ParsedArgs,
  type ParserConfig,
  parseArgs,
  validateRequiredArgs,
} from '../lib/args.js'
import { ErrorCode, getExitCode, isScriptError, ScriptError, wrapError } from '../lib/errors.js'
import { createOutput, type OutputHandler, type ScriptOutput } from '../lib/output.js'

// =============================================================================
// Types
// =============================================================================

export interface CommandDefinition extends BaseCommandDefinition {
  /** Command handler function */
  handler: (args: ParsedArgs) => Promise<ScriptOutput | undefined>
  /** Whether this command requires user confirmation */
  confirmPrompt?: string
}

export interface CLIOptions {
  /** Override argv (default: process.argv.slice(2)) */
  argv?: string[]
  /** Exit process on completion (default: true) */
  exitOnComplete?: boolean
}

// =============================================================================
// Base CLI Class
// =============================================================================

/**
 * Abstract base class for CLI tools
 */
export abstract class BaseCLI {
  /** CLI name for help text */
  abstract name: string

  /** CLI description */
  abstract description: string

  /** Parsed command-line arguments */
  protected args: ParsedArgs

  /** Output handler for dual-mode output */
  protected output: OutputHandler

  /** Raw argv */
  protected argv: string[]

  /** Whether to exit process on completion */
  protected exitOnComplete: boolean

  constructor(options: CLIOptions = {}) {
    this.argv = options.argv ?? process.argv.slice(2)
    this.exitOnComplete = options.exitOnComplete ?? true

    // Pre-parse to detect JSON mode early
    const preParseJson = this.argv.includes('--json') || this.argv.includes('-j')
    this.output = createOutput({ json: preParseJson })

    // Will be properly parsed in run()
    this.args = {
      command: undefined,
      positional: [],
      flags: {},
      help: false,
      _raw: this.argv,
    }
  }

  /**
   * Define available commands for this CLI
   */
  abstract defineCommands(): CommandDefinition[]

  /**
   * Define global arguments (available to all commands)
   */
  defineGlobalArgs(): ArgDefinition[] {
    return [
      {
        name: 'json',
        short: 'j',
        type: 'boolean',
        description: 'Output in JSON format (for automation)',
      },
      {
        name: 'verbose',
        short: 'v',
        type: 'boolean',
        description: 'Enable verbose output',
      },
      {
        name: 'force',
        short: 'f',
        type: 'boolean',
        description: 'Skip confirmation prompts',
      },
    ]
  }

  /**
   * Hook called before running a command
   * Override to perform initialization (e.g., database connections)
   */
  async beforeRun(): Promise<void> {
    // Override in subclass
  }

  /**
   * Hook called after running a command
   * Override to perform cleanup (e.g., close connections)
   */
  async afterRun(): Promise<void> {
    // Override in subclass
  }

  /**
   * Run the CLI
   */
  async run(): Promise<void> {
    let exitCode = ErrorCode.SUCCESS

    try {
      // Build parser config
      const config = this.buildParserConfig()

      // Parse arguments
      this.args = parseArgs(this.argv, config)

      // Update output mode based on parsed args
      if (this.args.flags.json) {
        this.output = createOutput({ json: true })
      }

      // Handle help request
      if (this.args.help) {
        const helpText = generateHelp(config, this.args.command)
        if (this.args.flags.json) {
          this.output.success({ help: helpText })
        } else {
          console.log(helpText)
        }
        return
      }

      // Find and execute command
      const commands = this.defineCommands()
      const command = commands.find((c) => c.name === this.args.command)

      if (!command) {
        if (this.args.command) {
          throw new ScriptError(`Unknown command: ${this.args.command}`, ErrorCode.VALIDATION_ERROR)
        }
        // No command specified - show help
        console.log(generateHelp(config))
        return
      }

      // Validate required args
      const validation = validateRequiredArgs(this.args, config)
      if (!validation.valid) {
        throw new ScriptError(
          `Missing required arguments: ${validation.missing.join(', ')}`,
          ErrorCode.VALIDATION_ERROR,
          { missing: validation.missing },
        )
      }

      // Check for confirmation prompt
      if (command.confirmPrompt && !this.args.flags.force) {
        const confirmed = await this.confirm(command.confirmPrompt)
        if (!confirmed) {
          this.output.warn('Operation cancelled')
          exitCode = ErrorCode.CANCELLED
          return
        }
      }

      // Run lifecycle hooks and command
      await this.beforeRun()

      try {
        const result = await command.handler(this.args)

        // If handler returned a result, output it
        if (result) {
          this.output.result(result)
          if (!result.success) {
            exitCode = ErrorCode.GENERAL_ERROR
          }
        }
      } finally {
        await this.afterRun()
      }
    } catch (error) {
      exitCode = this.handleError(error)
    } finally {
      if (this.exitOnComplete && exitCode !== ErrorCode.SUCCESS) {
        process.exit(exitCode)
      }
    }
  }

  // ===========================================================================
  // Interactive Utilities
  // ===========================================================================

  /**
   * Ask for user confirmation
   * In JSON mode or with --force flag, returns true immediately
   */
  async confirm(message: string): Promise<boolean> {
    if (this.args.flags.force || this.args.flags.json) {
      return true
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      rl.question(`${message} (y/N) `, (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
      })
    })
  }

  /**
   * Prompt for user input
   * In JSON mode, throws an error (prompts not supported)
   */
  async prompt(message: string, defaultValue?: string): Promise<string> {
    if (this.args.flags.json) {
      throw new ScriptError(
        'Interactive prompts not supported in JSON mode',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const defaultText = defaultValue ? ` (${defaultValue})` : ''
      rl.question(`${message}${defaultText}: `, (answer) => {
        rl.close()
        resolve(answer || defaultValue || '')
      })
    })
  }

  /**
   * Prompt for a selection from options
   */
  async select<T extends string>(
    message: string,
    options: { label: string; value: T }[],
  ): Promise<T> {
    if (this.args.flags.json) {
      throw new ScriptError(
        'Interactive selection not supported in JSON mode',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    console.log(`\n${message}\n`)
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${i + 1}. ${options[i].label}`)
    }
    console.log()

    const answer = await this.prompt('Enter number')
    const index = parseInt(answer, 10) - 1

    if (Number.isNaN(index) || index < 0 || index >= options.length) {
      throw new ScriptError('Invalid selection', ErrorCode.VALIDATION_ERROR)
    }

    return options[index].value
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get a positional argument by index
   */
  protected getPositional(index: number): string | undefined {
    return this.args.positional[index]
  }

  /**
   * Get a required positional argument
   */
  protected requirePositional(index: number, name: string): string {
    const value = this.args.positional[index]
    if (!value) {
      throw new ScriptError(`Missing required argument: ${name}`, ErrorCode.VALIDATION_ERROR, {
        argument: name,
        index,
      })
    }
    return value
  }

  /**
   * Get a flag value with type safety
   */
  protected getFlag<T>(name: string, defaultValue: T): T {
    const value = this.args.flags[name]
    if (value === undefined) return defaultValue
    return value as T
  }

  /**
   * Check if verbose mode is enabled
   */
  protected isVerbose(): boolean {
    return Boolean(this.args.flags.verbose)
  }

  /**
   * Log a message (only in human mode and verbose)
   */
  protected verbose(message: string): void {
    if (this.isVerbose()) {
      this.output.debug(message)
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private buildParserConfig(): ParserConfig {
    const commands = this.defineCommands()
    const globalArgs = this.defineGlobalArgs()

    return {
      name: this.name,
      description: this.description,
      args: globalArgs,
      commands: commands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        args: cmd.args,
      })),
    }
  }

  private handleError(error: unknown): ErrorCode {
    const scriptError = isScriptError(error) ? error : wrapError(error)

    if (this.args.flags.json) {
      this.output.error({
        code: scriptError.codeString,
        message: scriptError.message,
        details: scriptError.details,
      })
    } else {
      this.output.getLogger().error(scriptError.message)
      if (scriptError.details && this.isVerbose()) {
        for (const [key, value] of Object.entries(scriptError.details)) {
          this.output.getLogger().error(`  ${key}: ${JSON.stringify(value)}`)
        }
      }
    }

    return getExitCode(scriptError)
  }
}

// =============================================================================
// Helper Function
// =============================================================================

/**
 * Create and run a CLI instance
 *
 * @example
 * ```typescript
 * class MyTool extends BaseCLI { ... }
 *
 * runCLI(MyTool).catch(console.error)
 * ```
 */
export async function runCLI<T extends BaseCLI>(
  CLIClass: new (options?: CLIOptions) => T,
  options?: CLIOptions,
): Promise<void> {
  const cli = new CLIClass(options)
  await cli.run()
}
