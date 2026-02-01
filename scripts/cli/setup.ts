#!/usr/bin/env tsx
/**
 * Setup CLI
 *
 * Unified entry point for setup operations with dual-mode output support.
 *
 * Usage:
 *   pnpm setup:env     # Set up environment variables
 *   pnpm setup:node    # Set up Node.js version
 *   pnpm setup:mcp     # Set up MCP servers
 *
 * Add --json flag to any command for machine-readable output.
 */

import { BaseCLI, runCLI, type CommandDefinition } from './_base.js'
import { type ScriptOutput, ok, fail } from '../lib/output.js'
import { notFound, executionError } from '../lib/errors.js'
import type { ParsedArgs } from '../lib/args.js'

// =============================================================================
// Types
// =============================================================================

interface SetupResult {
  command: string
  delegatedTo: string
  success: boolean
}

interface SetupListResult {
  commands: Array<{ name: string; description: string; script: string }>
}

// =============================================================================
// Command Configuration
// =============================================================================

const SETUP_COMMANDS = {
  env: {
    script: '../setup/environment.ts',
    description: 'Set up environment variables',
  },
  node: {
    script: '../setup/setup-node-version.ts',
    description: 'Set up Node.js version',
  },
  mcp: {
    script: '../setup/setup-mcp.ts',
    description: 'Set up MCP servers',
  },
} as const

type SetupCommandName = keyof typeof SETUP_COMMANDS

// =============================================================================
// Setup CLI
// =============================================================================

class SetupCLI extends BaseCLI {
  name = 'setup'
  description = 'Unified entry point for setup operations'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'env',
        description: SETUP_COMMANDS.env.description,
        args: [],
        handler: (args) => this.runSetup('env', args),
      },
      {
        name: 'node',
        description: SETUP_COMMANDS.node.description,
        args: [],
        handler: (args) => this.runSetup('node', args),
      },
      {
        name: 'mcp',
        description: SETUP_COMMANDS.mcp.description,
        args: [],
        handler: (args) => this.runSetup('mcp', args),
      },
      {
        name: 'list',
        description: 'List all available setup commands',
        args: [],
        handler: () => this.listCommands(),
      },
    ]
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private async runSetup(
    command: SetupCommandName,
    _args: ParsedArgs,
  ): Promise<ScriptOutput<SetupResult>> {
    const config = SETUP_COMMANDS[command]
    const scriptPath = config.script

    this.output.progress(`Running setup: ${command}`)
    this.verbose(`Delegating to: ${scriptPath}`)

    try {
      // Pass through remaining args to the delegated script
      const remainingArgs = this.args.positional
      process.argv = [process.argv[0], process.argv[1], ...remainingArgs]

      // Import and run the setup script
      await import(scriptPath)

      return ok({
        command,
        delegatedTo: scriptPath,
        success: true,
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
        throw notFound('Setup script', scriptPath)
      }
      throw executionError(
        `setup ${command}`,
        1,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async listCommands(): Promise<ScriptOutput<SetupListResult>> {
    const commands = Object.entries(SETUP_COMMANDS).map(([name, config]) => ({
      name,
      description: config.description,
      script: config.script,
    }))

    // Human-mode output
    if (!this.output.isJsonMode()) {
      this.output.header('Available Setup Commands')
      for (const cmd of commands) {
        console.log(`  ${cmd.name.padEnd(10)} ${cmd.description}`)
      }
      console.log()
      this.output.progress('Run: pnpm setup:<command> [options]')
    }

    return ok({ commands }, { count: commands.length })
  }
}

// =============================================================================
// Entry Point
// =============================================================================

runCLI(SetupCLI)
