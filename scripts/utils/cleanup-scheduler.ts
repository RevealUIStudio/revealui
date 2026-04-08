/**
 * Cleanup Scheduling System for Cohesion Engine
 *
 * Manages scheduled cleanup tasks and automated maintenance.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions
 * - scripts/utils/fixes.ts - Fix strategies and archival policies
 * - scripts/utils/base.ts - Base utilities
 * - node:fs/promises - File system operations
 * - node:path - Path manipulation
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CohesionIssue } from '../types.ts';
import { createLogger, fileExists } from './base.ts';
import { ARCHIVAL_POLICIES, applyFix, detectOrphanedImports } from './fixes.ts';

// =============================================================================
// Types
// =============================================================================

export interface CleanupTask {
  id: string;
  name: string;
  description: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'on-demand';
  lastRun?: string; // ISO timestamp
  nextRun?: string; // ISO timestamp
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface CleanupResult {
  taskId: string;
  timestamp: string;
  success: boolean;
  itemsProcessed: number;
  itemsCleaned: number;
  errors: string[];
  warnings: string[];
  details: Record<string, unknown>;
}

export interface CleanupSchedule {
  tasks: CleanupTask[];
  lastUpdate: string;
}

// =============================================================================
// Default Cleanup Tasks
// =============================================================================

export const DEFAULT_CLEANUP_TASKS: CleanupTask[] = [
  {
    id: 'cleanup-orphaned-imports',
    name: 'Cleanup Orphaned Imports',
    description: 'Remove imports from non-existent or deprecated packages',
    schedule: 'weekly',
    enabled: true,
    config: { dryRun: true },
  },
  {
    id: 'archive-old-todos',
    name: 'Archive Old TODO Comments',
    description: 'Archive TODO comments older than 90 days',
    schedule: 'monthly',
    enabled: false, // Disabled by default - requires manual review
  },
  {
    id: 'cleanup-type-assertions',
    name: 'Fix Type Assertions',
    description: 'Replace "as any" with "as unknown" for better type safety',
    schedule: 'on-demand',
    enabled: true,
    config: { dryRun: false, maxFixes: 50 },
  },
  {
    id: 'cleanup-console-logs',
    name: 'Report Console Logs',
    description: 'Generate report of console.log usage (manual cleanup required)',
    schedule: 'weekly',
    enabled: true,
    config: { reportOnly: true },
  },
];

// =============================================================================
// Schedule Management
// =============================================================================

const logger = createLogger();

/**
 * Load cleanup schedule from file
 */
