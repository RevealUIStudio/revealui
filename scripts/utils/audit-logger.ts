/**
 * Audit Logging System for Cohesion Engine
 *
 * Tracks all automated fixes and cleanup operations for accountability.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions
 * - scripts/utils/base.ts - Base utilities
 * - node:fs/promises - File system operations
 * - node:path - Path manipulation
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CodeChange, FixResult } from '../types.ts'
import { fileExists } from './base.ts'
import type { CleanupResult } from './cleanup-scheduler.ts'

// =============================================================================
// Types
// =============================================================================

export interface AuditLogEntry {
  timestamp: string
  operation: 'analyze' | 'fix' | 'cleanup' | 'archive'
  actor: 'automated' | 'manual'
  details: {
    issueId?: string
    issuePattern?: string
    filesAffected: number
    changesApplied: number
    success: boolean
    errors?: string[]
    warnings?: string[]
  }
  changes?: CodeChange[]
  metadata?: Record<string, unknown>
}

export interface AuditLog {
  entries: AuditLogEntry[]
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    totalChanges: number
    lastOperation?: string
  }
}

// =============================================================================
// Audit Log Management
// =============================================================================

/**
 * Get audit log file path
 */
function getAuditLogPath(projectRoot: string): string {
  return join(projectRoot, '.cursor/audit-log.jsonl')
}

/**
 * Get audit summary path
 */
function getAuditSummaryPath(projectRoot: string): string {
  return join(projectRoot, '.cursor/audit-summary.json')
}

/**
 * Write audit log entry
 */
export async function writeAuditEntry(projectRoot: string, entry: AuditLogEntry): Promise<void> {
  const logPath = getAuditLogPath(projectRoot)

  // Ensure directory exists
  await mkdir(dirname(logPath), { recursive: true })

  // Append entry as JSON line
  const line = `${JSON.stringify(entry)}\n`
  await appendFile(logPath, line, 'utf-8')

  // Update summary
  await updateAuditSummary(projectRoot, entry)
}

/**
 * Log a fix operation
 */
export async function logFixOperation(
  projectRoot: string,
  issueId: string,
  issuePattern: string,
  result: FixResult,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    operation: 'fix',
    actor: 'automated',
    details: {
      issueId,
      issuePattern,
      filesAffected: result.file ? 1 : 0,
      changesApplied: result.changes.length,
      success: result.success,
      errors: result.errors,
      warnings: result.warnings,
    },
    changes: result.changes,
    metadata,
  }

  await writeAuditEntry(projectRoot, entry)
}

/**
 * Log a cleanup operation
 */
export async function logCleanupOperation(
  projectRoot: string,
  result: CleanupResult,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: result.timestamp,
    operation: 'cleanup',
    actor: 'automated',
    details: {
      filesAffected: result.itemsProcessed,
      changesApplied: result.itemsCleaned,
      success: result.success,
      errors: result.errors,
      warnings: result.warnings,
    },
    metadata: { ...result.details, ...metadata, taskId: result.taskId },
  }

  await writeAuditEntry(projectRoot, entry)
}

/**
 * Log an analysis operation
 */
export async function logAnalysisOperation(
  projectRoot: string,
  issuesFound: number,
  filesScanned: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    operation: 'analyze',
    actor: 'manual',
    details: {
      filesAffected: filesScanned,
      changesApplied: 0,
      success: true,
    },
    metadata: { issuesFound, ...metadata },
  }

  await writeAuditEntry(projectRoot, entry)
}

// =============================================================================
// Summary Management
// =============================================================================

/**
 * Update audit summary
 */
async function updateAuditSummary(projectRoot: string, entry: AuditLogEntry): Promise<void> {
  const summaryPath = getAuditSummaryPath(projectRoot)

  let summary: AuditLog['summary'] = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalChanges: 0,
  }

  // Load existing summary if it exists
  if (await fileExists(summaryPath)) {
    try {
      const content = await readFile(summaryPath, 'utf-8')
      summary = JSON.parse(content)
    } catch {
      // Use default if file is corrupted
    }
  }

  // Update summary
  summary.totalOperations++
  if (entry.details.success) {
    summary.successfulOperations++
  } else {
    summary.failedOperations++
  }
  summary.totalChanges += entry.details.changesApplied
  summary.lastOperation = entry.timestamp

  // Write summary
  await mkdir(dirname(summaryPath), { recursive: true })
  await appendFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')
}

/**
 * Get audit log summary
 */
export async function getAuditSummary(projectRoot: string): Promise<AuditLog['summary']> {
  const summaryPath = getAuditSummaryPath(projectRoot)

  if (await fileExists(summaryPath)) {
    try {
      const content = await readFile(summaryPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      // Return default if file is corrupted
    }
  }

  return {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalChanges: 0,
  }
}

/**
 * Read audit log entries
 */
export async function readAuditLog(projectRoot: string, limit = 100): Promise<AuditLogEntry[]> {
  const logPath = getAuditLogPath(projectRoot)

  if (!(await fileExists(logPath))) {
    return []
  }

  try {
    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')

    // Parse JSONL format
    const entries: AuditLogEntry[] = []
    for (const line of lines.slice(-limit)) {
      try {
        entries.push(JSON.parse(line))
      } catch {
        // Skip invalid lines
      }
    }

    return entries
  } catch {
    return []
  }
}

/**
 * Generate audit report
 */
export async function generateAuditReport(projectRoot: string): Promise<string> {
  const summary = await getAuditSummary(projectRoot)
  const recentEntries = await readAuditLog(projectRoot, 20)

  const report: string[] = []

  report.push('# Cohesion Engine Audit Report\n')
  report.push(`Generated: ${new Date().toISOString()}\n`)
  report.push('## Summary\n')
  report.push(`- Total Operations: ${summary.totalOperations}`)
  report.push(`- Successful: ${summary.successfulOperations}`)
  report.push(`- Failed: ${summary.failedOperations}`)
  report.push(`- Total Changes Applied: ${summary.totalChanges}`)
  report.push(
    `- Last Operation: ${summary.lastOperation ? new Date(summary.lastOperation).toLocaleString() : 'Never'}\n`,
  )

  report.push('## Recent Operations\n')

  if (recentEntries.length === 0) {
    report.push('No operations recorded yet.\n')
  } else {
    for (const entry of recentEntries.reverse()) {
      report.push(
        `### ${entry.operation.toUpperCase()} - ${new Date(entry.timestamp).toLocaleString()}`,
      )
      report.push(`- Actor: ${entry.actor}`)
      report.push(`- Success: ${entry.details.success ? '✓' : '✗'}`)
      report.push(`- Files Affected: ${entry.details.filesAffected}`)
      report.push(`- Changes Applied: ${entry.details.changesApplied}`)

      if (entry.details.errors && entry.details.errors.length > 0) {
        report.push(`- Errors: ${entry.details.errors.join(', ')}`)
      }

      if (entry.details.warnings && entry.details.warnings.length > 0) {
        report.push(`- Warnings: ${entry.details.warnings.join(', ')}`)
      }

      report.push('')
    }
  }

  return report.join('\n')
}
