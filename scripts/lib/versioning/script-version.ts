/**
 * Script Version Manager
 *
 * Manages script versions with PGlite database, tracking version history,
 * compatibility information, and deprecation notices.
 *
 * @example
 * ```typescript
 * const manager = await getVersionManager()
 *
 * // Register new version
 * await manager.registerVersion({
 *   scriptName: 'db',
 *   version: '2.0.0',
 *   description: 'Major update with new features',
 *   releaseDate: new Date(),
 *   author: 'team',
 *   changelog: ['Added backup command', 'Improved migration speed'],
 *   breakingChanges: ['Changed config format'],
 *   requiredDependencies: { postgres: '>=14.0' },
 * })
 *
 * // Get version info
 * const version = await manager.getVersion('db', '2.0.0')
 *
 * // Check compatibility
 * const compat = await manager.checkCompatibility('db', '1.5.0')
 * ```
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// =============================================================================
// Types
// =============================================================================

/**
 * Version information for a script
 */
export interface VersionInfo {
  /** Script name */
  scriptName: string

  /** Semantic version (e.g., '1.2.3') */
  version: string

  /** Version description */
  description: string

  /** Release date */
  releaseDate: Date

  /** Author or team */
  author: string

  /** Changelog entries */
  changelog: string[]

  /** Breaking changes in this version */
  breakingChanges: string[]

  /** Required dependencies and their versions */
  requiredDependencies: Record<string, string>

  /** Deprecation notice (if version is deprecated) */
  deprecationNotice: string | null
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  /** Whether versions are compatible */
  compatible: boolean

  /** Current version */
  currentVersion: string

  /** Latest version */
  latestVersion: string

  /** Breaking changes since current version */
  breakingChanges: string[]

  /** Deprecation warnings */
  deprecationWarnings: string[]

  /** Recommended action */
  recommendation: string
}

// =============================================================================
// Script Version Manager Class
// =============================================================================

export class ScriptVersionManager {
  private static instance: ScriptVersionManager | null = null
  private db: PGlite | null = null
  private dbPath: string

