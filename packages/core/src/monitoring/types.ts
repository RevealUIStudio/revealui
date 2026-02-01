/**
 * Process Health Monitoring Types
 *
 * TypeScript definitions for system health monitoring, process tracking,
 * zombie detection, and alerting.
 */

/**
 * Source of a tracked process
 */
export type ProcessSource =
  | 'exec' // Generic script execution
  | 'orchestration' // Workflow orchestration
  | 'mcp' // MCP adapter processes
  | 'ai-runtime' // AI agent runtime tasks
  | 'dev-server' // Development servers
  | 'database' // Database connections
  | 'unknown' // Unidentified source

/**
 * Status of a tracked process
 */
export type ProcessStatus =
  | 'running' // Currently executing
  | 'completed' // Exited successfully (code 0)
  | 'failed' // Exited with error (code !== 0)
  | 'zombie' // Defunct process
  | 'killed' // Terminated by signal

/**
 * Tracked process metadata
 */
export interface ProcessMetadata {
  [key: string]: string | number | boolean | undefined
}

/**
 * Tracked process entry
 */
export interface TrackedProcess {
  /** Process ID */
  pid: number

  /** Command executed */
  command: string

  /** Command arguments */
  args: string[]

  /** Process source */
  source: ProcessSource

  /** Current status */
  status: ProcessStatus

  /** Start timestamp */
  startTime: number

  /** End timestamp (if completed/failed/killed) */
  endTime?: number

  /** Exit code (if completed/failed) */
  exitCode?: number

  /** Signal that killed process (if killed) */
  signal?: string

  /** Custom metadata */
  metadata?: ProcessMetadata

  /** Parent process ID */
  ppid?: number
}

/**
 * Zombie process detection result
 */
export interface ZombieProcess {
  /** Process ID */
  pid: number

  /** Parent process ID */
  ppid: number

  /** Command name */
  command: string

  /** When zombie was first detected */
  detectedAt: number

  /** Associated tracked process (if available) */
  trackedProcess?: TrackedProcess
}

/**
 * Database pool metrics
 */
export interface PoolMetrics {
  /** Total connections in pool */
  totalCount: number

  /** Idle connections */
  idleCount: number

  /** Waiting requests */
  waitingCount: number

  /** Pool name/identifier */
  name: string
}

/**
 * System health metrics
 */
export interface HealthMetrics {
  /** System information */
  system: {
    /** Memory usage in MB */
    memoryUsage: number

    /** CPU usage percentage */
    cpuUsage: number

    /** Uptime in seconds */
    uptime: number

    /** Platform */
    platform: string

    /** Node.js version */
    nodeVersion: string
  }

  /** Process statistics */
  processes: {
    /** Active running processes */
    active: number

    /** Zombie processes */
    zombies: number

    /** Failed processes */
    failed: number

    /** Process spawn rate (per minute) */
    spawnRate: number

    /** Processes by source */
    bySource: Record<ProcessSource, number>
  }

  /** Database pool metrics */
  database: {
    /** REST database pools */
    rest: PoolMetrics[]

    /** Vector database pools */
    vector: PoolMetrics[]
  }

  /** Recent zombie processes */
  recentZombies: ZombieProcess[]

  /** Active alerts */
  alerts: Alert[]

  /** Timestamp of metrics collection */
  timestamp: number
}

/**
 * Alert severity level
 */
export type AlertLevel = 'warning' | 'critical'

/**
 * Alert metric type
 */
export type AlertMetric =
  | 'zombies'
  | 'memory'
  | 'active_processes'
  | 'database_waiting'
  | 'spawn_rate'

/**
 * Alert definition
 */
export interface Alert {
  /** Alert severity */
  level: AlertLevel

  /** Metric that triggered alert */
  metric: AlertMetric

  /** Human-readable message */
  message: string

  /** Current value */
  value: number

  /** Threshold that was exceeded */
  threshold: number

  /** Timestamp when alert was triggered */
  timestamp: number
}

/**
 * Alert threshold configuration
 */
export interface AlertThresholds {
  zombies: {
    warning: number
    critical: number
  }
  memory: {
    warning: number // MB
    critical: number // MB
  }
  processes: {
    active: {
      warning: number
      critical: number
    }
  }
  database: {
    waiting: {
      warning: number
      critical: number
    }
  }
  spawnRate: {
    warning: number // per minute
    critical: number // per minute
  }
}

/**
 * Cleanup handler function
 */
export type CleanupHandler = () => void | Promise<void>

/**
 * Cleanup handler registration
 */
export interface CleanupRegistration {
  /** Handler ID */
  id: string

  /** Handler function */
  handler: CleanupHandler

  /** Priority (higher executes first) */
  priority: number

  /** Handler description */
  description: string
}

/**
 * Process registry statistics
 */
export interface RegistryStats {
  /** Total processes tracked */
  total: number

  /** Currently running */
  running: number

  /** Completed successfully */
  completed: number

  /** Failed */
  failed: number

  /** Zombies detected */
  zombies: number

  /** Killed by signal */
  killed: number

  /** Processes by source */
  bySource: Record<ProcessSource, number>
}

/**
 * Health monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable process monitoring */
  enabled: boolean

  /** Zombie detection interval (ms) */
  zombieDetectionInterval: number

  /** Health check interval (ms) */
  healthCheckInterval: number

  /** Alert thresholds */
  alertThresholds: AlertThresholds

  /** Maximum tracked processes to keep in history */
  maxHistorySize: number

  /** Maximum zombies to track */
  maxZombieHistory: number
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enabled: process.env.ENABLE_PROCESS_MONITORING !== 'false',
  zombieDetectionInterval: 30_000, // 30 seconds
  healthCheckInterval: 5_000, // 5 seconds
  alertThresholds: {
    zombies: {
      warning: 3,
      critical: 5,
    },
    memory: {
      warning: 512, // MB
      critical: 1024, // MB
    },
    processes: {
      active: {
        warning: 50,
        critical: 100,
      },
    },
    database: {
      waiting: {
        warning: 5,
        critical: 10,
      },
    },
    spawnRate: {
      warning: 20, // per minute
      critical: 50, // per minute
    },
  },
  maxHistorySize: 1000,
  maxZombieHistory: 50,
}
