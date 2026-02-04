#!/usr/bin/env tsx
/**
 * RevealUI Master CLI
 *
 * Unified entry point for all RevealUI CLI tools.
 * Routes commands to appropriate sub-CLIs with lazy loading.
 *
 * NEW Domain-focused CLIs (v2):
 *   ops         Operations & maintenance (consolidates: maintain, migrate, db, setup, rollback)
 *   check       Quality & validation (consolidates: analyze, validate, health, metrics)
 *   state       State & workflow (consolidates: workflow, registry, profile)
 *   assets      Asset generation (consolidates: types, schema-new, build-cache, docs)
 *   info        Information & discovery (consolidates: explore, deps, version, analytics)
 *
 * Legacy CLIs (DEPRECATED - will be removed in future release):
 *   db, setup, validate, workflow, skills, maintain, analyze, release,
 *   build-cache, metrics, explore, profile, dashboard, etc.
 *
 * Usage:
 *   # New domain CLIs (recommended)
 *   pnpm revealui ops fix-imports --dry-run
 *   pnpm revealui check analyze --json
 *   pnpm revealui state workflow:start build
 *   pnpm revealui assets types:generate
 *   pnpm revealui info deps:graph
 *
 *   # Legacy CLIs (deprecated but still work)
 *   pnpm revealui maintain fix-imports  # shows deprecation warning
 *   pnpm revealui analyze quality       # shows deprecation warning
 *
 * Global Options:
 *   --json      Output in JSON format
 *   --help      Show help message
 *   --version   Show version
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// New domain-focused CLIs (v2)
const DOMAIN_CLIS: CLIDefinition[] = [
  {
    name: 'ops',
    description: 'Operations & maintenance (fix, migrate, db, setup, rollback)',
    script: './ops.ts',
  },
  {
    name: 'check',
    description: 'Quality & validation (analyze, validate, health, metrics)',
    script: './check.ts',
  },
  {
    name: 'state',
    description: 'State & workflow (workflow, registry, profile)',
    script: './state.ts',
  },
  {
    name: 'assets',
    description: 'Asset generation (types, schema, docs, build)',
    script: './assets.ts',
  },
  {
    name: 'info',
    description: 'Information & discovery (explore, deps, version, analytics)',
    script: './info.ts',
  },
]

// Legacy CLIs (deprecated - forward to new domain CLIs)
const LEGACY_CLIS: CLIDefinition[] = [
  {
    name: 'maintain',
    description: '[DEPRECATED] Use: ops (Codebase maintenance)',
    script: './maintain.ts',
  },
  {
    name: 'migrate',
    description: '[DEPRECATED] Use: ops migrate:* (Migrations)',
    script: './migrate.ts',
  },
  {
    name: 'db',
    description: '[DEPRECATED] Use: ops db:* (Database operations)',
    script: './db.ts',
  },
  {
    name: 'setup',
    description: '[DEPRECATED] Use: ops setup:* (Environment setup)',
    script: './setup.ts',
  },
  {
    name: 'rollback',
    description: '[DEPRECATED] Use: ops rollback (Rollback operations)',
    script: './rollback.ts',
  },
  {
    name: 'analyze',
    description: '[DEPRECATED] Use: check analyze (Code analysis)',
    script: './analyze.ts',
  },
  {
    name: 'validate',
    description: '[DEPRECATED] Use: check validate (Validation)',
    script: './validate.ts',
  },
  {
    name: 'health',
    description: '[DEPRECATED] Use: check health (Health checks)',
    script: './health.ts',
  },
  {
    name: 'metrics',
    description: '[DEPRECATED] Use: check metrics (Metrics)',
    script: './metrics.ts',
  },
  {
    name: 'workflow',
    description: '[DEPRECATED] Use: state workflow:* (Workflows)',
    script: './workflow.ts',
  },
  {
    name: 'registry',
    description: '[DEPRECATED] Use: state registry:* (Registry)',
    script: './registry.ts',
  },
  {
    name: 'profile',
    description: '[DEPRECATED] Use: state profile (Profiling)',
    script: './profile.ts',
  },
  {
    name: 'types',
    description: '[DEPRECATED] Use: assets types:* (Type generation)',
    script: './types.ts',
  },
  {
    name: 'schema-new',
    description: '[DEPRECATED] Use: assets schema:* (Schema management)',
    script: './schema-new.ts',
  },
  {
    name: 'build-cache',
    description: '[DEPRECATED] Use: assets build:* (Build cache)',
    script: './build-cache.ts',
  },
  {
    name: 'explore',
    description: '[DEPRECATED] Use: info explore (Code exploration)',
    script: './explore.ts',
  },
  {
    name: 'deps',
    description: '[DEPRECATED] Use: info deps:* (Dependencies)',
    script: './deps.ts',
  },
  {
    name: 'version',
    description: '[DEPRECATED] Use: info version (Versioning)',
    script: './version.ts',
  },
  {
    name: 'analytics',
    description: '[DEPRECATED] Use: info analytics (Analytics)',
    script: './analytics.ts',
  },
]

// Other CLIs (not consolidated)
const OTHER_CLIS: CLIDefinition[] = [
  {
    name: 'skills',
    description: 'Skill management for agents',
    script: './skills.ts',
  },
  {
    name: 'release',
    description: 'Version management and publishing',
    script: './release.ts',
  },
  {
    name: 'dashboard',
    description: 'Performance monitoring and metrics dashboard',
    script: './dashboard.ts',
  },
  {
    name: 'scripts',
    description: 'Script management utilities',
    script: './scripts.ts',
  },
]

// All available CLIs (domain first, then others, then legacy)
const AVAILABLE_CLIS: CLIDefinition[] = [...DOMAIN_CLIS, ...OTHER_CLIS, ...LEGACY_CLIS]

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
  console.log('Domain CLIs (v2 - RECOMMENDED):')
  console.log()

  const maxNameLength = Math.max(...AVAILABLE_CLIS.map((cli) => cli.name.length))

  for (const cli of DOMAIN_CLIS) {
    const padding = ' '.repeat(maxNameLength - cli.name.length + 2)
    console.log(`  ${cli.name}${padding}${cli.description}`)
  }

  console.log()
  console.log('Other CLIs:')
  console.log()

  for (const cli of OTHER_CLIS) {
    const padding = ' '.repeat(maxNameLength - cli.name.length + 2)
    console.log(`  ${cli.name}${padding}${cli.description}`)
  }

  console.log()
  console.log('Legacy CLIs (deprecated, use --help for migration guide):')
  console.log()

  for (const cli of LEGACY_CLIS) {
    const padding = ' '.repeat(maxNameLength - cli.name.length + 2)
    console.log(`  ${cli.name}${padding}${cli.description}`)
  }

  console.log()
  console.log('Global Options:')
  console.log('  --json       Output in JSON format')
  console.log('  --help       Show this help message')
  console.log('  --version    Show version')
  console.log()
  console.log('Examples (new domain CLIs):')
  console.log('  revealui ops fix-imports --dry-run')
  console.log('  revealui check analyze --json')
  console.log('  revealui state workflow:start build')
  console.log('  revealui assets types:generate')
  console.log('  revealui info deps:graph')
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
