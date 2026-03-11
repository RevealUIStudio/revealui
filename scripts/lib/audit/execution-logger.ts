/**
 * Execution Logger with PGlite
 *
 * Tracks all script executions in a local PGlite database for auditing,
 * analytics, and history viewing. Provides query interface for retrieving
 * execution records.
 *
 * @dependencies
 * - scripts/lib/paths.ts - Project root resolution for database storage
 * - @electric-sql/pglite - Embedded PostgreSQL database
 * - node:fs/promises - File system operations for database directory
 * - node:path - Path manipulation utilities
 *
 * @example
 * ```typescript
 * const logger = await ExecutionLogger.getInstance()
 *
 * // Start execution
 * const executionId = await logger.startExecution({
 *   scriptName: 'db',
 *   command: 'migrate',
 *   args: ['--dry-run'],
 * })
 *
 * // End execution
 * await logger.endExecution(executionId, {
 *   success: true,
 *   output: { migrationsRun: 3 },
 * })
 *
 * // Query history
 * const history = await logger.getHistory({
 *   scriptName: 'db',
 *   limit: 10,
 * })
 * ```
 */

import { mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { ErrorCode, ScriptError } from '../errors.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution record stored in database
 */
export interface ExecutionRecord {
  /** Unique execution ID */
  id: string;

  /** Script name (e.g., 'db', 'workflow') */
  scriptName: string;

  /** Command executed (e.g., 'migrate', 'backup') */
  command: string;

  /** Command-line arguments */
  args: string[];

  /** Environment (development, production, CI) */
  environment: string;

  /** User who executed the script */
  user: string;

  /** Hostname where script was executed */
  hostname: string;

  /** Execution start timestamp */
  startedAt: Date;

  /** Execution end timestamp */
  endedAt: Date | null;

  /** Duration in milliseconds */
  durationMs: number | null;

  /** Whether execution succeeded */
  success: boolean | null;

  /** Exit code */
  exitCode: number | null;

  /** Output data (JSON) */
  output: Record<string, unknown> | null;

  /** Error information */
  error: string | null;

  /** Working directory */
  cwd: string;

  /** Node version */
  nodeVersion: string;

  /** Git commit hash (if available) */
  gitCommit: string | null;

  /** Git branch (if available) */
  gitBranch: string | null;
}

/**
 * Options for starting execution tracking
 */
export interface StartExecutionOptions {
  /** Script name */
  scriptName: string;

  /** Command name */
  command: string;

  /** Command-line arguments */
  args?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for ending execution tracking
 */
export interface EndExecutionOptions {
  /** Whether execution succeeded */
  success: boolean;

  /** Exit code */
  exitCode?: number;

  /** Output data */
  output?: Record<string, unknown>;

  /** Error message */
  error?: string;
}

/**
 * Query options for execution history
 */
export interface HistoryQueryOptions {
  /** Filter by script name */
  scriptName?: string;

  /** Filter by command */
  command?: string;

  /** Filter by success status */
  success?: boolean;

  /** Only failed executions */
  failedOnly?: boolean;

  /** Start date filter */
  startDate?: Date;

  /** End date filter */
  endDate?: Date;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Order by field */
  orderBy?: 'startedAt' | 'durationMs';

  /** Order direction */
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  /** Total executions */
  totalExecutions: number;

  /** Successful executions */
  successfulExecutions: number;

  /** Failed executions */
  failedExecutions: number;

  /** Success rate (0-1) */
  successRate: number;

  /** Average duration in milliseconds */
  avgDurationMs: number;

  /** Most executed scripts */
  topScripts: Array<{
    scriptName: string;
    command: string;
    count: number;
    avgDurationMs: number;
  }>;

  /** Recent failures */
  recentFailures: Array<{
    scriptName: string;
    command: string;
    timestamp: Date;
    error: string;
  }>;
}

// =============================================================================
// Execution Logger Class
// =============================================================================

export class ExecutionLogger {
  private static instance: ExecutionLogger | null = null;
  private db: PGlite | null = null;
  private dbPath: string;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Get singleton instance
   */
  static async getInstance(projectRoot?: string): Promise<ExecutionLogger> {
    if (!ExecutionLogger.instance) {
      const root = projectRoot || process.cwd();
      const dbPath = join(root, '.revealui', 'execution-logs.db');
      ExecutionLogger.instance = new ExecutionLogger(dbPath);
      await ExecutionLogger.instance.initialize();
    }

    return ExecutionLogger.instance;
  }

  /**
   * Initialize database and create schema
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(join(this.dbPath, '..'), { recursive: true });

      // Initialize PGlite
      this.db = new PGlite(this.dbPath);

      // Create schema
      await this.createSchema();
    } catch (error) {
      console.error('Failed to initialize execution logger:', error);
      throw error;
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        script_name TEXT NOT NULL,
        command TEXT NOT NULL,
        args JSONB NOT NULL,
        environment TEXT NOT NULL,
        username TEXT NOT NULL,
        hostname TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        duration_ms INTEGER,
        success BOOLEAN,
        exit_code INTEGER,
        output JSONB,
        error TEXT,
        cwd TEXT NOT NULL,
        node_version TEXT NOT NULL,
        git_commit TEXT,
        git_branch TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_executions_script_name ON executions(script_name);
      CREATE INDEX IF NOT EXISTS idx_executions_command ON executions(command);
      CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);
      CREATE INDEX IF NOT EXISTS idx_executions_success ON executions(success);
      CREATE INDEX IF NOT EXISTS idx_executions_script_command ON executions(script_name, command);
    `);
  }

  /**
   * Start tracking a script execution
   */
  async startExecution(options: StartExecutionOptions): Promise<string> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const id = this.generateExecutionId();
    const environment = this.detectEnvironment();
    const user = process.env.USER || process.env.USERNAME || 'unknown';
    const gitInfo = await this.getGitInfo();

    await this.db.query(
      `
        INSERT INTO executions (
          id, script_name, command, args, environment, username, hostname,
          started_at, cwd, node_version, git_commit, git_branch
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        id,
        options.scriptName,
        options.command,
        JSON.stringify(options.args || []),
        environment,
        user,
        hostname(),
        new Date().toISOString(),
        process.cwd(),
        process.version,
        gitInfo.commit,
        gitInfo.branch,
      ],
    );

    return id;
  }

  /**
   * End tracking a script execution
   */
  async endExecution(executionId: string, options: EndExecutionOptions): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    // Get start time to calculate duration
    const result = await this.db.query<{ started_at: string }>(
      `
      SELECT started_at FROM executions WHERE id = $1
    `,
      [executionId],
    );

    if (result.rows.length === 0) {
      throw new ScriptError(`Execution not found: ${executionId}`, ErrorCode.NOT_FOUND);
    }

    const startTime = new Date(result.rows[0].started_at).getTime();
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    await this.db.query(
      `
        UPDATE executions
        SET ended_at = $1,
            duration_ms = $2,
            success = $3,
            exit_code = $4,
            output = $5,
            error = $6
        WHERE id = $7
      `,
      [
        new Date().toISOString(),
        durationMs,
        options.success,
        options.exitCode || (options.success ? 0 : 1),
        options.output ? JSON.stringify(options.output) : null,
        options.error || null,
        executionId,
      ],
    );
  }

  /**
   * Get execution history
   */
  async getHistory(options: HistoryQueryOptions = {}): Promise<ExecutionRecord[]> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const {
      scriptName,
      command,
      success,
      failedOnly,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      orderBy = 'startedAt',
      orderDirection = 'DESC',
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (scriptName) {
      conditions.push(`script_name = $${paramIndex++}`);
      params.push(scriptName);
    }

    if (command) {
      conditions.push(`command = $${paramIndex++}`);
      params.push(command);
    }

    if (success !== undefined) {
      conditions.push(`success = $${paramIndex++}`);
      params.push(success);
    }

    if (failedOnly) {
      conditions.push(`success = false`);
    }

    if (startDate) {
      conditions.push(`started_at >= $${paramIndex++}`);
      params.push(startDate.toISOString());
    }

    if (endDate) {
      conditions.push(`started_at <= $${paramIndex++}`);
      params.push(endDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderByField = orderBy === 'startedAt' ? 'started_at' : 'duration_ms';

    const query = `
      SELECT * FROM executions
      ${whereClause}
      ORDER BY ${orderByField} ${orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows.map(this.mapRowToRecord);
  }

  /**
   * Get execution statistics
   */
  async getStats(options: { scriptName?: string; days?: number } = {}): Promise<ExecutionStats> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const { scriptName, days = 30 } = options;

    const whereClause = scriptName
      ? `WHERE script_name = '${scriptName}' AND started_at >= NOW() - INTERVAL '${days} days'`
      : `WHERE started_at >= NOW() - INTERVAL '${days} days'`;

    // Get overall stats
    const statsResult = await this.db.query<{
      total: number;
      successful: number;
      failed: number;
      avg_duration: number;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration
      FROM executions
      ${whereClause}
    `);

    const stats = statsResult.rows[0];

    // Get top scripts
    const topScriptsResult = await this.db.query<{
      script_name: string;
      command: string;
      count: number;
      avg_duration: number;
    }>(`
      SELECT
        script_name,
        command,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration
      FROM executions
      ${whereClause}
      GROUP BY script_name, command
      ORDER BY count DESC
      LIMIT 10
    `);

    // Get recent failures
    const failuresResult = await this.db.query<{
      script_name: string;
      command: string;
      started_at: string;
      error: string;
    }>(`
      SELECT script_name, command, started_at, error
      FROM executions
      WHERE success = false ${scriptName ? `AND script_name = '${scriptName}'` : ''}
      ORDER BY started_at DESC
      LIMIT 10
    `);

    return {
      totalExecutions: Number(stats.total),
      successfulExecutions: Number(stats.successful),
      failedExecutions: Number(stats.failed),
      successRate: Number(stats.total) > 0 ? Number(stats.successful) / Number(stats.total) : 0,
      avgDurationMs: Number(stats.avg_duration) || 0,
      topScripts: topScriptsResult.rows.map((row) => ({
        scriptName: row.script_name,
        command: row.command,
        count: Number(row.count),
        avgDurationMs: Number(row.avg_duration) || 0,
      })),
      recentFailures: failuresResult.rows.map((row) => ({
        scriptName: row.script_name,
        command: row.command,
        timestamp: new Date(row.started_at),
        error: row.error || 'Unknown error',
      })),
    };
  }

  /**
   * Get a specific execution record
   */
  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query('SELECT * FROM executions WHERE id = $1', [executionId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRecord(result.rows[0]);
  }

  /**
   * Clean up old execution records
   */
  async cleanup(daysToKeep: number = 90): Promise<number> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query<{ count: number }>(`
      DELETE FROM executions
      WHERE started_at < NOW() - INTERVAL '${daysToKeep} days'
      RETURNING id
    `);

    return result.rows.length;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Detect execution environment
   */
  private detectEnvironment(): string {
    if (process.env.CI) return 'ci';
    if (process.env.NODE_ENV === 'production') return 'production';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'development';
  }

  /**
   * Get git information
   */
  private async getGitInfo(): Promise<{ commit: string | null; branch: string | null }> {
    try {
      const { execSync } = await import('node:child_process');

      const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

      return { commit, branch };
    } catch {
      return { commit: null, branch: null };
    }
  }

  /**
   * Map database row to ExecutionRecord
   */
  // biome-ignore lint/suspicious/noExplicitAny: Database row type is dynamic
  private mapRowToRecord(row: any): ExecutionRecord {
    // Helper to safely parse JSONB fields (might already be parsed)
    // biome-ignore lint/suspicious/noExplicitAny: Generic JSON parsing utility
    const parseJsonField = (field: any, defaultValue: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return defaultValue;
        }
      }
      return field ?? defaultValue;
    };

    return {
      id: row.id,
      scriptName: row.script_name,
      command: row.command,
      args: parseJsonField(row.args, []),
      environment: row.environment,
      user: row.username,
      hostname: row.hostname,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      durationMs: row.duration_ms,
      success: row.success,
      exitCode: row.exit_code,
      output: parseJsonField(row.output, null),
      error: row.error,
      cwd: row.cwd,
      nodeVersion: row.node_version,
      gitCommit: row.git_commit,
      gitBranch: row.git_branch,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get execution logger instance
 */
export async function getExecutionLogger(projectRoot?: string): Promise<ExecutionLogger> {
  return ExecutionLogger.getInstance(projectRoot);
}
