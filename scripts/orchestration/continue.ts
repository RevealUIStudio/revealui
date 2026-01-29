#!/usr/bin/env tsx
/**
 * Continue Ralph-inspired iterative workflow
 */

import { createLogger, getProjectRoot } from '../../lib/index.js'
import {
import { ErrorCode } from '../lib/errors.js'
  checkCompletion,
  cleanupWorkflow,
  isWorkflowActive,
  readStateFile,
  validateStateFile,
  writeStateFile,
} from '../utils/orchestration.ts'

const logger = createLogger()

/**
 * Run continue workflow
 */
async function runContinue() {
  const projectRoot = await getProjectRoot(import.meta.url)

  // Check if workflow is active
  if (!(await isWorkflowActive(projectRoot))) {
    logger.error('No active workflow')
    logger.info('Run "pnpm ralph:start" to begin a workflow')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  try {
    // Read state file
    const stateFile = await readStateFile(projectRoot)

    // Validate state file
    const validation = await validateStateFile(projectRoot)
    if (!validation.valid) {
      logger.error('State file validation failed:')
      for (const error of validation.errors) {
        logger.error(`  - ${error}`)
      }
      logger.info('Run "pnpm ralph:cancel" to reset the workflow')
      process.exit(ErrorCode.CONFIG_ERROR)
    }

    const state = stateFile.frontmatter

    // Check max iterations
    if (state.max_iterations > 0 && state.iteration >= state.max_iterations) {
      logger.warning(`Max iterations (${state.max_iterations}) reached`)
      logger.info('Cleaning up workflow...')
      await cleanupWorkflow(projectRoot)
      logger.success('Workflow completed (max iterations reached)')
      process.exit(0)
    }

    // Check completion marker
    if (state.completion_promise) {
      const isComplete = await checkCompletion(projectRoot, state.completion_promise)
      if (isComplete) {
        logger.success('Completion marker detected!')
        logger.info('Cleaning up workflow...')
        await cleanupWorkflow(projectRoot)
        logger.success('Workflow completed successfully!')
        process.exit(0)
      }
    }

    // Increment iteration
    const nextIteration = state.iteration + 1
    const updatedState = {
      ...state,
      iteration: nextIteration,
    }

    // Write updated state
    await writeStateFile(projectRoot, updatedState, stateFile.prompt)

    logger.header(`Ralph Iteration ${nextIteration}`)
    logger.info(
      `Progress: ${nextIteration}${state.max_iterations > 0 ? ` / ${state.max_iterations}` : ''} iterations`,
    )

    // Show prompt for next iteration
    logger.info('')
    logger.info('Continue working on:')
    logger.info('')
    logger.info(stateFile.prompt)
    logger.info('')

    if (state.completion_promise) {
      logger.info(
        `When complete, create marker: echo "${state.completion_promise}" > .cursor/ralph-complete.marker`,
      )
      logger.info('Then run: pnpm ralph:continue')
    } else {
      logger.info('Continue when ready: pnpm ralph:continue')
      logger.info('Or cancel: pnpm ralph:cancel')
    }
  } catch (error) {
    logger.error(
      `Failed to continue workflow: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runContinue()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
