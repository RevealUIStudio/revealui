#!/usr/bin/env tsx
/**
 * Type Generation Performance Monitor
 *
 * Tracks and reports performance metrics for type generation:
 * - Generation time for each step
 * - File sizes
 * - Table/schema counts
 * - Historical trends
 *
 * @dependencies
 * - node:child_process - Process execution (execSync)
 * - node:fs - File system operations (existsSync, readFileSync, statSync, writeFileSync)
 * - node:path - Path manipulation utilities
 *
 * Usage: pnpm types:perf
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = join(import.meta.dirname, '../..');
const metricsFile = join(rootDir, '.type-generation-metrics.json');

interface GenerationMetrics {
  timestamp: string;
  duration: {
    total: number;
    drizzleTypes: number;
    zodSchemas: number;
    contracts: number;
    validation: number;
  };
  files: {
    databaseTypes: { path: string; size: number; lines: number };
    zodSchemas: { path: string; size: number; lines: number };
    contracts: { path: string; size: number; lines: number };
  };
  counts: {
    tables: number;
    schemas: number;
    contracts: number;
  };
  git: {
    branch: string;
    commit: string;
  };
}

interface MetricsHistory {
  runs: GenerationMetrics[];
  summary: {
    averageTotalTime: number;
    fastestRun: number;
    slowestRun: number;
    lastRun: string;
  };
}

/**
 * Measure execution time of a command
 */
function measureTime(fn: () => void): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  return Math.round(end - start);
}

/**
 * Get file metrics
 */
function getFileMetrics(filePath: string): { path: string; size: number; lines: number } {
  const fullPath = join(rootDir, filePath);
  try {
    const stats = statSync(fullPath);
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').length;
    return { path: filePath, size: stats.size, lines };
  } catch {
    return { path: filePath, size: 0, lines: 0 };
  }
}

/**
 * Count tables from generated schemas
 */
function countTables(): number {
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts');
  if (!existsSync(zodSchemasPath)) return 0;

  const content = readFileSync(zodSchemasPath, 'utf-8');
  const matches = content.match(/export const \w+SelectSchema/g) || [];
  return matches.length;
}

/**
 * Get git information
 */
function getGitInfo(): { branch: string; commit: string } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
    }).trim();
    const commit = execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
    }).trim();
    return { branch, commit };
  } catch {
    return { branch: 'unknown', commit: 'unknown' };
  }
}

/**
 * Run performance measurement
 */
