#!/usr/bin/env tsx
/**
 * Start a Ralph-inspired iterative workflow
 */

import {join} from 'node:path'
import {createLogger,getProjectRoot,writeFile} from '../../../packages/core/src/.scripts/utils.ts'
import type {RalphStartOptions} from '../types.ts'
import {generateBrutalHonestyPromptPrefix} from '../utils/brutal-honesty.ts'
import {getPromptFilePath,getStateFilePath,isWorkflowActive,writeStateFile} from '../utils/orchestration.ts'

const logger = createLogger()

/**
 * Parse command line arguments
 */
function parseArguments(): RalphStartOptions & { help: boolean } {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { prompt: '', help: true }
  }

  let prompt = ''
  let maxIterations = 0
  let completionPromise: string | undefined
  let brutalHonesty = true // Default to true

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--max-iterations' || arg === '-n') {
      const value = args[i + 1]
      if (!value) {
        logger.error('--max-iterations requires a number argument')
        process.exit(1)
      }
      const parsed = Number.parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0) {
        logger.error('--max-iterations must be a non-negative integer (0 = unlimited)')
        process.exit(1)
      }
      maxIterations = parsed
      i++
    } else if (arg === '--completion-promise' || arg === '-p') {
      const value = args[i + 1]
      if (!value) {
        logger.error('--completion-promise requires a text argument')
        process.exit(1)
      }
      completionPromise = value
      i++
    } else if (arg === '--no-brutal-honesty') {
      brutalHonesty = false
    } else if (!(arg.startsWith('--') || arg.startsWith('-'))) {
      // Positional argument (prompt)
      if (prompt) {
        prompt += ` ${arg}`
      } else {
        prompt = arg
      }
    }
  }

  return {
    prompt,
    maxIterations,
    completionPromise,
    brutalHonesty,
    help: false,
  }
}

/**
 * Show help message
 */
function showHelp(): void {
  logger.info(`
Ralph-Inspired Iterative Workflow

Start a manual iterative workflow for task completion.

USAGE:
  pnpm ralph:start "<prompt>" [OPTIONS]

ARGUMENTS:
  <prompt>    Task description or prompt to iterate on

OPTIONS:
  --max-iterations, -n <number>    Maximum iterations (default: 0 = unlimited)
  --completion-promise, -p <text>  Promise phrase to signal completion
  --help, -h                       Show this help message

EXAMPLES:
  pnpm ralph:start "Build REST API" --completion-promise "DONE" --max-iterations 20
  pnpm ralph:start "Fix authentication bug" --max-iterations 10
  pnpm ralph:start "Refactor cache layer"

COMPLETION:
  When task is complete, create marker file:
    echo "DONE" > .cursor/ralph-complete.marker

  Then run:
    pnpm ralph:continue

STATUS:
  Check current status:
    pnpm ralph:status

CANCEL:
  Cancel active workflow:
    pnpm ralph:cancel

NOTE:
  This is a MANUAL iterative workflow, not an autonomous loop.
  You must re-invoke commands to continue iterations.
`)
}

/**
 * Main function
 */
async function _main() {
  const projectRoot = await getProjectRoot(import.meta.url)
  const args = parseArguments()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  // Validate prompt
  if (!args.prompt?.trim()) {
    logger.error('Prompt is required')
    logger.info('\nUsage: pnpm ralph:start "<prompt>" [OPTIONS]')
    logger.info('Run: pnpm ralph:start --help for more information')
    process.exit(1)
  }

  // Check if workflow is already active
  if (await isWorkflowActive(projectRoot)) {
    logger.error('A workflow is already active')
    logger.info(`State file: ${getStateFilePath(projectRoot)}`)
    logger.info('Run "pnpm ralph:cancel" to cancel the existing workflow first')
    process.exit(1)
  }

  // Create .cursor directory if it doesn't exist
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(projectRoot, '.cursor'), { recursive: true })

  const _stateFilePath = getStateFilePath(projectRoot)
  const promptFilePath = getPromptFilePath(projectRoot)

  // Enhance prompt with brutal honesty if enabled
  let finalPrompt = args.prompt
  if (args.brutalHonesty) {
    const brutalPrefix = generateBrutalHonestyPromptPrefix()
    finalPrompt = `${brutalPrefix}\n\n${args.prompt}`
    logger.info('Brutal honesty mode enabled (default for cohesion workflows)')
  }

  // Create state
  const state = {
    active: true,
    iteration: 1,
    // biome-ignore lint/style/useNamingConvention: state file uses snake_case keys.
    max_iterations: args.maxIterations || 0,
    // biome-ignore lint/style/useNamingConvention: state file uses snake_case keys.
    completion_promise: args.completionPromise || null,
    // biome-ignore lint/style/useNamingConvention: state file uses snake_case keys.
    started_at: new Date().toISOString(),
    // biome-ignore lint/style/useNamingConvention: state file uses snake_case keys.
    prompt_file: '.cursor/ralph-prompt.md',
    // biome-ignore lint/style/useNamingConvention: state file uses snake_case keys.
    completion_marker: '.cursor/ralph-complete.marker',
  }

  // Write state file
  await writeStateFile(projectRoot, state, finalPrompt.trim())

  // Write prompt file
  await writeFile(promptFilePath, finalPrompt.trim())

  logger.header('Ralph Workflow Started')
  logger.success(
    `Iteration: ${state.iteration}${state.max_iterations > 0 ? ` / ${state.max_iterations}` : ''}`,
  )
  logger.info(`Prompt: ${args.prompt.trim()}`)
  if (args.brutalHonesty) {
    logger.info('Brutal honesty mode: ENABLED (automatic)')
  }
  if (state.completion_promise) {
    logger.info(`Completion promise: ${state.completion_promise}`)
  } else {
    logger.warning('No completion promise set (workflow runs until manually cancelled)')
  }
  logger.info('')
  logger.info('Next steps:')
  logger.info('  1. Work on the task in Cursor chat')
  logger.info('  2. Check status: pnpm ralph:status')
  logger.info('  3. Continue iteration: pnpm ralph:continue')
  if (state.completion_promise) {
    logger.info(
      `  4. When complete, create marker: echo "${state.completion_promise}" > .cursor/ralph-complete.marker`,
    )
    logger.info('  5. Run: pnpm ralph:continue (detects completion)')
  }
  logger.info('  6. Cancel anytime: pnpm ralph:cancel')
}

/**
 * Main function
 */
async function main() {
  try {
    await _main()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
