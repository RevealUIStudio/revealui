/**
 * Universal Dry-Run Engine
 *
 * Wraps file operations, database operations, and external commands
 * to simulate execution without making actual changes. Records all
 * operations for review and impact analysis.
 *
 * @dependencies
 * - node:child_process - Process execution for command simulation
 * - node:fs - Synchronous file system checks
 * - node:fs/promises - File system operation wrappers
 * - node:path - Path manipulation utilities
 * - node:util - Promisify utilities for exec
 *
 * @example
 * ```typescript
 * const dryRun = new DryRunEngine({ enabled: true })
 *
 * // Wrap file operations
 * await dryRun.fs.writeFile('output.txt', 'content')
 * await dryRun.fs.deleteFile('old.txt')
 *
 * // Wrap database operations
 * await dryRun.db.query('INSERT INTO users VALUES (...)')
 *
 * // Wrap external commands
 * await dryRun.exec('npm install')
 *
 * // Get recorded changes
 * const changes = dryRun.getChanges()
 * console.log(`${changes.length} operations recorded`)
 * ```
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, rmdir, unlink, writeFile } from 'node:fs/promises';

const executionContext = new AsyncLocalStorage<{ engine: DryRunEngine; simulation: boolean }>();

// =============================================================================
// Types
// =============================================================================

/**
 * Change types tracked by dry-run engine
 */
export type ChangeType =
  | 'file-write'
  | 'file-delete'
  | 'file-mkdir'
  | 'file-rmdir'
  | 'db-query'
  | 'db-insert'
  | 'db-update'
  | 'db-delete'
  | 'command-exec';

/**
 * Impact level of a change
 */
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Recorded change
 */
export interface Change {
  /** Unique change ID */
  id: string;

  /** Type of change */
  type: ChangeType;

  /** Target (file path, table name, command) */
  target: string;

  /** State before change */
  before?: unknown;

  /** State after change */
  after?: unknown;

  /** Impact level */
  impact: ImpactLevel;

  /** Timestamp */
  timestamp: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Dry-run engine options
 */
export interface DryRunOptions {
  /** Whether dry-run is enabled */
  enabled: boolean;

  /** Automatically read file contents before write/delete */
  captureBeforeState?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * File system operation result
 */
export interface FSOperationResult {
  /** Whether operation would succeed */
  success: boolean;

  /** Change ID */
  changeId?: string;

  /** Error if operation would fail */
  error?: string;
}

/**
 * Database operation result
 */
export interface DBOperationResult {
  /** Whether operation would succeed */
  success: boolean;

  /** Change ID */
  changeId?: string;

  /** Estimated affected rows */
  affectedRows?: number;

  /** Error if operation would fail */
  error?: string;
}

/**
 * Command execution result
 */
export interface ExecResult {
  /** Whether command would succeed */
  success: boolean;

  /** Change ID */
  changeId?: string;

  /** Simulated output */
  stdout?: string;

  /** Simulated error output */
  stderr?: string;
  simulated?: boolean;
}

// =============================================================================
// Dry-Run Engine
// =============================================================================

export class DryRunEngine {
  private enabled: boolean;
  private changes: Change[] = [];
  private options: DryRunOptions;
  private changeCounter = 0;

  constructor(options: DryRunOptions) {
    this.enabled = options.enabled;
    this.options = options;
  }

  /** Scope supported operations without allowing nested calls to downgrade simulation. */
  run<T>(operation: () => T): T {
    const inherited = executionContext.getStore();
    if (inherited?.simulation) return operation();
    return executionContext.run({ engine: this, simulation: this.enabled }, operation);
  }

  static activeSimulation(): DryRunEngine | undefined {
    const context = executionContext.getStore();
    return context?.simulation ? context.engine : undefined;
  }

  /** Record structured argv; no shell parsing or command-name safety heuristics. */
  recordCommand(command: string, args: string[] = []): string {
    return this.recordChange({
      type: 'command-exec',
      target: command,
      impact: 'low',
      metadata: { command, args: [...args], simulated: true },
    });
  }

