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

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

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

function findProjectRoot(): string {
  // Walk up from this script's directory to find the monorepo root
  let dir = import.meta.dirname;
  for (let i = 0; i < 10; i++) {
    if (dir.endsWith('/suite/revealui') || dir.endsWith('\\suite\\revealui')) return dir;
    dir = join(dir, '..');
  }
  return process.cwd();
}

async function findLatestBackup(backupDir: string): Promise<string | null> {
  try {
    const files = await readdir(backupDir);
    const backups = files
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.sql')))
      .sort()
      .reverse();
    return backups[0] ? join(backupDir, backups[0]) : null;
  } catch {
    return null;
  }
}

async function verifyJsonBackup(content: string, result: VerifyResult): Promise<void> {
  let data: Record<string, unknown[]>;
  try {
    data = JSON.parse(content);
  } catch {
    result.errors.push('JSON parse failed — backup file is corrupt');
    return;
  }

  if (typeof data !== 'object' || data === null) {
    result.errors.push('Backup root is not an object');
    return;
  }

  const tables = Object.keys(data);
  result.tables = tables.length;

  if (tables.length === 0) {
    result.errors.push('Backup contains zero tables');
    return;
  }

  // Check required tables
  for (const table of REQUIRED_TABLES) {
    if (!tables.includes(table)) {
      result.errors.push(`Required table missing: ${table}`);
    }
  }

  // Check expected non-empty tables
  let totalRows = 0;
  for (const table of tables) {
    const rows = Array.isArray(data[table]) ? data[table].length : 0;
    totalRows += rows;
  }
  result.totalRows = totalRows;

  for (const table of EXPECTED_NON_EMPTY) {
    if (tables.includes(table) && Array.isArray(data[table]) && data[table].length === 0) {
      result.warnings.push(`Expected non-empty table has 0 rows: ${table}`);
    }
  }
}

async function verifySqlBackup(content: string, result: VerifyResult): Promise<void> {
  if (!content.includes('INSERT INTO')) {
    result.errors.push('SQL backup contains no INSERT statements');
    return;
  }

  // Count tables and rows from INSERT statements
  const insertMatches = content.match(/INSERT INTO "([^"]+)"/g) || [];
  const tableSet = new Set(insertMatches.map((m) => m.replace(/INSERT INTO "([^"]+)"/, '$1')));
  result.tables = tableSet.size;
  result.totalRows = insertMatches.length;

  for (const table of REQUIRED_TABLES) {
    if (!tableSet.has(table)) {
      result.warnings.push(`Required table not found in SQL backup: ${table}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const maxAgeArg = args.find((a) => a.startsWith('--max-age='));
  const dirArg = args.find((a) => a.startsWith('--dir='));

  const maxAgeHours = maxAgeArg ? Number(maxAgeArg.split('=')[1]) : DEFAULT_MAX_AGE_HOURS;
  const projectRoot = findProjectRoot();
  const backupDir = dirArg
    ? join(projectRoot, dirArg.split('=')[1]!)
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

  // Check age
  try {
    const fileStat = await stat(latestPath);
    const ageMs = Date.now() - fileStat.mtime.getTime();
    result.ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;

    if (result.ageHours > maxAgeHours) {
      result.errors.push(`Backup is ${result.ageHours}h old (max: ${maxAgeHours}h) — stale`);
    }
  } catch {
    result.errors.push('Cannot stat backup file');
  }

  // Read and verify content
  try {
    const content = await readFile(latestPath, 'utf8');

    if (content.length === 0) {
      result.errors.push('Backup file is empty');
    } else if (latestPath.endsWith('.json')) {
      await verifyJsonBackup(content, result);
    } else if (latestPath.endsWith('.sql')) {
      await verifySqlBackup(content, result);
    } else {
      result.errors.push(`Unknown backup format: ${latestPath}`);
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
