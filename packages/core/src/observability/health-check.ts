/**
 * Health Check System
 *
 * Provides health and readiness checks for the application
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthCheck {
  name: string
  check: () => Promise<HealthCheckResult>
  critical?: boolean
  timeout?: number
}

export interface HealthCheckResult {
  status: HealthStatus
  message?: string
  details?: Record<string, unknown>
  duration?: number
  timestamp?: string
}

export interface SystemHealth {
  status: HealthStatus
  checks: Record<string, HealthCheckResult>
  timestamp: string
  uptime: number
  version?: string
}

export class HealthCheckSystem {
  private checks: Map<string, HealthCheck> = new Map()
  private startTime: number = Date.now()

  /**
   * Register a health check
   */
  register(check: HealthCheck): void {
    this.checks.set(check.name, check)
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name)
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<SystemHealth> {
    const results: Record<string, HealthCheckResult> = {}
    let overallStatus: HealthStatus = 'healthy'

    for (const [name, check] of this.checks) {
      const startTime = Date.now()

      try {
        const timeout = check.timeout || 5000
        const result = await this.runWithTimeout(check.check(), timeout)

        results[name] = {
          ...result,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }

        // Update overall status
        if (check.critical && result.status === 'unhealthy') {
          overallStatus = 'unhealthy'
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded'
        } else if (result.status === 'unhealthy' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded'
        }
      } catch (error) {
        const duration = Date.now() - startTime

        results[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Check failed',
          duration,
          timestamp: new Date().toISOString(),
        }

        if (check.critical) {
          overallStatus = 'unhealthy'
        } else if (overallStatus === 'healthy') {
          overallStatus = 'degraded'
        }
      }
    }

    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION,
    }
  }

  /**
   * Run check with timeout
   */
  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Check timeout')), timeoutMs),
      ),
    ])
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }
}

/**
 * Default health check system
 */
export const healthCheck = new HealthCheckSystem()

/**
 * Database health check
 */
export function createDatabaseHealthCheck(queryFn: () => Promise<void>): HealthCheck {
  return {
    name: 'database',
    critical: true,
    timeout: 5000,
    check: async () => {
      const startTime = Date.now()

      try {
        await queryFn()

        const duration = Date.now() - startTime

        return {
          status: duration > 1000 ? 'degraded' : 'healthy',
          message: duration > 1000 ? 'Database responding slowly' : 'Database healthy',
          details: {
            responseTime: duration,
          },
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database connection failed',
        }
      }
    },
  }
}

/**
 * Redis health check
 */
export function createRedisHealthCheck(pingFn: () => Promise<string>): HealthCheck {
  return {
    name: 'redis',
    critical: false,
    timeout: 3000,
    check: async () => {
      const startTime = Date.now()

      try {
        const response = await pingFn()

        if (response !== 'PONG') {
          return {
            status: 'unhealthy',
            message: 'Redis ping failed',
          }
        }

        const duration = Date.now() - startTime

        return {
          status: duration > 500 ? 'degraded' : 'healthy',
          message: duration > 500 ? 'Redis responding slowly' : 'Redis healthy',
          details: {
            responseTime: duration,
          },
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Redis connection failed',
        }
      }
    },
  }
}

/**
 * Memory health check
 */
export function createMemoryHealthCheck(thresholdPercent: number = 90): HealthCheck {
  return {
    name: 'memory',
    critical: false,
    timeout: 1000,
    check: async () => {
      if (typeof process === 'undefined') {
        return {
          status: 'healthy',
          message: 'Memory check not available',
        }
      }

      const usage = process.memoryUsage()
      const usedPercent = (usage.heapUsed / usage.heapTotal) * 100

      let status: HealthStatus = 'healthy'
      let message = 'Memory usage normal'

      if (usedPercent > thresholdPercent) {
        status = 'unhealthy'
        message = 'Memory usage critical'
      } else if (usedPercent > thresholdPercent * 0.8) {
        status = 'degraded'
        message = 'Memory usage high'
      }

      return {
        status,
        message,
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          usedPercent: usedPercent.toFixed(2),
          external: usage.external,
          rss: usage.rss,
        },
      }
    },
  }
}

/**
 * Disk health check
 */
export function createDiskHealthCheck(thresholdPercent: number = 90): HealthCheck {
  return {
    name: 'disk',
    critical: false,
    timeout: 2000,
    check: async () => {
      // This would require a native module or fs stats
      // Placeholder implementation
      return {
        status: 'healthy',
        message: 'Disk check not implemented',
      }
    },
  }
}

/**
 * API endpoint health check
 */
export function createAPIHealthCheck(url: string, expectedStatus: number = 200): HealthCheck {
  return {
    name: `api:${url}`,
    critical: false,
    timeout: 10000,
    check: async () => {
      const startTime = Date.now()

      try {
        const response = await fetch(url)
        const duration = Date.now() - startTime

        if (response.status !== expectedStatus) {
          return {
            status: 'unhealthy',
            message: `API returned ${response.status}, expected ${expectedStatus}`,
            details: {
              status: response.status,
              responseTime: duration,
            },
          }
        }

        return {
          status: duration > 2000 ? 'degraded' : 'healthy',
          message: duration > 2000 ? 'API responding slowly' : 'API healthy',
          details: {
            status: response.status,
            responseTime: duration,
          },
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'API unreachable',
        }
      }
    },
  }
}

/**
 * Custom health check
 */
export function createCustomHealthCheck(
  name: string,
  checkFn: () => Promise<HealthCheckResult>,
  critical: boolean = false,
): HealthCheck {
  return {
    name,
    critical,
    check: checkFn,
  }
}

/**
 * Create health check endpoint handler
 */
export function createHealthEndpoint() {
  return async (): Promise<Response> => {
    const health = await healthCheck.checkHealth()

    const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

    return new Response(JSON.stringify(health, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }
}

/**
 * Create readiness check endpoint handler
 */
export function createReadinessEndpoint() {
  return async (): Promise<Response> => {
    const health = await healthCheck.checkHealth()

    // Only return 200 if all critical checks are healthy
    const ready = health.status !== 'unhealthy'

    const status = ready ? 200 : 503

    return new Response(
      JSON.stringify(
        {
          ready,
          status: health.status,
          timestamp: health.timestamp,
        },
        null,
        2,
      ),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  }
}

/**
 * Create liveness check endpoint handler
 */
export function createLivenessEndpoint() {
  return (): Response => {
    // Liveness is simple - if we can respond, we're alive
    return new Response(
      JSON.stringify(
        {
          alive: true,
          timestamp: new Date().toISOString(),
          uptime: healthCheck.getUptime(),
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  }
}

/**
 * Monitor health and log status changes
 */
export async function monitorHealth(
  intervalMs: number = 30000,
  onStatusChange?: (status: HealthStatus) => void,
): Promise<NodeJS.Timeout> {
  let lastStatus: HealthStatus | null = null

  const monitor = async () => {
    const health = await healthCheck.checkHealth()

    if (health.status !== lastStatus) {
      console.log(`Health status changed: ${lastStatus} -> ${health.status}`)

      if (onStatusChange) {
        onStatusChange(health.status)
      }

      lastStatus = health.status
    }
  }

  // Run immediately
  await monitor()

  // Then run on interval
  return setInterval(monitor, intervalMs)
}
