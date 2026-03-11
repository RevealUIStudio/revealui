#!/usr/bin/env tsx

/**
 * Unified development command for RevealUI monorepo
 *
 * Starts all packages in watch mode and all apps in dev mode.
 * Handles graceful shutdown and error propagation.
 *
 * Usage:
 *   pnpm dev
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/monitoring/process-tracker.ts - Process monitoring (displayMonitoringSummary, startDevMonitoring, startPeriodicStatusLogging, stopDevMonitoring, stopPeriodicStatusLogging)
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 * - concurrently - Concurrent command execution
 * - node:path - Path manipulation utilities (dirname, resolve)
 * - node:url - URL utilities (fileURLToPath)
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import concurrently from 'concurrently';
import { ErrorCode } from '../../lib/errors.js';
import {
  displayMonitoringSummary,
  startDevMonitoring,
  startPeriodicStatusLogging,
  stopDevMonitoring,
  stopPeriodicStatusLogging,
} from '../../lib/monitoring/process-tracker.js';
import { createLogger, getProjectRoot } from '../../utils/base.ts';

const logger = createLogger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function runDev() {
  let statusInterval: NodeJS.Timeout | null = null;

  try {
    await getProjectRoot(import.meta.url);

    // Start monitoring
    startDevMonitoring();

    // Start periodic status logging (every 5 minutes)
    statusInterval = startPeriodicStatusLogging(5 * 60 * 1000);

    const commands = [
      {
        name: 'packages',
        command: 'pnpm -r --filter "./packages/*" --parallel dev',
        prefixColor: 'blue',
        cwd: rootDir,
      },
      {
        name: 'apps',
        command: 'turbo run dev --parallel',
        prefixColor: 'green',
        cwd: rootDir,
      },
    ];

    logger.header('Starting RevealUI Development Environment');
    logger.info('Process monitoring enabled - /api/health-monitoring available');
    logger.info('Zombie detection running (30s interval)');

    await concurrently(commands, {
      killOthers: ['failure', 'success'],
      restartTries: 3,
      restartDelay: 1000,
      prefix: '[{name}]',
      timestampFormat: 'HH:mm:ss',
    });
  } catch (error) {
    logger.error('Development environment failed to start');
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  } finally {
    // Stop periodic logging
    if (statusInterval) {
      stopPeriodicStatusLogging(statusInterval);
    }

    // Display summary
    displayMonitoringSummary();

    // Stop monitoring
    stopDevMonitoring();
  }
}

/**
 * Main function
 */
async function main() {
  // Handle graceful shutdown
  let isShuttingDown = false;

  const handleShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down gracefully...`);
    // The cleanup will be handled by the cleanup manager
    // Just display the summary here
    displayMonitoringSummary();
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  try {
    await runDev();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    displayMonitoringSummary();
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