  /**
   * File system operations wrapper
   */
  fs = {
    /**
     * Write file (dry-run safe)
     */
    writeFile: async (
      path: string,
      content: string | Buffer,
      encoding: BufferEncoding = 'utf-8',
    ): Promise<FSOperationResult> => {
      if (!this.isEnabled()) {
        await writeFile(path, content, encoding);
        return { success: true };
      }

      const before =
        this.options.captureBeforeState && existsSync(path)
          ? await readFile(path, encoding)
          : undefined;

      const changeId = this.recordChange({
        type: 'file-write',
        target: path,
        before,
        after: typeof content === 'string' ? content : `<Buffer ${content.length} bytes>`,
        impact: this.assessFileWriteImpact(path),
        metadata: {
          size: typeof content === 'string' ? content.length : content.length,
          encoding,
        },
      });

      this.log(
        `[DRY-RUN] Would write ${path} (${typeof content === 'string' ? content.length : content.length} bytes)`,
      );

      return { success: true, changeId };
    },

    /**
     * Delete file (dry-run safe)
     */
    deleteFile: async (path: string): Promise<FSOperationResult> => {
      if (!this.isEnabled()) {
        await unlink(path);
        return { success: true };
      }

      if (!existsSync(path)) {
        return {
          success: false,
          error: `File does not exist: ${path}`,
        };
      }

      const before = this.options.captureBeforeState
        ? await readFile(path, 'utf-8').catch(() => undefined)
        : undefined;

      const changeId = this.recordChange({
        type: 'file-delete',
        target: path,
        before,
        impact: 'high',
      });

      this.log(`[DRY-RUN] Would delete ${path}`);

      return { success: true, changeId };
    },

    /**
     * Create directory (dry-run safe)
     */
    mkdir: async (path: string, recursive = false): Promise<FSOperationResult> => {
      if (!this.isEnabled()) {
        await mkdir(path, { recursive });
        return { success: true };
      }

      const changeId = this.recordChange({
        type: 'file-mkdir',
        target: path,
        impact: 'low',
        metadata: { recursive },
      });

      this.log(`[DRY-RUN] Would create directory ${path}`);

      return { success: true, changeId };
    },

    /**
     * Remove directory (dry-run safe)
     */
    rmdir: async (path: string, recursive = false): Promise<FSOperationResult> => {
      if (!this.isEnabled()) {
        if (recursive) {
          await rm(path, { recursive: true, force: true });
        } else {
          await rmdir(path);
        }
        return { success: true };
      }

      const changeId = this.recordChange({
        type: 'file-rmdir',
        target: path,
        impact: 'high',
        metadata: { recursive },
      });

      this.log(`[DRY-RUN] Would remove directory ${path}`);

      return { success: true, changeId };
    },
  };

  /**
   * Database operations wrapper
   */
  db = {
    /**
     * Execute database query (dry-run safe)
     */
    query: async (sql: string, params?: unknown[]): Promise<DBOperationResult> => {
      if (!this.isEnabled()) {
        // In non-dry-run mode, this would execute actual query
        // For now, just return success
        return { success: true };
      }

      const queryType = this.detectQueryType(sql);
      const affectedRows = this.estimateAffectedRows(sql);

      const changeId = this.recordChange({
        type: queryType,
        target: this.extractTableName(sql) || 'unknown',
        after: { sql, params },
        impact: this.assessDBImpact(queryType),
        metadata: {
          sql,
          params,
          estimatedRows: affectedRows,
        },
      });

      this.log(`[DRY-RUN] Would execute query: ${sql}`);

      return {
        success: true,
        changeId,
        affectedRows,
      };
    },
  };

  /**
   * Execute external command (dry-run safe)
   */
  exec = async (command: string): Promise<ExecResult> => {
    if (!this.isEnabled()) {
      const { execCommand } = await import('../exec.js');
      const { success, stdout, stderr } = await execCommand(command, [], {
        shell: true,
        capture: true,
      });
      return {
        success,
        stdout,
        stderr,
      };
    }

    const changeId = this.recordChange({
      type: 'command-exec',
      target: command,
      impact: this.assessCommandImpact(command),
      metadata: {
        command,
      },
    });

    this.log(`[DRY-RUN] Would execute command: ${command}`);

    return {
      success: true,
      simulated: true,
      changeId,
      stdout: `[DRY-RUN] Command would execute: ${command}`,
    };
  };

