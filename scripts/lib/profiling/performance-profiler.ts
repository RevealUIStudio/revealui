/**
 * Performance Profiler
 *
 * Tracks detailed performance metrics for script execution including
 * timing, memory usage, I/O operations, and bottleneck analysis.
 *
 * @example
 * ```typescript
 * const profiler = await getProfiler()
 *
 * // Start profiling
 * const executionId = await profiler.startProfile('db', 'migrate')
 *
 * // Mark phases
 * await profiler.markPhase(executionId, 'validation', { itemsValidated: 100 })
 * await profiler.markPhase(executionId, 'execution', { rowsAffected: 1000 })
 *
 * // Record I/O operations
 * await profiler.recordIO(executionId, 'database', 'write', 1024000, 250)
 *
 * // End profiling
 * await profiler.endProfile(executionId)
 *
 * // Analyze bottlenecks
 * const bottlenecks = await profiler.analyzeBottlenecks(executionId)
 * ```
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// =============================================================================
// Types
// =============================================================================

/**
 * Phase metrics
 */
export interface PhaseMetrics {
  /** Phase name */
  name: string

  /** Start time (ms since epoch) */
  startTime: number

  /** End time (ms since epoch) */
  endTime: number

  /** Duration in milliseconds */
  durationMs: number

  /** Memory used in bytes */
  memoryBytes: number

  /** Additional phase-specific data */
  metadata: Record<string, unknown>
}

/**
 * I/O operation record
 */
export interface IOOperation {
  /** Operation type (database, filesystem, network) */
  type: 'database' | 'filesystem' | 'network'

  /** Operation (read, write, query, etc.) */
  operation: string

  /** Bytes transferred */
  bytes: number

  /** Duration in milliseconds */
  durationMs: number

  /** Timestamp */
  timestamp: number
}

/**
 * Performance profile
 */
export interface PerformanceProfile {
  /** Unique execution ID */
  executionId: string

  /** Script name */
  scriptName: string

  /** Command executed */
  command: string

  /** Overall timing */
  timing: {
    startTime: number
    endTime: number | null
    durationMs: number | null
  }

  /** Phase-by-phase breakdown */
  phases: PhaseMetrics[]

  /** Memory usage */
  memory: {
    startMb: number
    peakMb: number
    endMb: number | null
  }

  /** I/O operations */
  io: {
    totalOperations: number
    totalBytes: number
    totalDurationMs: number
    operations: IOOperation[]
  }

  /** Creation timestamp */
  createdAt: Date
}

/**
 * Bottleneck information
 */
export interface BottleneckInfo {
  /** Bottleneck type */
  type: 'phase' | 'io' | 'memory'

  /** Description */
  description: string

  /** Impact (percentage of total time) */
  impactPercent: number

  /** Recommendation */
  recommendation: string

  /** Relevant metrics */
  metrics: Record<string, unknown>
}

// =============================================================================
// Performance Profiler Class
// =============================================================================

export class PerformanceProfiler {
  private static instance: PerformanceProfiler | null = null
  private db: PGlite | null = null
  private dbPath: string
  private activeProfiles: Map<string, { phases: PhaseMetrics[]; ios: IOOperation[] }> = new Map()

  private constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  /**
   * Get singleton instance
   */
  static async getInstance(projectRoot?: string): Promise<PerformanceProfiler> {
    if (!PerformanceProfiler.instance) {
      const root = projectRoot || process.cwd()
      const dbPath = join(root, '.revealui', 'script-management.db')
      PerformanceProfiler.instance = new PerformanceProfiler(dbPath)
      await PerformanceProfiler.instance.initialize()
    }

    return PerformanceProfiler.instance
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
      console.error('Failed to initialize performance profiler:', error)
      throw error
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_profiles (
        id TEXT PRIMARY KEY,
        script_name TEXT NOT NULL,
        command TEXT NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT,
        duration_ms INTEGER,
        phases JSONB NOT NULL,
        memory_start_mb REAL NOT NULL,
        memory_peak_mb REAL NOT NULL,
        memory_end_mb REAL,
        io_operations JSONB NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_profiles_script_name ON performance_profiles(script_name);
      CREATE INDEX IF NOT EXISTS idx_profiles_start_time ON performance_profiles(start_time);
      CREATE INDEX IF NOT EXISTS idx_profiles_duration ON performance_profiles(duration_ms);
    `)
  }

  /**
   * Start profiling an execution
   */
  async startProfile(scriptName: string, command: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const executionId = this.generateExecutionId()
    const startTime = Date.now()
    const startMemory = this.getMemoryUsageMb()

    // Initialize in-memory tracking
    this.activeProfiles.set(executionId, { phases: [], ios: [] })

    // Store in database
    await this.db.query(
      `
        INSERT INTO performance_profiles (
          id, script_name, command, start_time, phases,
          memory_start_mb, memory_peak_mb, io_operations, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        executionId,
        scriptName,
        command,
        startTime,
        JSON.stringify([]),
        startMemory,
        startMemory,
        JSON.stringify([]),
        Date.now(),
      ],
    )

    return executionId
  }

