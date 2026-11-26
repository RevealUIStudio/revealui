/**
 * Backup Verification Script
 *
 * Validates that the most recent database backup is structurally sound:
 * - File exists and is readable
 * - Required core tables are present
 * - Row counts are non-zero for expected tables
 * - JSON/SQL format is parseable
 * - Backup age is within acceptable window (default 25h)
 *
 * Usage:
 *   pnpm scripts commands database verify-backup
 *   pnpm scripts commands database verify-backup --max-age=48 --dir=.revealui/backups
 *
 * Exit codes:
 *   0 = backup verified
 *   1 = verification failed (missing, corrupt, stale, or incomplete)
 */

import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectBackup, listBackups } from '@revealui/scripts/database/backup-manager.js';
import { getProjectRoot } from '@revealui/scripts/index.js';

const REQUIRED_TABLES = ['users', 'sites', 'pages', 'sessions', 'audit_log'] as const;
const EXPECTED_NON_EMPTY = ['users', 'sites'] as const;
const DEFAULT_MAX_AGE_HOURS = 25;

interface VerifyResult {
  ok: boolean;
  file: string | null;
  errors: string[];
  warnings: string[];
  tables: number;
  totalRows: number;
  ageHours: number | null;
}

async function findLatestBackup(backupDir: string): Promise<string | null> {
  const backups = await listBackups(import.meta.url, { backupDir });
  return backups[0] ? join(backupDir, backups[0]) : null;
}

async function verifyArtifact(
  content: string,
  format: 'json' | 'sql',
  result: VerifyResult,
): Promise<void> {
  let summary: Awaited<ReturnType<typeof inspectBackup>>;
  try {
    summary = await inspectBackup(content, format);
  } catch {
    result.errors.push('Backup syntax or data shape is invalid');
    return;
  }
  const { tables, rowCounts } = summary;
  result.tables = tables.length;

  if (tables.length === 0) {
    result.errors.push('Backup contains zero tables');
    return;
  }

  // Check required tables
  for (const table of REQUIRED_TABLES) {
    if (!tables.includes(table)) {
      // Preserve the verifier's existing format policy: JSON requires these
      // tables; SQL reports their absence as warnings.
      (format === 'json' ? result.errors : result.warnings).push(
        `Required table missing: ${table}`,
      );
    }
  }

  // Check expected non-empty tables
  result.totalRows = Object.values(rowCounts).reduce((total, count) => total + count, 0);

  for (const table of EXPECTED_NON_EMPTY) {
    if (tables.includes(table) && rowCounts[table] === 0) {
      result.warnings.push(`Expected non-empty table has 0 rows: ${table}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const maxAgeArg = args.find((a) => a.startsWith('--max-age='));
  const dirArg = args.find((a) => a.startsWith('--dir='));

  const maxAgeHours = maxAgeArg ? Number(maxAgeArg.split('=')[1]) : DEFAULT_MAX_AGE_HOURS;
  const projectRoot = await getProjectRoot(import.meta.url);
  const backupDir = dirArg
    ? join(projectRoot, dirArg.slice('--dir='.length))
    : join(projectRoot, '.revealui', 'backups');

  const result: VerifyResult = {
    ok: true,
    file: null,
    errors: [],
    warnings: [],
    tables: 0,
    totalRows: 0,
    ageHours: null,
  };

  // Find latest backup
  const latestPath = await findLatestBackup(backupDir);
  if (!latestPath) {
    result.ok = false;
    result.errors.push(`No backup files found in ${backupDir}`);
    printResult(result);
    process.exit(1);
  }

  result.file = latestPath;

  // Stat + read atomically via one file handle — closes the stat-then-read
  // TOCTOU gap CodeQL flags on separate fs/promises calls (js/file-system-race).
  try {
    const handle = await open(latestPath);
    try {
      const fileStat = await handle.stat();
      const ageMs = Date.now() - fileStat.mtime.getTime();
      result.ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
      if (result.ageHours > maxAgeHours) {
        result.errors.push(`Backup is ${result.ageHours}h old (max: ${maxAgeHours}h) — stale`);
      }

      const content = await handle.readFile('utf8');
      if (content.length === 0) {
        result.errors.push('Backup file is empty');
      } else if (latestPath.endsWith('.json')) {
        await verifyArtifact(content, 'json', result);
      } else if (latestPath.endsWith('.sql')) {
        await verifyArtifact(content, 'sql', result);
      } else {
        result.errors.push(`Unknown backup format: ${latestPath}`);
      }
    } finally {
      await handle.close();
    }
  } catch {
    result.errors.push('Cannot read backup file');
  }

  result.ok = result.errors.length === 0;
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

function printResult(result: VerifyResult): void {
  console.log('\n============================================================');
  console.log('Backup Verification');
  console.log('============================================================');

  if (result.file) {
    console.log(`  File:    ${result.file}`);
  }
  if (result.ageHours !== null) {
    console.log(`  Age:     ${result.ageHours}h`);
  }
  if (result.tables > 0) {
    console.log(`  Tables:  ${result.tables}`);
    console.log(`  Rows:    ${result.totalRows}`);
  }

  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    for (const e of result.errors) {
      console.log(`    \u2717 ${e}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const w of result.warnings) {
      console.log(`    \u26A0 ${w}`);
    }
  }

  console.log(`\n  Result:  ${result.ok ? '\u2713 PASS' : '\u2717 FAIL'}`);
  console.log('============================================================\n');
}

main();
