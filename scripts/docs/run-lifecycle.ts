#!/usr/bin/env tsx

/**
 * Documentation Lifecycle Runner
 *
 * Runs documentation lifecycle checks with proper error handling.
 * Supports weekly, monthly, and quarterly workflows.
 *
 * Usage:
 *   pnpm tsx scripts/docs/run-lifecycle.ts weekly [--verbose]
 *   pnpm tsx scripts/docs/run-lifecycle.ts monthly [--verbose]
 *   pnpm tsx scripts/docs/run-lifecycle.ts quarterly [--verbose]
 */

import { spawn } from 'node:child_process'
import { createLogger } from '../shared/utils.js'

const logger = createLogger()

interface CommandResult {
  command: string
  success: boolean
  exitCode: number
  error?: string
}

// Parse command line arguments
function parseArgs(args: string[]): { type: 'weekly' | 'monthly' | 'quarterly'; verbose: boolean } {
  const type = args[0] as 'weekly' | 'monthly' | 'quarterly'
  const verbose = args.includes('--verbose') || args.includes('-v')

  if (!['weekly', 'monthly', 'quarterly'].includes(type)) {
    throw new Error(`Invalid lifecycle type: ${type}. Must be weekly, monthly, or quarterly.`)
  }

  return { type, verbose }
}

// Run a command and return the result
async function runCommand(
  command: string,
  args: string[],
  verbose: boolean,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    if (verbose) {
      logger.info(`Running: ${command} ${args.join(' ')}`)
    }

    const child = spawn(command, args, {
      stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: true,
    })

    let stderr = ''

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('close', (code) => {
      const success = code === 0
      resolve({
        command: `${command} ${args.join(' ')}`,
        success,
        exitCode: code || 0,
        error: success ? undefined : stderr || `Exit code: ${code}`,
      })
    })

    child.on('error', (error) => {
      resolve({
        command: `${command} ${args.join(' ')}`,
        success: false,
        exitCode: 1,
        error: error.message,
      })
    })
  })
}

// Define lifecycle workflows
const WORKFLOWS = {
  weekly: [
    { command: 'pnpm', args: ['docs:check:stale'] },
    { command: 'pnpm', args: ['docs:manage:assessments'] },
    { command: 'pnpm', args: ['docs:check:references'] },
  ],
  monthly: [
    { command: 'pnpm', args: ['docs:check:duplicates'] },
    // Include weekly checks
    { command: 'pnpm', args: ['docs:check:stale'] },
    { command: 'pnpm', args: ['docs:manage:assessments'] },
    { command: 'pnpm', args: ['docs:check:references'] },
  ],
  quarterly: [
    { command: 'pnpm', args: ['docs:review:archive'] },
    // Include monthly checks
    { command: 'pnpm', args: ['docs:check:duplicates'] },
    { command: 'pnpm', args: ['docs:check:stale'] },
    { command: 'pnpm', args: ['docs:manage:assessments'] },
    { command: 'pnpm', args: ['docs:check:references'] },
  ],
} as const

async function runLifecycle(
  type: 'weekly' | 'monthly' | 'quarterly',
  verbose: boolean,
): Promise<boolean> {
  const workflow = WORKFLOWS[type]
  let allSuccessful = true

  logger.info(`🚀 Starting ${type} documentation lifecycle checks...`)

  for (const step of workflow) {
    const result = await runCommand(step.command, step.args, verbose)

    if (!result.success) {
      logger.error(`❌ Command failed: ${result.command}`)
      if (result.error) {
        logger.error(`   Error: ${result.error}`)
      }
      allSuccessful = false
      // Continue with other checks but track failure
    } else {
      logger.success(`✅ Completed: ${step.command} ${step.args.join(' ')}`)
    }
  }

  if (allSuccessful) {
    logger.success(`🎉 ${type} documentation lifecycle checks completed successfully!`)
    return true
  } else {
    logger.error(`⚠️  ${type} documentation lifecycle checks completed with failures.`)
    logger.error(`   Some checks failed - review the output above and fix issues.`)
    return false
  }
}

async function main() {
  try {
    const { type, verbose } = parseArgs(process.argv.slice(2))

    const success = await runLifecycle(type, verbose)

    if (!success) {
      logger.error(`\n💡 Tip: Run individual checks to see detailed output:`)
      logger.error(`   pnpm docs:check:stale --verbose`)
      logger.error(`   pnpm docs:manage:assessments --verbose`)
      logger.error(`   pnpm docs:check:references --verbose`)
      process.exit(1)
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Lifecycle runner failed: ${error.message}`)
    } else {
      logger.error('❌ Lifecycle runner failed: Unknown error')
    }
    logger.error(
      '\nUsage: pnpm tsx scripts/docs/run-lifecycle.ts <weekly|monthly|quarterly> [--verbose]',
    )
    process.exit(1)
  }
}

main()