  /**
   * Mark the completion of a phase
   */
  async markPhase(
    executionId: string,
    phaseName: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const active = this.activeProfiles.get(executionId)
    if (!active) {
      throw new Error(`No active profile found for execution: ${executionId}`)
    }

    const now = Date.now()
    const previousPhaseEndTime =
      active.phases.length > 0
        ? active.phases[active.phases.length - 1].endTime
        : (await this.getProfile(executionId))?.timing.startTime || now

    const phase: PhaseMetrics = {
      name: phaseName,
      startTime: previousPhaseEndTime,
      endTime: now,
      durationMs: now - previousPhaseEndTime,
      memoryBytes: this.getMemoryUsageMb() * 1024 * 1024,
      metadata,
    }

    active.phases.push(phase)

    // Update database
    await this.updatePhases(executionId, active.phases)
  }

  /**
   * Record an I/O operation
   */
  async recordIO(
    executionId: string,
    type: IOOperation['type'],
    operation: string,
    bytes: number,
    durationMs: number,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const active = this.activeProfiles.get(executionId)
    if (!active) {
      throw new Error(`No active profile found for execution: ${executionId}`)
    }

    const io: IOOperation = {
      type,
      operation,
      bytes,
      durationMs,
      timestamp: Date.now(),
    }

    active.ios.push(io)

    // Update database
    await this.updateIOOperations(executionId, active.ios)
  }

  /**
   * End profiling and finalize metrics
   */
  async endProfile(executionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const active = this.activeProfiles.get(executionId)
    if (!active) {
      throw new Error(`No active profile found for execution: ${executionId}`)
    }

    const profile = await this.getProfile(executionId)
    if (!profile) {
      throw new Error(`Profile not found: ${executionId}`)
    }

    const endTime = Date.now()
    const endMemory = this.getMemoryUsageMb()
    const durationMs = endTime - profile.timing.startTime

    await this.db.query(
      `
        UPDATE performance_profiles
        SET end_time = $1,
            duration_ms = $2,
            memory_end_mb = $3,
            memory_peak_mb = GREATEST(memory_peak_mb, $4)
        WHERE id = $5
      `,
      [endTime, durationMs, endMemory, endMemory, executionId],
    )

    // Clean up active tracking
    this.activeProfiles.delete(executionId)
  }

