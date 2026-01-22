/**
 * Performance Monitoring & Testing
 *
 * Load testing, performance benchmarking, and monitoring utilities
 * for enterprise-scale sync operations.
 */

import type { SyncClient } from '../client/index.js'

// Control verbose logging for performance operations
const VERBOSE_LOGGING = process.env.PERFORMANCE_VERBOSE !== 'false' && (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true')

// =============================================================================
// Types
// =============================================================================

export interface PerformanceTestResult {
  testName: string
  duration: number
  operationsPerSecond: number
  successRate: number
  errorCount: number
  avgLatency: number
  p95Latency: number
  p99Latency: number
  metadata?: Record<string, unknown>
}

export interface LoadTestConfig {
  duration: number // in seconds
  concurrency: number
  rampUp: number // ramp up time in seconds
  operations: LoadTestOperation[]
}

export interface LoadTestOperation {
  name: string
  weight: number // relative frequency
  execute: (client: SyncClient, userId: string) => Promise<void>
}

export interface MonitoringConfig {
  enabled: boolean
  interval: number // monitoring interval in seconds
  metrics: string[]
  alerts: AlertConfig[]
}

export interface AlertConfig {
  metric: string
  threshold: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  message: string
  cooldown: number // minutes
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  activeConnections: number
  queueDepth: number
  errorRate: number
  lastIncident?: Date
  alerts: Alert[]
}

export interface Alert {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

// =============================================================================
// Performance Tester
// =============================================================================

export class PerformanceTester {
  constructor(private client: SyncClient) {}

  async runLoadTest(config: LoadTestConfig): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []
    const startTime = Date.now()
    const endTime = startTime + config.duration * 1000

    console.log(`Starting load test: ${config.duration}s, ${config.concurrency} concurrent users`)

    // Generate test users
    const testUsers = Array.from({ length: config.concurrency }, (_, i) => `test-user-${i}`)

    // Distribute operations based on weights
    const totalWeight = config.operations.reduce((sum, op) => sum + op.weight, 0)
    const operationPool: LoadTestOperation[] = []

    config.operations.forEach(op => {
      const count = Math.round((op.weight / totalWeight) * 100)
      for (let i = 0; i < count; i++) {
        operationPool.push(op)
      }
    })

    // Run concurrent operations
    const promises = testUsers.map(async (userId, index) => {
      const rampDelay = (config.rampUp / config.concurrency) * index * 1000
      await this.delay(rampDelay)

      const userResults: PerformanceTestResult[] = []

      while (Date.now() < endTime) {
        const operation = operationPool[Math.floor(Math.random() * operationPool.length)]

        const result = await this.timeOperation(operation, userId)
        userResults.push(result)

        // Small delay between operations
        await this.delay(10)
      }

      return userResults
    })

    const allResults = await Promise.all(promises)
    const flatResults = allResults.flat()

    // Aggregate results by operation
    const aggregatedResults = this.aggregateResults(flatResults)

    console.log(`Load test completed. Results:`, aggregatedResults)

    return aggregatedResults
  }

  async runBenchmark(testName: string, operation: () => Promise<void>, iterations: number = 100): Promise<PerformanceTestResult> {
    console.log(`Running benchmark: ${testName} (${iterations} iterations)`)

    const latencies: number[] = []
    let errorCount = 0

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()

      try {
        await operation()
      } catch (error) {
        errorCount++
      }

      const end = performance.now()
      latencies.push(end - start)

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i + 1}/${iterations}`)
      }
    }

    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
    const sortedLatencies = latencies.sort((a, b) => a - b)
    const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
    const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]

    const result: PerformanceTestResult = {
      testName,
      duration: latencies.reduce((sum, lat) => sum + lat, 0),
      operationsPerSecond: iterations / (latencies.reduce((sum, lat) => sum + lat, 0) / 1000),
      successRate: (iterations - errorCount) / iterations,
      errorCount,
      avgLatency,
      p95Latency,
      p99Latency,
    }

    console.log(`Benchmark completed:`, result)

    return result
  }

  private async timeOperation(operation: LoadTestOperation, userId: string): Promise<PerformanceTestResult> {
    const start = performance.now()
    let success = true

    try {
      await operation.execute(this.client, userId)
    } catch (error) {
      success = false
    }

    const end = performance.now()
    const latency = end - start

    return {
      testName: operation.name,
      duration: latency,
      operationsPerSecond: 1 / (latency / 1000),
      successRate: success ? 1 : 0,
      errorCount: success ? 0 : 1,
      avgLatency: latency,
      p95Latency: latency,
      p99Latency: latency,
    }
  }

  private aggregateResults(results: PerformanceTestResult[]): PerformanceTestResult[] {
    const byName = new Map<string, PerformanceTestResult[]>()

    results.forEach(result => {
      if (!byName.has(result.testName)) {
        byName.set(result.testName, [])
      }
      byName.get(result.testName)!.push(result)
    })

    return Array.from(byName.entries()).map(([testName, testResults]) => {
      const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0)
      const totalOperations = testResults.length
      const errorCount = testResults.reduce((sum, r) => sum + r.errorCount, 0)
      const latencies = testResults.map(r => r.avgLatency).sort((a, b) => a - b)

      return {
        testName,
        duration: totalDuration,
        operationsPerSecond: totalOperations / (totalDuration / 1000),
        successRate: (totalOperations - errorCount) / totalOperations,
        errorCount,
        avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
        p95Latency: latencies[Math.floor(latencies.length * 0.95)],
        p99Latency: latencies[Math.floor(latencies.length * 0.99)],
      }
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// =============================================================================
// System Monitor
// =============================================================================

export class SystemMonitor {
  private alerts: Alert[] = []
  private lastMetrics: Map<string, number> = new Map()
  private alertCooldowns: Map<string, number> = new Map()

  constructor(private client: SyncClient, private config: MonitoringConfig) {}

  start(): () => void {
    if (!this.config.enabled) return () => {}

    const interval = setInterval(() => {
      this.checkHealth()
    }, this.config.interval * 1000)

    return () => clearInterval(interval)
  }

  getHealth(): SystemHealth {
    const activeConnections = this.lastMetrics.get('activeConnections') || 0
    const queueDepth = this.lastMetrics.get('queueDepth') || 0
    const errorRate = this.lastMetrics.get('errorRate') || 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (errorRate > 0.1 || queueDepth > 1000) {
      status = 'unhealthy'
    } else if (errorRate > 0.05 || queueDepth > 500) {
      status = 'degraded'
    }

    const unresolvedAlerts = this.alerts.filter(a => !a.resolved)

    return {
      status,
      uptime: process.uptime(),
      activeConnections,
      queueDepth,
      errorRate,
      alerts: unresolvedAlerts,
    }
  }

  private async checkHealth(): Promise<void> {
    try {
      // Gather metrics
      const metrics = await this.gatherMetrics()

      // Update stored metrics
      metrics.forEach((value, key) => {
        this.lastMetrics.set(key, value)
      })

      // Check alerts
      this.checkAlerts(metrics)

    } catch (error) {
      console.error('Health check failed:', error)
      this.createAlert('error', `Health check failed: ${error}`)
    }
  }

  private async gatherMetrics(): Promise<Map<string, number>> {
    const metrics = new Map<string, number>()

    try {
      // Database connection count (mock)
      metrics.set('activeConnections', Math.floor(Math.random() * 100))

      // Queue depth (mock)
      metrics.set('queueDepth', Math.floor(Math.random() * 1000))

      // Error rate (mock)
      metrics.set('errorRate', Math.random() * 0.1)

      // Response time (mock)
      metrics.set('avgResponseTime', 50 + Math.random() * 50)

    } catch (error) {
      console.error('Failed to gather metrics:', error)
    }

    return metrics
  }

  private checkAlerts(metrics: Map<string, number>): void {
    this.config.alerts.forEach(alertConfig => {
      const currentValue = metrics.get(alertConfig.metric)
      if (currentValue === undefined) return

      const now = Date.now()
      const lastAlert = this.alertCooldowns.get(alertConfig.message) || 0

      // Check cooldown
      if (now - lastAlert < alertConfig.cooldown * 60 * 1000) return

      let triggered = false

      switch (alertConfig.operator) {
        case 'gt':
          triggered = currentValue > alertConfig.threshold
          break
        case 'lt':
          triggered = currentValue < alertConfig.threshold
          break
        case 'eq':
          triggered = currentValue === alertConfig.threshold
          break
        case 'gte':
          triggered = currentValue >= alertConfig.threshold
          break
        case 'lte':
          triggered = currentValue <= alertConfig.threshold
          break
      }

      if (triggered) {
        this.createAlert('warning', alertConfig.message)
        this.alertCooldowns.set(alertConfig.message, now)
      }
    })
  }

  private createAlert(level: 'info' | 'warning' | 'error' | 'critical', message: string): void {
    const alert: Alert = {
      id: crypto.randomUUID(),
      level,
      message,
      timestamp: new Date(),
      resolved: false,
    }

    this.alerts.push(alert)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    console.log(`ALERT [${level.toUpperCase()}]: ${message}`)
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
    }
  }
}

// =============================================================================
// Predefined Test Operations
// =============================================================================

export const standardLoadTestOperations: LoadTestOperation[] = [
  {
    name: 'create-conversation',
    weight: 10,
    execute: async (client, userId) => {
      await client.collaboration.createConversation({
        userId,
        agentId: 'test-agent',
        title: `Test Conversation ${Date.now()}`,
      })
    },
  },
  {
    name: 'send-message',
    weight: 50,
    execute: async (client, userId) => {
      // First get a conversation
      const conversations = await client.collaboration.getConversations(userId)
      if (conversations.length === 0) return

      const conversationId = conversations[0].id
      const message = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: `Test message ${Date.now()}`,
        timestamp: new Date().toISOString(),
      }

      await client.collaboration.sendMessage(conversationId, message, userId)
    },
  },
  {
    name: 'get-conversations',
    weight: 30,
    execute: async (client, userId) => {
      await client.collaboration.getConversations(userId)
    },
  },
  {
    name: 'store-memory',
    weight: 10,
    execute: async (client, userId) => {
      await client.memory.store({
        content: `Test memory ${Date.now()}`,
        type: 'fact',
        source: { type: 'test' },
        agentId: userId,
        siteId: 'test-site',
      })
    },
  },
]

// =============================================================================
// Utility Functions
// =============================================================================

export function createPerformanceTester(client: SyncClient): PerformanceTester {
  return new PerformanceTester(client)
}

export function createSystemMonitor(client: SyncClient, config: MonitoringConfig): SystemMonitor {
  return new SystemMonitor(client, config)
}

export function createDefaultMonitoringConfig(): MonitoringConfig {
  return {
    enabled: true,
    interval: 60, // 1 minute
    metrics: ['activeConnections', 'queueDepth', 'errorRate', 'avgResponseTime'],
    alerts: [
      {
        metric: 'errorRate',
        threshold: 0.05,
        operator: 'gt',
        message: 'Error rate above 5%',
        cooldown: 5,
      },
      {
        metric: 'queueDepth',
        threshold: 500,
        operator: 'gt',
        message: 'Queue depth above 500',
        cooldown: 2,
      },
      {
        metric: 'avgResponseTime',
        threshold: 1000,
        operator: 'gt',
        message: 'Average response time above 1s',
        cooldown: 1,
      },
    ],
  }
}