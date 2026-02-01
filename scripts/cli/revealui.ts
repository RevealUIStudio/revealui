#!/usr/bin/env tsx
/**
 * RevealUI Master CLI
 *
 * Unified entry point for all RevealUI CLI tools.
 * Routes commands to appropriate sub-CLIs with lazy loading.
 *
 * Available CLIs:
 *   db          Database management operations
 *   setup       Environment and project setup
 *   validate    Code validation and checks
 *   workflow    Workflow automation and orchestration
 *   skills      Skill management for agents
 *   maintain    Codebase maintenance and fixes
 *   analyze     Code analysis and metrics
 *   release     Version management and publishing
 *   build-cache Build cache management
 *   metrics     Script execution metrics and analytics
 *   explore     Interactive script explorer and runner
 *   profile     Performance profiling and benchmarking
 *
 * Usage:
 *   pnpm revealui <cli> <command> [options]
 *   pnpm revealui db init
 *   pnpm revealui analyze quality --json
 *   pnpm revealui maintain fix-imports --dry-run
 *   pnpm revealui release preview
 *
 * Global Options:
 *   --json      Output in JSON format
 *   --help      Show help message
 *   --version   Show version
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// =============================================================================
// CLI Registry
// =============================================================================

interface CLIDefinition {
  name: string
  description: string
  script: string
}

const AVAILABLE_CLIS: CLIDefinition[] = [
  {
    name: 'db',
    description: 'Database management operations',
    script: './db.ts',
  },
  {
    name: 'setup',
    description: 'Environment and project setup',
    script: './setup.ts',
  },
  {
    name: 'validate',
    description: 'Code validation and checks',
    script: './validate.ts',
  },
  {
    name: 'workflow',
    description: 'Workflow automation and orchestration',
    script: './workflow.ts',
  },
  {
    name: 'skills',
    description: 'Skill management for agents',
    script: './skills.ts',
  },
  {
    name: 'maintain',
    description: 'Codebase maintenance and fixes',
    script: './maintain.ts',
  },
  {
    name: 'analyze',
    description: 'Code analysis and metrics',
    script: './analyze.ts',
  },
  {
    name: 'release',
    description: 'Version management and publishing',
    script: './release.ts',
  },
  {
    name: 'build-cache',
    description: 'Build cache management',
    script: './build-cache.ts',
  },
  {
    name: 'metrics',
    description: 'Script execution metrics and analytics',
    script: './metrics.ts',
  },
  {
    name: 'explore',
    description: 'Interactive script explorer and runner',
    script: './explore.ts',
  },
  {
    name: 'profile',
    description: 'Performance profiling and benchmarking',
    script: './profile.ts',
  },
]

// =============================================================================
// Helper Functions
// =============================================================================

function showHelp() {
  console.log('revealui')
  console.log()
  console.log('Unified CLI for RevealUI development and operations')
  console.log()
  console.log('Usage:')
  console.log('  revealui <cli> <command> [options]')
  console.log()
  console.log('Available CLIs:')
  console.log()

  const maxNameLength = Math.max(...AVAILABLE_CLIS.map((cli) => cli.name.length))

  for (const cli of AVAILABLE_CLIS) {
    const padding = ' '.repeat(maxNameLength - cli.name.length + 2)
    console.log(`  ${cli.name}${padding}${cli.description}`)
  }

  console.log()
  console.log('Global Options:')
  console.log('  --json       Output in JSON format')
  console.log('  --help       Show this help message')
  console.log('  --version    Show version')
  console.log()
  console.log('Examples:')
  console.log('  revealui db init')
  console.log('  revealui analyze quality --json')
  console.log('  revealui maintain fix-imports --dry-run')
  console.log('  revealui release preview')
  console.log()
  console.log('For help on a specific CLI, use:')
  console.log('  revealui <cli> --help')
  console.log()
}

function showVersion() {
  // TODO: Read from package.json
  console.log('revealui v0.1.0')
}

// =============================================================================
// CLI Routing
// =============================================================================

async function routeToCLI(cliName: string, args: string[]): Promise<number> {
  const cli = AVAILABLE_CLIS.find((c) => c.name === cliName)

  if (!cli) {
    console.error(`Error: Unknown CLI "${cliName}"`)
    console.error()
    console.error('Available CLIs:')
    for (const c of AVAILABLE_CLIS) {
      console.error(`  - ${c.name}`)
    }
    console.error()
    console.error('Run "revealui --help" for more information')
    return 1
  }

  const scriptPath = join(__dirname, cli.script)

  // Execute the CLI script with tsx
  return new Promise((resolve) => {
    const child = spawn('tsx', [scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('exit', (code) => {
      resolve(code || 0)
    })

    child.on('error', (error) => {
      console.error(`Failed to execute ${cliName}:`, error.message)
      resolve(1)
    })
  })
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2)

  // Handle no args - show help
  if (args.length === 0) {
    showHelp()
    return 0
  }

  // Handle global version flag
  if (args[0] === '--version' || args[0] === '-v') {
    showVersion()
    return 0
  }

  // Handle global help flag (only if first arg)
  if (args[0] === '--help' || args[0] === '-h') {
    showHelp()
    return 0
  }

  // Route to specific CLI (even if --help is present, let the sub-CLI handle it)
  const cliName = args[0]
  const cliArgs = args.slice(1)

  const exitCode = await routeToCLI(cliName, cliArgs)
  return exitCode
}

// =============================================================================
// Execute
// =============================================================================

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((error) => {
    console.error('Fatal error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  })