  /**
   * Get a performance profile
   */
  async getProfile(executionId: string): Promise<PerformanceProfile | null> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.query('SELECT * FROM performance_profiles WHERE id = $1', [
      executionId,
    ])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToProfile(result.rows[0])
  }

  /**
   * Get profiles for a script
   */
  async getProfiles(
    scriptName: string,
    options: { limit?: number } = {},
  ): Promise<PerformanceProfile[]> {
    if (!this.db) throw new Error('Database not initialized')

    const { limit = 50 } = options

    const result = await this.db.query(
      `SELECT * FROM performance_profiles
       WHERE script_name = $1
       ORDER BY start_time DESC
       LIMIT $2`,
      [scriptName, limit],
    )

    return result.rows.map((row) => this.mapRowToProfile(row))
  }

  /**
   * Analyze bottlenecks in an execution
   */
  async analyzeBottlenecks(executionId: string): Promise<BottleneckInfo[]> {
    const profile = await this.getProfile(executionId)
    if (!profile?.timing.durationMs) {
      return []
    }

    const bottlenecks: BottleneckInfo[] = []
    const totalDuration = profile.timing.durationMs

    // Analyze phases
    for (const phase of profile.phases) {
      const impactPercent = (phase.durationMs / totalDuration) * 100

      if (impactPercent > 30) {
        bottlenecks.push({
          type: 'phase',
          description: `Phase "${phase.name}" takes ${impactPercent.toFixed(1)}% of total time`,
          impactPercent,
          recommendation: `Consider optimizing ${phase.name} phase`,
          metrics: {
            phaseName: phase.name,
            durationMs: phase.durationMs,
            memoryMb: (phase.memoryBytes / (1024 * 1024)).toFixed(2),
          },
        })
      }
    }

    // Analyze I/O operations
    const totalIOTime = profile.io.totalDurationMs
    if (totalIOTime > 0) {
      const ioImpactPercent = (totalIOTime / totalDuration) * 100

      if (ioImpactPercent > 40) {
        bottlenecks.push({
          type: 'io',
          description: `I/O operations take ${ioImpactPercent.toFixed(1)}% of total time`,
          impactPercent: ioImpactPercent,
          recommendation: 'Consider batching operations or using caching',
          metrics: {
            totalOperations: profile.io.totalOperations,
            totalBytes: profile.io.totalBytes,
            totalDurationMs: totalIOTime,
          },
        })
      }
    }

    // Analyze memory usage
    const memoryGrowth = profile.memory.endMb ? profile.memory.endMb - profile.memory.startMb : 0

    if (memoryGrowth > 100) {
      bottlenecks.push({
        type: 'memory',
        description: `Memory usage grew by ${memoryGrowth.toFixed(1)}MB`,
        impactPercent: 0,
        recommendation: 'Check for memory leaks or consider streaming large datasets',
        metrics: {
          startMb: profile.memory.startMb,
          peakMb: profile.memory.peakMb,
          endMb: profile.memory.endMb,
          growthMb: memoryGrowth,
        },
      })
    }

    return bottlenecks
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
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `prof_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsageMb(): number {
    const usage = process.memoryUsage()
    return usage.heapUsed / (1024 * 1024)
  }

  /**
   * Update phases in database
   */
  private async updatePhases(executionId: string, phases: PhaseMetrics[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const currentMemory = this.getMemoryUsageMb()

    await this.db.query(
      `
        UPDATE performance_profiles
        SET phases = $1,
            memory_peak_mb = GREATEST(memory_peak_mb, $2)
        WHERE id = $3
      `,
      [JSON.stringify(phases), currentMemory, executionId],
    )
  }

  /**
   * Update I/O operations in database
   */
  private async updateIOOperations(executionId: string, ios: IOOperation[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.query(
      'UPDATE performance_profiles SET io_operations = $1 WHERE id = $2',
      [JSON.stringify(ios), executionId],
    )
  }

  /**
   * Map database row to PerformanceProfile
   */
  private mapRowToProfile(row: any): PerformanceProfile {
    // Helper to safely parse JSONB fields (might already be parsed)
    const parseJsonField = (field: any, defaultValue: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field)
        } catch {
          return defaultValue
        }
      }
      return field ?? defaultValue
    }

    const phases = parseJsonField(row.phases, []) as PhaseMetrics[]
    const ioOperations = parseJsonField(row.io_operations, []) as IOOperation[]

    const totalIOBytes = ioOperations.reduce((sum, io) => sum + io.bytes, 0)
    const totalIODuration = ioOperations.reduce((sum, io) => sum + io.durationMs, 0)

    return {
      executionId: row.id,
      scriptName: row.script_name,
      command: row.command,
      timing: {
        startTime: Number(row.start_time),
        endTime: row.end_time ? Number(row.end_time) : null,
        durationMs: row.duration_ms ? Number(row.duration_ms) : null,
      },
      phases,
      memory: {
        startMb: Number(row.memory_start_mb),
        peakMb: Number(row.memory_peak_mb),
        endMb: row.memory_end_mb ? Number(row.memory_end_mb) : null,
      },
      io: {
        totalOperations: ioOperations.length,
        totalBytes: totalIOBytes,
        totalDurationMs: totalIODuration,
        operations: ioOperations,
      },
      createdAt: new Date(Number(row.created_at)),
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get performance profiler instance
 */
export async function getProfiler(projectRoot?: string): Promise<PerformanceProfiler> {
  return PerformanceProfiler.getInstance(projectRoot)
}
