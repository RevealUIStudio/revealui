/**
 * Deprecation Manager
 *
 * Tracks deprecated features, functions, and APIs across scripts.
 * Provides warnings and migration guidance.
 *
 * @example
 * ```typescript
 * const manager = await getDeprecationManager()
 *
 * // Add deprecation
 * await manager.addDeprecation({
 *   scriptName: 'db',
 *   feature: 'legacyMigrate',
 *   version: '2.0.0',
 *   reason: 'Replaced with improved migration system',
 *   alternative: 'Use migrate command with --strategy flag',
 *   removalVersion: '3.0.0',
 *   severity: 'warning',
 * })
 *
 * // Check deprecations
 * const warnings = await manager.checkDeprecations('db')
 * ```
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// =============================================================================
// Types
// =============================================================================

/**
 * Deprecation record
 */
export interface Deprecation {
  /** Script name */
  scriptName: string

  /** Feature/function being deprecated */
  feature: string

  /** Version when deprecation was introduced */
  version: string

  /** Reason for deprecation */
  reason: string

  /** Alternative to use */
  alternative: string

  /** Version when feature will be removed */
  removalVersion: string

  /** Severity level */
  severity: 'info' | 'warning' | 'error'

  /** Timestamp when added */
  addedAt?: Date
}

// =============================================================================
// Deprecation Manager Class
// =============================================================================

export class DeprecationManager {
  private static instance: DeprecationManager | null = null
  private db: PGlite | null = null
  private dbPath: string

  private constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  /**
   * Get singleton instance
   */
  static async getInstance(projectRoot?: string): Promise<DeprecationManager> {
    if (!DeprecationManager.instance) {
      const root = projectRoot || process.cwd()
      const dbPath = join(root, '.revealui', 'script-management.db')
      DeprecationManager.instance = new DeprecationManager(dbPath)
      await DeprecationManager.instance.initialize()
    }

    return DeprecationManager.instance
  }

  /**
   * Initialize database and create schema
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(join(this.dbPath, '..'), { recursive: true })

      // Initialize PGlite
      this.db = new PGlite(this.dbPath)

      // Create schema
      await this.createSchema()
    } catch (error) {
      console.error('Failed to initialize deprecation manager:', error)
      throw error
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS deprecations (
        id SERIAL PRIMARY KEY,
        script_name TEXT NOT NULL,
        feature TEXT NOT NULL,
        version TEXT NOT NULL,
        reason TEXT NOT NULL,
        alternative TEXT NOT NULL,
        removal_version TEXT NOT NULL,
        severity TEXT NOT NULL,
        added_at BIGINT NOT NULL,
        UNIQUE(script_name, feature)
      );

      CREATE INDEX IF NOT EXISTS idx_deprecations_script_name ON deprecations(script_name);
      CREATE INDEX IF NOT EXISTS idx_deprecations_version ON deprecations(version);
      CREATE INDEX IF NOT EXISTS idx_deprecations_severity ON deprecations(severity);
    `)
  }

  /**
   * Add a deprecation notice
   */
  async addDeprecation(deprecation: Deprecation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.exec({
      query: `
        INSERT INTO deprecations (
          script_name, feature, version, reason, alternative,
          removal_version, severity, added_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (script_name, feature) DO UPDATE SET
          version = EXCLUDED.version,
          reason = EXCLUDED.reason,
          alternative = EXCLUDED.alternative,
          removal_version = EXCLUDED.removal_version,
          severity = EXCLUDED.severity
      `,
      params: [
        deprecation.scriptName,
        deprecation.feature,
        deprecation.version,
        deprecation.reason,
        deprecation.alternative,
        deprecation.removalVersion,
        deprecation.severity,
        Date.now(),
      ],
    })
  }

  /**
   * Get deprecations for a specific script
   */
  async getDeprecations(scriptName: string): Promise<Deprecation[]> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM deprecations WHERE script_name = $1 ORDER BY added_at DESC',
      [scriptName],
    )

    return result.rows.map((row) => this.mapRowToDeprecation(row))
  }

  /**
   * Get deprecations by version
   */
  async getDeprecationsByVersion(scriptName: string, version: string): Promise<Deprecation[]> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM deprecations WHERE script_name = $1 AND version = $2',
      [scriptName, version],
    )

    return result.rows.map((row) => this.mapRowToDeprecation(row))
  }

  /**
   * Get all deprecations across all scripts
   */
  async getAllDeprecations(): Promise<Deprecation[]> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM deprecations ORDER BY script_name, added_at DESC',
    )

    return result.rows.map((row) => this.mapRowToDeprecation(row))
  }

  /**
   * Check for deprecation warnings for a script
   */
  async checkDeprecations(scriptName: string): Promise<{
    hasDeprecations: boolean
    warnings: Deprecation[]
    errors: Deprecation[]
    info: Deprecation[]
  }> {
    if (!this.db) throw new Error('Database not initialized')

    const deprecations = await this.getDeprecations(scriptName)

    const warnings = deprecations.filter((d) => d.severity === 'warning')
    const errors = deprecations.filter((d) => d.severity === 'error')
    const info = deprecations.filter((d) => d.severity === 'info')

    return {
      hasDeprecations: deprecations.length > 0,
      warnings,
      errors,
      info,
    }
  }

  /**
   * Remove a deprecation notice
   */
  async removeDeprecation(scriptName: string, feature: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'DELETE FROM deprecations WHERE script_name = $1 AND feature = $2',
      [scriptName, feature],
    )

    return result.affectedRows !== undefined && result.affectedRows > 0
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Map database row to Deprecation
   */
  private mapRowToDeprecation(row: any): Deprecation {
    return {
      scriptName: row.script_name,
      feature: row.feature,
      version: row.version,
      reason: row.reason,
      alternative: row.alternative,
      removalVersion: row.removal_version,
      severity: row.severity as 'info' | 'warning' | 'error',
      addedAt: new Date(Number(row.added_at)),
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get deprecation manager instance
 */
export async function getDeprecationManager(projectRoot?: string): Promise<DeprecationManager> {
  return DeprecationManager.getInstance(projectRoot)
}