export async function loadCleanupSchedule(projectRoot: string): Promise<CleanupSchedule> {
  const schedulePath = join(projectRoot, '.cursor/cleanup-schedule.json');

  if (await fileExists(schedulePath)) {
    try {
      const content = await readFile(schedulePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warning(`Failed to load cleanup schedule: ${error}`);
    }
  }

  // Return default schedule
  return {
    tasks: DEFAULT_CLEANUP_TASKS,
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Save cleanup schedule to file
 */
export async function saveCleanupSchedule(
  projectRoot: string,
  schedule: CleanupSchedule,
): Promise<void> {
  const schedulePath = join(projectRoot, '.cursor/cleanup-schedule.json');

  schedule.lastUpdate = new Date().toISOString();

  await writeFile(schedulePath, JSON.stringify(schedule, null, 2), 'utf-8');
}

/**
 * Calculate next run time based on schedule
 */
export function calculateNextRun(schedule: CleanupTask['schedule'], lastRun?: string): string {
  const now = new Date();
  const last = lastRun ? new Date(lastRun) : now;

  switch (schedule) {
    case 'daily':
      return new Date(last.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'weekly':
      return new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'monthly':
      return new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'on-demand':
      return 'manual';
    default:
      return now.toISOString();
  }
}

/**
 * Check if a task should run now
 */
export function shouldTaskRun(task: CleanupTask): boolean {
  if (!task.enabled) return false;
  if (task.schedule === 'on-demand') return false;
  if (!task.nextRun) return true;

  const now = new Date();
  const nextRun = new Date(task.nextRun);

  return now >= nextRun;
}

// =============================================================================
// Task Execution
// =============================================================================

/**
 * Execute a cleanup task
 */
export async function executeCleanupTask(
  task: CleanupTask,
  projectRoot: string,
): Promise<CleanupResult> {
  const result: CleanupResult = {
    taskId: task.id,
    timestamp: new Date().toISOString(),
    success: false,
    itemsProcessed: 0,
    itemsCleaned: 0,
    errors: [],
    warnings: [],
    details: {},
  };

  try {
    switch (task.id) {
      case 'cleanup-orphaned-imports':
        await executeOrphanedImportsCleanup(task, projectRoot, result);
        break;
      case 'archive-old-todos':
        await executeArchiveTodosCleanup(task, projectRoot, result);
        break;
      case 'cleanup-type-assertions':
        await executeTypeAssertionsCleanup(task, projectRoot, result);
        break;
      case 'cleanup-console-logs':
        await executeConsoleLogsReport(task, projectRoot, result);
        break;
      default:
        result.errors.push(`Unknown task: ${task.id}`);
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Execute orphaned imports cleanup
 */
async function executeOrphanedImportsCleanup(
  _task: CleanupTask,
  projectRoot: string,
  result: CleanupResult,
): Promise<void> {
  const { findSourceFiles } = await import('./patterns.ts');

  // Find source files
  const targetDirs = [
    join(projectRoot, 'apps/admin/src'),
    join(projectRoot, 'apps/mainframe/src'),
    join(projectRoot, 'packages/core/src'),
  ];

  const allFiles: string[] = [];
  for (const dir of targetDirs) {
    try {
      const files = await findSourceFiles(dir);
      allFiles.push(...files);
    } catch {
      // Skip directories that don't exist
    }
  }

  // Detect orphaned imports
  const { orphanedImports, totalChecked } = await detectOrphanedImports(allFiles);

  result.itemsProcessed = totalChecked;
  result.itemsCleaned = orphanedImports.length;
  result.details = {
    orphanedImports: orphanedImports.slice(0, 10), // Limit to 10 for reporting
    totalOrphaned: orphanedImports.length,
  };

  if (orphanedImports.length > 0) {
    result.warnings.push(`Found ${orphanedImports.length} orphaned imports`);
    result.warnings.push('Manual review required - imports may still be valid');
  }
}

/**
 * Execute archive TODOs cleanup
 */
async function executeArchiveTodosCleanup(
  _task: CleanupTask,
  projectRoot: string,
  result: CleanupResult,
): Promise<void> {
  const policy = ARCHIVAL_POLICIES.find((p) => p.name === 'archive-old-todos');
  if (!policy) {
    result.errors.push('Archive policy not found');
    return;
  }

  const { findSourceFiles } = await import('./patterns.ts');

  const targetDirs = [join(projectRoot, 'apps/admin/src'), join(projectRoot, 'packages/core/src')];

  const allFiles: string[] = [];
  for (const dir of targetDirs) {
    try {
      const files = await findSourceFiles(dir);
      allFiles.push(...files);
    } catch {
      // Skip
    }
  }

  let todosFound = 0;
  let todosArchived = 0;

  for (const file of allFiles) {
    try {
      const stats = await stat(file);
      const content = await readFile(file, 'utf-8');

      if (content.match(/\/\/\s*TODO:|\/\*\s*TODO:/gi)) {
        todosFound++;

        if (policy.shouldArchive(file, stats.mtime)) {
          // In dry-run mode, just count
          todosArchived++;
        }
      }
    } catch {
      // Skip
    }
  }

  result.itemsProcessed = allFiles.length;
  result.itemsCleaned = todosArchived;
  result.details = {
    todosFound,
    todosArchived,
    archivalNeeded: todosArchived > 0,
  };

  if (todosArchived > 0) {
    result.warnings.push(
      `Found ${todosArchived} TODO comments that should be archived (older than 90 days)`,
    );
  }
}

/**
 * Execute type assertions cleanup
 */
async function executeTypeAssertionsCleanup(
  task: CleanupTask,
  projectRoot: string,
  result: CleanupResult,
): Promise<void> {
  const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json');

  if (!(await fileExists(analysisPath))) {
    result.errors.push('Analysis file not found. Run "pnpm cohesion:analyze" first.');
    return;
  }

  const content = await readFile(analysisPath, 'utf-8');
  const analysis = JSON.parse(content);

  // Find type assertion issues
  const typeAssertionIssues = analysis.issues.filter(
    (issue: CohesionIssue) => issue.pattern === 'type-assertion-any',
  );

  if (typeAssertionIssues.length === 0) {
    result.details = { message: 'No type assertion issues found' };
    return;
  }

  result.itemsProcessed = typeAssertionIssues.length;

  const maxFixes = (task.config?.maxFixes as number) || 50;
  const dryRun = (task.config?.dryRun as boolean) ?? true;

  for (const issue of typeAssertionIssues.slice(0, maxFixes)) {
    const fixResult = await applyFix(issue, dryRun);

    if (fixResult.success) {
      result.itemsCleaned += fixResult.changes.length;
    } else {
      result.errors.push(...(fixResult.errors || []));
    }
  }

  result.details = {
    totalIssues: typeAssertionIssues.length,
    fixesApplied: result.itemsCleaned,
    dryRun,
  };
}

/**
 * Execute console logs report
 */
async function executeConsoleLogsReport(
  _task: CleanupTask,
  projectRoot: string,
  result: CleanupResult,
): Promise<void> {
  const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json');

  if (!(await fileExists(analysisPath))) {
    result.errors.push('Analysis file not found. Run "pnpm cohesion:analyze" first.');
    return;
  }

  const content = await readFile(analysisPath, 'utf-8');
  const analysis = JSON.parse(content);

  const consoleLogIssues = analysis.issues.filter(
    (issue: CohesionIssue) => issue.pattern === 'console-log',
  );

  result.itemsProcessed = consoleLogIssues.length;
  result.details = {
    totalConsoleStatements: consoleLogIssues.reduce(
      (sum: number, issue: CohesionIssue) => sum + (issue.count || 0),
      0,
    ),
    filesAffected: consoleLogIssues.length,
    reportOnly: true,
  };

  result.warnings.push(
    `Found ${result.details.totalConsoleStatements} console.log statements in ${result.details.filesAffected} files`,
  );
  result.warnings.push('Manual cleanup required - replace with logger calls');
}

// =============================================================================
// Scheduler
// =============================================================================

/**
 * Run all scheduled cleanup tasks
 */
export async function runScheduledCleanup(projectRoot: string): Promise<CleanupResult[]> {
  const schedule = await loadCleanupSchedule(projectRoot);
  const results: CleanupResult[] = [];

  logger.header('Running Scheduled Cleanup Tasks');

  for (const task of schedule.tasks) {
    if (shouldTaskRun(task)) {
      logger.info(`Running task: ${task.name}`);

      const result = await executeCleanupTask(task, projectRoot);
      results.push(result);

      // Update task schedule
      task.lastRun = result.timestamp;
      task.nextRun = calculateNextRun(task.schedule, result.timestamp);

      if (result.success) {
        logger.success(
          `✓ ${task.name}: Cleaned ${result.itemsCleaned}/${result.itemsProcessed} items`,
        );
      } else {
        logger.error(`✗ ${task.name}: ${result.errors.join(', ')}`);
      }
    }
  }

  // Save updated schedule
  await saveCleanupSchedule(projectRoot, schedule);

  return results;
}
