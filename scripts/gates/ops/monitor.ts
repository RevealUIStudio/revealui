#!/usr/bin/env tsx

/**
 * Development Monitoring Status Command
 *
 * Displays current system health and process monitoring status.
 * Useful for checking the state of the development environment.
 *
 * Usage:
 *   pnpm monitor
 *   pnpm monitor --watch
 *
 * @dependencies
 * - scripts/utils/base.js - Base utilities (createLogger)
 * - @revealui/core/monitoring - Monitoring utilities (getAllProcesses, getHealthMetrics, getProcessStats, getZombieHistory)
 * - @revealui/db/client - Database client (getPoolMetrics)
 */

import {
  getAllProcesses,
  getHealthMetrics,
  getProcessStats,
  getZombieHistory,
} from '@revealui/core/monitoring';
import { getPoolMetrics } from '@revealui/db/client';
import { createLogger } from '../../utils/base.js';

const logger = createLogger();

interface MonitorOptions {
  watch?: boolean;
  interval?: number;
}

function parseArgs(): MonitorOptions {
  const args = process.argv.slice(2);
  const options: MonitorOptions = {
    watch: args.includes('--watch') || args.includes('-w'),
    interval: 5000, // 5 seconds default
  };

  const intervalIndex = args.findIndex((arg) => arg === '--interval' || arg === '-i');
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    options.interval = parseInt(args[intervalIndex + 1], 10) * 1000;
  }

  return options;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '0m';
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function displayStatus(): void {
  try {
    // Get pool metrics
    const poolMetrics = getPoolMetrics();
    const restPools = poolMetrics.filter((p) => p.name.startsWith('pool-'));
    const vectorPools = poolMetrics.filter((p) => p.name.startsWith('vector-'));

    // Get health metrics
    const metrics = getHealthMetrics({
      rest: restPools,
      vector: vectorPools,
    });

    const stats = getProcessStats();
    const zombies = getZombieHistory();
    const processes = getAllProcesses();
    const recentProcesses = processes.slice(0, 10);

    // Clear console in watch mode
    if (parseArgs().watch) {
      console.clear();
    }

    // Display header
    logger.header('System Health Monitor');
    console.log();

    // System Metrics
    logger.info('═══ SYSTEM ═══');
    console.log(`  Memory:   ${metrics.system.memoryUsage}MB`);
    console.log(`  CPU:      ${metrics.system.cpuUsage.toFixed(1)}%`);
    console.log(`  Uptime:   ${formatUptime(metrics.system.uptime)}`);
    console.log(`  Platform: ${metrics.system.platform}`);
    console.log(`  Node:     ${metrics.system.nodeVersion}`);
    console.log();

    // Process Stats
    logger.info('═══ PROCESSES ═══');
    console.log(`  Total:      ${stats.total}`);
    console.log(`  Running:    ${stats.running}`);
    console.log(`  Completed:  ${stats.completed}`);
    console.log(`  Failed:     ${stats.failed}`);
    console.log(`  Zombies:    ${stats.zombies}`);
    console.log(`  Spawn Rate: ${metrics.processes.spawnRate}/min`);
    console.log();

    // By Source
    logger.info('═══ BY SOURCE ═══');
    for (const [source, count] of Object.entries(stats.bySource)) {
      if (count > 0) {
        console.log(`  ${source.padEnd(15)}: ${count}`);
      }
    }
    console.log();

    // Database Pools
    if (poolMetrics.length > 0) {
      logger.info('═══ DATABASE POOLS ═══');
      for (const pool of poolMetrics) {
        const active = pool.totalCount - pool.idleCount;
        console.log(
          `  ${pool.name}: ${active}/${pool.totalCount} active, ${pool.waitingCount} waiting`,
        );
      }
      console.log();
    }

    // Alerts
    if (metrics.alerts.length > 0) {
      logger.warn('═══ ACTIVE ALERTS ═══');
      for (const alert of metrics.alerts) {
        const icon = alert.level === 'critical' ? '🔴' : '⚠️';
        console.log(`  ${icon} ${alert.message}`);
      }
      console.log();
    }

    // Recent Zombies
    if (zombies.length > 0) {
      logger.warn('═══ RECENT ZOMBIES ═══');
      for (const zombie of zombies.slice(0, 5)) {
        console.log(
          `  PID ${zombie.pid} (${zombie.command}) - detected at ${formatTimestamp(zombie.detectedAt)}`,
        );
      }
      console.log();
    }

    // Recent Processes
    if (recentProcesses.length > 0) {
      logger.info('═══ RECENT PROCESSES ═══');
      for (const process of recentProcesses) {
        const status =
          process.status === 'running' ? '🟢' : process.status === 'completed' ? '🔵' : '🔴';
        console.log(
          `  ${status} PID ${process.pid} - ${process.command} [${process.source}] (${process.status})`,
        );
      }
      console.log();
    }

    // Footer
    console.log(`Last updated: ${formatTimestamp(Date.now())}`);
    console.log();

    if (parseArgs().watch) {
      logger.info('Watching... (Ctrl+C to exit)');
    }
  } catch (error) {
    logger.error('Failed to fetch monitoring status');
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const options = parseArgs();

  if (options.watch) {
    // Watch mode - display status at interval
    displayStatus();
    setInterval(() => {
      displayStatus();
    }, options.interval);
  } else {
    // One-time display
    displayStatus();
  }
}

main();
