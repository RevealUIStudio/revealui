#!/usr/bin/env tsx

/**
 * Cohesion Engine - Cleanup Command
 *
 * Runs scheduled cleanup tasks and manages automated maintenance.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum
 * - scripts/utils/base.ts - Base utilities
 * - scripts/utils/cleanup-scheduler.ts - Cleanup scheduling
 * - scripts/utils/audit-logger.ts - Audit logging
 */

import { ErrorCode } from '../../lib/errors.js'
import { generateAuditReport, getAuditSummary } from '../../utils/audit-logger.ts'
import { createLogger, getProjectRoot } from '../../utils/base.ts'
import {
  executeCleanupTask,
  loadCleanupSchedule,
  runScheduledCleanup,
  saveCleanupSchedule,
} from '../../utils/cleanup-scheduler.ts'

const logger = createLogger()

/**
 * Main function
 */
async function main() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    const args = process.argv.slice(2)

    // Parse command
    const command = args[0] || 'run'

    switch (command) {
      case 'run':
        await runScheduledTasks(projectRoot)
        break

      case 'list':
        await listTasks(projectRoot)
        break

      case 'run-task':
        await runSpecificTask(projectRoot, args[1])
        break

      case 'enable':
        await enableTask(projectRoot, args[1])
        break

      case 'disable':
        await disableTask(projectRoot, args[1])
        break

      case 'audit':
        await showAuditReport(projectRoot)
        break

      case 'audit-summary':
        await showAuditSummary(projectRoot)
        break

      default:
        logger.error(`Unknown command: ${command}`)
        logger.info(
          'Available commands: run, list, run-task <id>, enable <id>, disable <id>, audit, audit-summary',
        )
        process.exit(ErrorCode.CONFIG_ERROR)
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Run scheduled cleanup tasks
 */
async function runScheduledTasks(projectRoot: string) {
  logger.header('Scheduled Cleanup Tasks')

  const results = await runScheduledCleanup(projectRoot)

  logger.header('Cleanup Summary')
  logger.info(`Tasks run: ${results.length}`)
  logger.info(`Successful: ${results.filter((r) => r.success).length}`)
  logger.info(`Failed: ${results.filter((r) => !r.success).length}`)
  logger.info(`Total items cleaned: ${results.reduce((sum, r) => sum + r.itemsCleaned, 0)}`)

  // Show audit summary
  const summary = await getAuditSummary(projectRoot)
  logger.info(
    `\nAudit: ${summary.totalChanges} total changes across ${summary.totalOperations} operations`,
  )
}

/**
 * List all cleanup tasks
 */
async function listTasks(projectRoot: string) {
  logger.header('Cleanup Tasks')

  const schedule = await loadCleanupSchedule(projectRoot)

  for (const task of schedule.tasks) {
    const status = task.enabled ? '✓ Enabled' : '✗ Disabled'
    logger.info(`\n${task.id}`)
    logger.info(`  Name: ${task.name}`)
    logger.info(`  Status: ${status}`)
    logger.info(`  Schedule: ${task.schedule}`)
    logger.info(`  Description: ${task.description}`)

    if (task.lastRun) {
      logger.info(`  Last Run: ${new Date(task.lastRun).toLocaleString()}`)
    }

    if (task.nextRun && task.nextRun !== 'manual') {
      logger.info(`  Next Run: ${new Date(task.nextRun).toLocaleString()}`)
    }
  }
}

/**
 * Run a specific cleanup task
 */
async function runSpecificTask(projectRoot: string, taskId: string) {
  if (!taskId) {
    logger.error('Task ID required')
    logger.info('Usage: pnpm cohesion:cleanup run-task <task-id>')
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  logger.header(`Running Cleanup Task: ${taskId}`)

  const schedule = await loadCleanupSchedule(projectRoot)
  const task = schedule.tasks.find((t) => t.id === taskId)

  if (!task) {
    logger.error(`Task not found: ${taskId}`)
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  const result = await executeCleanupTask(task, projectRoot)

  if (result.success) {
    logger.success(`Task completed successfully`)
    logger.info(`Items processed: ${result.itemsProcessed}`)
    logger.info(`Items cleaned: ${result.itemsCleaned}`)
  } else {
    logger.error(`Task failed`)
    for (const error of result.errors) {
      logger.error(`  - ${error}`)
    }
  }

  if (result.warnings.length > 0) {
    logger.warning('Warnings:')
    for (const warning of result.warnings) {
      logger.warning(`  - ${warning}`)
    }
  }
}

/**
 * Enable a cleanup task
 */
async function enableTask(projectRoot: string, taskId: string) {
  if (!taskId) {
    logger.error('Task ID required')
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  const schedule = await loadCleanupSchedule(projectRoot)
  const task = schedule.tasks.find((t) => t.id === taskId)

  if (!task) {
    logger.error(`Task not found: ${taskId}`)
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  task.enabled = true
  await saveCleanupSchedule(projectRoot, schedule)

  logger.success(`Task enabled: ${task.name}`)
}

/**
 * Disable a cleanup task
 */
async function disableTask(projectRoot: string, taskId: string) {
  if (!taskId) {
    logger.error('Task ID required')
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  const schedule = await loadCleanupSchedule(projectRoot)
  const task = schedule.tasks.find((t) => t.id === taskId)

  if (!task) {
    logger.error(`Task not found: ${taskId}`)
    process.exit(ErrorCode.CONFIG_ERROR)
  }

  task.enabled = false
  await saveCleanupSchedule(projectRoot, schedule)

  logger.success(`Task disabled: ${task.name}`)
}

/**
 * Show audit report
 */
async function showAuditReport(projectRoot: string) {
  logger.header('Audit Report')

  const report = await generateAuditReport(projectRoot)
  console.log(report)
}

/**
 * Show audit summary
 */
async function showAuditSummary(projectRoot: string) {
  logger.header('Audit Summary')

  const summary = await getAuditSummary(projectRoot)

  logger.info(`Total Operations: ${summary.totalOperations}`)
  logger.info(`Successful: ${summary.successfulOperations}`)
  logger.info(`Failed: ${summary.failedOperations}`)
  logger.info(`Total Changes: ${summary.totalChanges}`)

  if (summary.lastOperation) {
    logger.info(`Last Operation: ${new Date(summary.lastOperation).toLocaleString()}`)
  }
}

main()