async function measurePerformance(): Promise<GenerationMetrics> {
  console.log('⏱️  Measuring type generation performance...\n');

  const git = getGitInfo();

  // Measure each step
  console.log('📦 Step 1/4: Drizzle types...');
  const drizzleTime = measureTime(() => {
    execSync('pnpm --filter @revealui/db generate:types', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  });
  console.log(`   ✓ Completed in ${drizzleTime}ms`);

  console.log('🔍 Step 2/4: Zod schemas...');
  const zodTime = measureTime(() => {
    execSync('pnpm --filter @revealui/db generate:zod', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  });
  console.log(`   ✓ Completed in ${zodTime}ms`);

  console.log('📋 Step 3/4: Contracts...');
  const contractsTime = measureTime(() => {
    execSync('pnpm --filter @revealui/db generate:contracts', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  });
  console.log(`   ✓ Completed in ${contractsTime}ms`);

  console.log('✅ Step 4/4: Validation...');
  const validationTime = measureTime(() => {
    execSync('pnpm validate:types', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  });
  console.log(`   ✓ Completed in ${validationTime}ms`);

  const totalTime = drizzleTime + zodTime + contractsTime + validationTime;

  // Collect file metrics
  const files = {
    databaseTypes: getFileMetrics('packages/db/src/types/database.ts'),
    zodSchemas: getFileMetrics('packages/contracts/src/generated/zod-schemas.ts'),
    contracts: getFileMetrics('packages/contracts/src/generated/contracts.ts'),
  };

  // Count items
  const tables = countTables();

  const metrics: GenerationMetrics = {
    timestamp: new Date().toISOString(),
    duration: {
      total: totalTime,
      drizzleTypes: drizzleTime,
      zodSchemas: zodTime,
      contracts: contractsTime,
      validation: validationTime,
    },
    files,
    counts: {
      tables,
      schemas: tables * 2, // Select + Insert
      contracts: tables * 2, // Row + Insert
    },
    git,
  };

  return metrics;
}

/**
 * Load metrics history
 */
function loadHistory(): MetricsHistory {
  if (!existsSync(metricsFile)) {
    return {
      runs: [],
      summary: {
        averageTotalTime: 0,
        fastestRun: 0,
        slowestRun: 0,
        lastRun: '',
      },
    };
  }

  const content = readFileSync(metricsFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save metrics to history
 */
function saveMetrics(metrics: GenerationMetrics): void {
  const history = loadHistory();
  history.runs.push(metrics);

  // Keep last 50 runs
  if (history.runs.length > 50) {
    history.runs = history.runs.slice(-50);
  }

  // Update summary
  const times = history.runs.map((r) => r.duration.total);
  history.summary = {
    averageTotalTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    fastestRun: Math.min(...times),
    slowestRun: Math.max(...times),
    lastRun: metrics.timestamp,
  };

  writeFileSync(metricsFile, JSON.stringify(history, null, 2));
}

/**
 * Display metrics report
 */
function displayReport(metrics: GenerationMetrics, history: MetricsHistory): void {
  console.log('\n📊 Performance Report\n');
  console.log('='.repeat(60));

  // Timing breakdown
  console.log('\n⏱️  Timing Breakdown:');
  console.log(`  Total:       ${metrics.duration.total}ms`);
  console.log(`  Drizzle:     ${metrics.duration.drizzleTypes}ms`);
  console.log(`  Zod:         ${metrics.duration.zodSchemas}ms`);
  console.log(`  Contracts:   ${metrics.duration.contracts}ms`);
  console.log(`  Validation:  ${metrics.duration.validation}ms`);

  // File sizes
  console.log('\n📁 Generated Files:');
  console.log(
    `  database.ts:     ${formatBytes(metrics.files.databaseTypes.size)} (${metrics.files.databaseTypes.lines} lines)`,
  );
  console.log(
    `  zod-schemas.ts:  ${formatBytes(metrics.files.zodSchemas.size)} (${metrics.files.zodSchemas.lines} lines)`,
  );
  console.log(
    `  contracts.ts:    ${formatBytes(metrics.files.contracts.size)} (${metrics.files.contracts.lines} lines)`,
  );

  // Counts
  console.log('\n🔢 Coverage:');
  console.log(`  Tables:      ${metrics.counts.tables}`);
  console.log(`  Schemas:     ${metrics.counts.schemas}`);
  console.log(`  Contracts:   ${metrics.counts.contracts}`);

  // Historical comparison
  if (history.runs.length > 1) {
    console.log('\n📈 Historical Trends:');
    console.log(`  Average time:  ${history.summary.averageTotalTime}ms`);
    console.log(`  Fastest run:   ${history.summary.fastestRun}ms`);
    console.log(`  Slowest run:   ${history.summary.slowestRun}ms`);
    console.log(`  Total runs:    ${history.runs.length}`);

    const diff = metrics.duration.total - history.summary.averageTotalTime;
    const diffPercent = Math.round((diff / history.summary.averageTotalTime) * 100);
    const trend = diff > 0 ? '↑' : '↓';
    const color = diff > 0 ? '🔴' : '🟢';
    console.log(`  This run:      ${color} ${trend} ${Math.abs(diffPercent)}% vs average`);
  }

  // Git info
  console.log('\n🔖 Git Info:');
  console.log(`  Branch:      ${metrics.git.branch}`);
  console.log(`  Commit:      ${metrics.git.commit}`);

  console.log(`\n${'='.repeat(60)}`);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Display trend chart
 */
function displayTrends(history: MetricsHistory): void {
  if (history.runs.length < 2) {
    console.log('ℹ️  Not enough data for trends (need at least 2 runs)');
    return;
  }

  console.log('\n📊 Recent Performance Trend\n');

  const recentRuns = history.runs.slice(-10);
  const maxTime = Math.max(...recentRuns.map((r) => r.duration.total));

  for (const run of recentRuns) {
    const date = new Date(run.timestamp).toLocaleString();
    const barLength = Math.round((run.duration.total / maxTime) * 40);
    const bar = '█'.repeat(barLength);
    console.log(`${date}  ${bar} ${run.duration.total}ms`);
  }

  console.log('');
}

// Main execution
const command = process.argv[2] || 'run';

if (command === 'run' || command === 'measure') {
  const metrics = await measurePerformance();
  saveMetrics(metrics);
  const history = loadHistory();
  displayReport(metrics, history);
} else if (command === 'trends') {
  const history = loadHistory();
  displayTrends(history);
} else if (command === 'history') {
  const history = loadHistory();
  console.log(JSON.stringify(history, null, 2));
} else if (command === 'clear') {
  writeFileSync(metricsFile, JSON.stringify({ runs: [], summary: {} }, null, 2));
  console.log('✅ Metrics history cleared');
} else {
  console.log('Type Generation Performance Monitor\n');
  console.log('Usage:');
  console.log('  pnpm types:perf          - Run performance measurement');
  console.log('  pnpm types:perf trends   - Show recent trends');
  console.log('  pnpm types:perf history  - Show full history (JSON)');
  console.log('  pnpm types:perf clear    - Clear metrics history');
}