  private constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  /**
   * Get singleton instance
   */
  static async getInstance(projectRoot?: string): Promise<ScriptVersionManager> {
    if (!ScriptVersionManager.instance) {
      const root = projectRoot || process.cwd()
      const dbPath = join(root, '.revealui', 'script-management.db')
      ScriptVersionManager.instance = new ScriptVersionManager(dbPath)
      await ScriptVersionManager.instance.initialize()
    }

    return ScriptVersionManager.instance
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
      console.error('Failed to initialize version manager:', error)
      throw error
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS script_versions (
        id SERIAL PRIMARY KEY,
        script_name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL,
        release_date BIGINT NOT NULL,
        author TEXT NOT NULL,
        changelog JSONB NOT NULL,
        breaking_changes JSONB NOT NULL,
        required_dependencies JSONB NOT NULL,
        deprecation_notice TEXT,
        created_at BIGINT NOT NULL,
        UNIQUE(script_name, version)
      );

      CREATE INDEX IF NOT EXISTS idx_versions_script_name ON script_versions(script_name);
      CREATE INDEX IF NOT EXISTS idx_versions_version ON script_versions(version);
      CREATE INDEX IF NOT EXISTS idx_versions_release_date ON script_versions(release_date);
    `)
  }

  /**
   * Register a new script version
   */
  async registerVersion(info: VersionInfo): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.exec({
      query: `
        INSERT INTO script_versions (
          script_name, version, description, release_date, author,
          changelog, breaking_changes, required_dependencies,
          deprecation_notice, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (script_name, version) DO UPDATE SET
          description = EXCLUDED.description,
          release_date = EXCLUDED.release_date,
          author = EXCLUDED.author,
          changelog = EXCLUDED.changelog,
          breaking_changes = EXCLUDED.breaking_changes,
          required_dependencies = EXCLUDED.required_dependencies,
          deprecation_notice = EXCLUDED.deprecation_notice
      `,
      params: [
        info.scriptName,
        info.version,
        info.description,
        info.releaseDate.getTime(),
        info.author,
        JSON.stringify(info.changelog),
        JSON.stringify(info.breakingChanges),
        JSON.stringify(info.requiredDependencies),
        info.deprecationNotice,
        Date.now(),
      ],
    })
  }

  /**
   * Get specific version information
   */
  async getVersion(scriptName: string, version: string): Promise<VersionInfo | null> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM script_versions WHERE script_name = $1 AND version = $2',
      [scriptName, version],
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToVersionInfo(result.rows[0])
  }

  /**
   * Get all versions for a script
   */
  async getVersions(scriptName: string): Promise<VersionInfo[]> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM script_versions WHERE script_name = $1 ORDER BY release_date DESC',
      [scriptName],
    )

    return result.rows.map((row) => this.mapRowToVersionInfo(row))
  }

  /**
   * Get latest version for a script
   */
  async getLatestVersion(scriptName: string): Promise<VersionInfo | null> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM script_versions WHERE script_name = $1 ORDER BY release_date DESC LIMIT 1',
      [scriptName],
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToVersionInfo(result.rows[0])
  }

  /**
   * Check compatibility between versions
   */
  async checkCompatibility(
    scriptName: string,
    currentVersion: string,
  ): Promise<CompatibilityCheck> {
    if (!this.db) throw new Error('Database not initialized')

    const latest = await this.getLatestVersion(scriptName)
    const current = await this.getVersion(scriptName, currentVersion)

    if (!latest) {
      return {
        compatible: true,
        currentVersion,
        latestVersion: currentVersion,
        breakingChanges: [],
        deprecationWarnings: [],
        recommendation: 'No version information available',
      }
    }

    if (!current) {
      return {
        compatible: false,
        currentVersion,
        latestVersion: latest.version,
        breakingChanges: [],
        deprecationWarnings: [],
        recommendation: `Current version ${currentVersion} not found. Latest is ${latest.version}`,
      }
    }

    // Get all versions between current and latest
    const result = await this.db.query<{
      breaking_changes: string
      deprecation_notice: string | null
    }>(
      `SELECT breaking_changes, deprecation_notice
       FROM script_versions
       WHERE script_name = $1
         AND release_date > $2
         AND release_date <= $3
       ORDER BY release_date ASC`,
      [scriptName, current.releaseDate.getTime(), latest.releaseDate.getTime()],
    )

    const breakingChanges: string[] = []
    const deprecationWarnings: string[] = []

    for (const row of result.rows) {
      const changes = JSON.parse(row.breaking_changes) as string[]
      breakingChanges.push(...changes)

      if (row.deprecation_notice) {
        deprecationWarnings.push(row.deprecation_notice)
      }
    }

    const compatible = breakingChanges.length === 0
    const isLatest = currentVersion === latest.version

    let recommendation: string
    if (isLatest) {
      recommendation = 'You are running the latest version'
    } else if (compatible) {
      recommendation = `Update to ${latest.version} (no breaking changes)`
    } else {
      recommendation = `Review breaking changes before updating to ${latest.version}`
    }

    return {
      compatible,
      currentVersion,
      latestVersion: latest.version,
      breakingChanges,
      deprecationWarnings,
      recommendation,
    }
  }

  /**
   * Get all versions across all scripts
   */
  async getAllVersions(): Promise<VersionInfo[]> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'SELECT * FROM script_versions ORDER BY script_name, release_date DESC',
    )

    return result.rows.map((row) => this.mapRowToVersionInfo(row))
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(scriptName: string, version: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query(
      'DELETE FROM script_versions WHERE script_name = $1 AND version = $2',
      [scriptName, version],
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
   * Map database row to VersionInfo
   */
  private mapRowToVersionInfo(row: any): VersionInfo {
    return {
      scriptName: row.script_name,
      version: row.version,
      description: row.description,
      releaseDate: new Date(Number(row.release_date)),
      author: row.author,
      changelog: JSON.parse(row.changelog),
      breakingChanges: JSON.parse(row.breaking_changes),
      requiredDependencies: JSON.parse(row.required_dependencies),
      deprecationNotice: row.deprecation_notice,
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get version manager instance
 */
export async function getVersionManager(projectRoot?: string): Promise<ScriptVersionManager> {
  return ScriptVersionManager.getInstance(projectRoot)
}
