#!/usr/bin/env tsx

/**
 * Query Stats Collection Command
 *
 * Reads `pg_stat_statements` on the REST database and emits a ranked report
 * of the slowest and highest-load queries. Intended to unblock Phase 4c
 * evidence-based performance indexing — until `pg_stat_statements` is
 * enabled on the production Neon instance, this script fails early with
 * operator-actionable guidance (exit 2 / `CONFIG_ERROR`).
 *
 * Usage:
 *   tsx scripts/commands/database/collect-query-stats.ts
 *   tsx scripts/commands/database/collect-query-stats.ts --limit=50
 *   tsx scripts/commands/database/collect-query-stats.ts --min-calls=10
 *   tsx scripts/commands/database/collect-query-stats.ts --json
 *   tsx scripts/commands/database/collect-query-stats.ts --output=.revealui/reports/query-stats.json
 *
 * Exit codes:
 *   0 = report emitted
 *   2 = config error (`POSTGRES_URL`/`DATABASE_URL` missing, or `pg_stat_statements` not enabled)
 *   3 = execution error (connection failed, query failed)
 *
 * Operator setup (Neon):
 *   1. Neon console → project → Settings → Integrations → enable `pg_stat_statements`,
 *      or run `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` against the target DB.
 *   2. Wait a few hours for representative traffic to accumulate.
 *   3. Re-run this script against the live DB (`DATABASE_URL` or `POSTGRES_URL` pointed at prod).
 *
 * @dependencies
 * - @revealui/scripts — createLogger, detectDatabaseProvider, getSSLConfig, ErrorCode
 * - pg — PostgreSQL client
 * - node:fs/promises — optional file output
 *
 * @requires
 * - Environment: POSTGRES_URL or DATABASE_URL — connection string for the target DB
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getSSLConfig } from '@revealui/scripts/database/ssl-config.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, detectDatabaseProvider } from '@revealui/scripts/index.js';

const logger = createLogger({ prefix: 'Query Stats' });

interface QueryStat {
  queryid: string;
  query: string;
  calls: number;
  total_exec_time_ms: number;
  mean_exec_time_ms: number;
  stddev_exec_time_ms: number;
  rows: number;
  shared_blks_hit: number;
  shared_blks_read: number;
}

interface CollectOptions {
  limit: number;
  minCalls: number;
  json: boolean;
  outputPath: string | null;
}

interface QueryStatsReport {
  collected_at: string;
  provider: string;
  host: string;
  options: CollectOptions;
  top_by_mean_exec_time: QueryStat[];
  top_by_total_exec_time: QueryStat[];
}

function parseArgs(): CollectOptions {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const minCallsArg = args.find((a) => a.startsWith('--min-calls='));
  const outputArg = args.find((a) => a.startsWith('--output='));
  const json = args.includes('--json') || Boolean(outputArg);

  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '25', 10) : 25;
  const minCalls = minCallsArg ? Number.parseInt(minCallsArg.split('=')[1] ?? '1', 10) : 1;
  const outputPath = outputArg ? outputArg.split('=').slice(1).join('=') : null;

  if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
    throw new Error(`--limit must be between 1 and 1000 (got ${limit})`);
  }
  if (!Number.isFinite(minCalls) || minCalls < 1) {
    throw new Error(`--min-calls must be >= 1 (got ${minCalls})`);
  }

  return { limit, minCalls, json, outputPath };
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(unparseable URL)';
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    logger.error('Neither POSTGRES_URL nor DATABASE_URL is set in the environment.');
    process.exit(ErrorCode.CONFIG_ERROR);
  }

  const provider = detectDatabaseProvider(url);
  const host = safeHost(url);
  logger.info(`Target: ${provider} (${host})`);

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url, ssl: getSSLConfig(url) });

  try {
    const client = await pool.connect();
    try {
      const ext = await client.query<{ extname: string }>(
        "SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'",
      );
      if (ext.rowCount === 0) {
        logger.error('pg_stat_statements extension is not enabled on this database.');
        logger.info('Operator setup (Neon):');
        logger.info('  1. Neon console → project → Settings → Integrations → enable pg_stat_statements');
        logger.info('     (alternative) CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
        logger.info('  2. Wait a few hours for representative traffic to accumulate.');
        logger.info('  3. Re-run this script.');
        process.exit(ErrorCode.CONFIG_ERROR);
      }

      const selectClause = `SELECT
           queryid::text AS queryid,
           LEFT(query, 2000) AS query,
           calls,
           total_exec_time AS total_exec_time_ms,
           mean_exec_time AS mean_exec_time_ms,
           stddev_exec_time AS stddev_exec_time_ms,
           rows,
           shared_blks_hit,
           shared_blks_read
         FROM pg_stat_statements
         WHERE calls >= $1
           AND query NOT ILIKE '%pg_stat_statements%'`;

      // Separate queries for each ordering — ORDER BY column names cannot be
      // parameterized in Postgres, and the two column choices are fixed literals.
      const byMean = await client.query<QueryStat>(
        `${selectClause} ORDER BY mean_exec_time DESC LIMIT $2`,
        [options.minCalls, options.limit],
      );
      const byTotal = await client.query<QueryStat>(
        `${selectClause} ORDER BY total_exec_time DESC LIMIT $2`,
        [options.minCalls, options.limit],
      );

      const report: QueryStatsReport = {
        collected_at: new Date().toISOString(),
        provider,
        host,
        options,
        top_by_mean_exec_time: byMean.rows,
        top_by_total_exec_time: byTotal.rows,
      };

      if (options.outputPath) {
        const outPath = resolve(process.cwd(), options.outputPath);
        await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
        logger.success(`Report written to ${outPath}`);
      } else if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printHumanReport(report);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Query failed: ${msg}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  } finally {
    await pool.end();
  }
}

function printHumanReport(report: QueryStatsReport): void {
  logger.divider();
  logger.info(`Collected at: ${report.collected_at}`);
  logger.info(`Target: ${report.provider} (${report.host})`);
  logger.info(
    `Options: limit=${report.options.limit}, min-calls=${report.options.minCalls}`,
  );
  logger.divider();

  printSection('Top by mean execution time (ms)', report.top_by_mean_exec_time);
  logger.divider();
  printSection('Top by total execution time (ms)', report.top_by_total_exec_time);
}

function printSection(title: string, stats: QueryStat[]): void {
  logger.header(title);
  if (stats.length === 0) {
    logger.info('(no rows — ensure pg_stat_statements has accumulated data)');
    return;
  }
  for (const s of stats) {
    const q = s.query.replace(/\s+/g, ' ').trim().slice(0, 120);
    logger.info(
      `  mean=${Number(s.mean_exec_time_ms).toFixed(2)}ms  total=${Number(s.total_exec_time_ms).toFixed(0)}ms  calls=${s.calls}  stddev=${Number(s.stddev_exec_time_ms).toFixed(2)}ms  rows=${s.rows}`,
    );
    logger.info(`    ${q}${s.query.length > 120 ? '…' : ''}`);
  }
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(msg);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