  /**
   * Get all recorded changes
   */
  getChanges(): Change[] {
    return [...this.changes];
  }

  /**
   * Get changes by type
   */
  getChangesByType(type: ChangeType): Change[] {
    return this.changes.filter((c) => c.type === type);
  }

  /**
   * Get changes by impact level
   */
  getChangesByImpact(impact: ImpactLevel): Change[] {
    return this.changes.filter((c) => c.impact === impact);
  }

  /**
   * Clear all recorded changes
   */
  clearChanges(): void {
    this.changes = [];
    this.changeCounter = 0;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    byType: Record<ChangeType, number>;
    byImpact: Record<ImpactLevel, number>;
  } {
    const byType = {} as Record<ChangeType, number>;
    const byImpact = {} as Record<ImpactLevel, number>;

    for (const change of this.changes) {
      byType[change.type] = (byType[change.type] || 0) + 1;
      byImpact[change.impact] = (byImpact[change.impact] || 0) + 1;
    }

    return {
      total: this.changes.length,
      byType,
      byImpact,
    };
  }

  /**
   * Check if dry-run is enabled
   */
  isEnabled(): boolean {
    return this.enabled || Boolean(DryRunEngine.activeSimulation());
  }

  /**
   * Enable or disable dry-run mode
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const context = executionContext.getStore();
    if (enabled && context?.engine === this) context.simulation = true;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Record a change
   */
  private recordChange(change: Omit<Change, 'id' | 'timestamp'>): string {
    const id = `change_${++this.changeCounter}`;

    this.changes.push({
      id,
      timestamp: new Date(),
      ...change,
    });

    return id;
  }

  /**
   * Log message (if verbose)
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(message);
    }
  }

  /**
   * Assess impact of file write operation
   */
  private assessFileWriteImpact(path: string): ImpactLevel {
    // Critical system files
    if (path.includes('.env') || path.includes('package.json')) {
      return 'critical';
    }

    // High impact files
    if (path.includes('config') || path.includes('.json')) {
      return 'high';
    }

    // Medium impact
    if (path.includes('.ts') || path.includes('.js')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Detect query type from SQL
   */
  private detectQueryType(sql: string): ChangeType {
    const normalized = sql.trim().toUpperCase();

    if (normalized.startsWith('INSERT')) return 'db-insert';
    if (normalized.startsWith('UPDATE')) return 'db-update';
    if (normalized.startsWith('DELETE')) return 'db-delete';

    return 'db-query';
  }

  /**
   * Extract table name from SQL
   */
  private extractTableName(sql: string): string | null {
    // Report metadata only; never used to decide whether execution is safe.
    const tokens: string[] = [];
    let token = '';
    for (const character of sql) {
      if (character.trim() === '') {
        if (token) tokens.push(token);
        token = '';
      } else token += character;
    }
    if (token) tokens.push(token);
    for (let index = 0; index < tokens.length - 1; index++) {
      if (['FROM', 'INTO', 'UPDATE'].includes(tokens[index].toUpperCase()))
        return tokens[index + 1];
    }
    return null;
  }

  /**
   * Estimate affected rows (simplified)
   */
  private estimateAffectedRows(sql: string): number {
    // Simplified estimation
    if (sql.includes('WHERE')) return 1;
    return 0; // Unknown
  }

  /**
   * Assess database operation impact
   */
  private assessDBImpact(type: ChangeType): ImpactLevel {
    if (type === 'db-delete') return 'critical';
    if (type === 'db-update') return 'high';
    if (type === 'db-insert') return 'medium';
    return 'low';
  }

  /**
   * Assess command impact
   */
  private assessCommandImpact(command: string): ImpactLevel {
    const dangerous = ['rm ', 'del ', 'DROP', 'DELETE', 'truncate'];

    for (const word of dangerous) {
      if (command.includes(word)) return 'critical';
    }

    if (command.includes('install') || command.includes('update')) {
      return 'medium';
    }

    return 'low';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a dry-run engine instance
 */
export function createDryRunEngine(options: DryRunOptions): DryRunEngine {
  return new DryRunEngine(options);
}
