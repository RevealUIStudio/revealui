/**
 * Alert Integration Tests
 *
 * Tests alert delivery through different channels with request context integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type RequestContext, runInRequestContext } from '../../utils/request-context.js'
import { AlertManager, type SentryClient } from '../alerts.js'
import type { Alert } from '../types.js'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Alert Integration', () => {
  let mockSentryClient: SentryClient
  let logger: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import logger
    const loggerModule = await import('../../utils/logger.js')
    logger = loggerModule.logger

    // Create mock Sentry client
    mockSentryClient = {
      captureMessage: vi.fn(),
      setUser: vi.fn(),
    }
  })

  describe('sendAlert', () => {
    it('should send alert through logger channel', () => {
      const manager = new AlertManager({ channels: ['logger'] }, null)

      const alert: Alert = {
        level: 'warning',
        metric: 'cpu_usage',
        value: 85,
        threshold: 80,
        message: 'High CPU usage detected',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(logger.warn).toHaveBeenCalledWith(
        'High CPU usage detected',
        expect.objectContaining({
          metric: 'cpu_usage',
          value: 85,
          threshold: 80,
        }),
      )
    })

    it('should send critical alert through error logger', () => {
      const manager = new AlertManager({ channels: ['logger'] }, null)

      const alert: Alert = {
        level: 'critical',
        metric: 'memory_usage',
        value: 98,
        threshold: 95,
        message: 'Critical memory usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(logger.error).toHaveBeenCalledWith(
        'Critical memory usage',
        expect.objectContaining({
          metric: 'memory_usage',
          value: 98,
          threshold: 95,
        }),
      )
    })

    it('should include request context in logger output', () => {
      const manager = new AlertManager({ channels: ['logger'] }, null)

      const context: RequestContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        userId: 'user-456',
        path: '/api/users',
        method: 'GET',
        ip: '192.168.1.1',
      }

      const alert: Alert = {
        level: 'warning',
        metric: 'response_time',
        value: 2500,
        threshold: 2000,
        message: 'Slow response detected',
        timestamp: Date.now(),
      }

      runInRequestContext(context, () => {
        manager.sendAlert(alert)
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow response detected',
        expect.objectContaining({
          metric: 'response_time',
          userId: 'user-456',
          path: '/api/users',
          method: 'GET',
          ip: '192.168.1.1',
        }),
      )
    })

    it('should not include request context when not in context', () => {
      const manager = new AlertManager({ channels: ['logger'] }, null)

      const alert: Alert = {
        level: 'warning',
        metric: 'disk_usage',
        value: 85,
        threshold: 80,
        message: 'High disk usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      const logCall = logger.warn.mock.calls[0]
      expect(logCall).toBeDefined()

      const logData = logCall?.[1]
      expect(logData).not.toHaveProperty('userId')
      expect(logData).not.toHaveProperty('path')
      expect(logData).not.toHaveProperty('method')
    })
  })

  describe('Sentry Integration', () => {
    it('should not send warning alerts to Sentry', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const alert: Alert = {
        level: 'warning',
        metric: 'cpu_usage',
        value: 85,
        threshold: 80,
        message: 'High CPU usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(mockSentryClient.captureMessage).not.toHaveBeenCalled()
    })

    it('should send critical alerts to Sentry', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const alert: Alert = {
        level: 'critical',
        metric: 'memory_usage',
        value: 98,
        threshold: 95,
        message: 'Critical memory usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(mockSentryClient.captureMessage).toHaveBeenCalledWith(
        'Critical memory usage',
        expect.objectContaining({
          level: 'error',
          tags: expect.objectContaining({
            metric: 'memory_usage',
            alert_level: 'critical',
          }),
          extra: expect.objectContaining({
            value: 98,
            threshold: 95,
          }),
        }),
      )
    })

    it('should include request ID in Sentry tags', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const context: RequestContext = {
        requestId: 'req-123',
        startTime: Date.now(),
      }

      const alert: Alert = {
        level: 'critical',
        metric: 'error_rate',
        value: 50,
        threshold: 10,
        message: 'High error rate detected',
        timestamp: Date.now(),
      }

      runInRequestContext(context, () => {
        manager.sendAlert(alert)
      })

      expect(mockSentryClient.captureMessage).toHaveBeenCalledWith(
        'High error rate detected',
        expect.objectContaining({
          tags: expect.objectContaining({
            request_id: 'req-123',
          }),
        }),
      )
    })

    it('should include full request context in Sentry extra', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const context: RequestContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        userId: 'user-456',
        path: '/api/critical',
        method: 'POST',
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
      }

      const alert: Alert = {
        level: 'critical',
        metric: 'database_errors',
        value: 10,
        threshold: 5,
        message: 'Database error spike',
        timestamp: Date.now(),
      }

      runInRequestContext(context, () => {
        manager.sendAlert(alert)
      })

      expect(mockSentryClient.captureMessage).toHaveBeenCalledWith(
        'Database error spike',
        expect.objectContaining({
          tags: expect.objectContaining({
            request_id: 'req-123',
            user_id: 'user-456',
            path: '/api/critical',
            method: 'POST',
          }),
          extra: expect.objectContaining({
            request_context: expect.objectContaining({
              requestId: 'req-123',
              userId: 'user-456',
              path: '/api/critical',
              method: 'POST',
              ip: '10.0.0.1',
              userAgent: 'Mozilla/5.0',
            }),
          }),
        }),
      )
    })

    it('should set Sentry user context when userId is available', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const context: RequestContext = {
        requestId: 'req-123',
        startTime: Date.now(),
        userId: 'user-789',
        ip: '192.168.1.100',
      }

      const alert: Alert = {
        level: 'critical',
        metric: 'auth_failures',
        value: 100,
        threshold: 50,
        message: 'Authentication failure spike',
        timestamp: Date.now(),
      }

      runInRequestContext(context, () => {
        manager.sendAlert(alert)
      })

      expect(mockSentryClient.setUser).toHaveBeenCalledWith({
        id: 'user-789',
        ip_address: '192.168.1.100',
      })
    })

    it('should not set Sentry user context when userId is not available', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        mockSentryClient,
      )

      const context: RequestContext = {
        requestId: 'req-123',
        startTime: Date.now(),
      }

      const alert: Alert = {
        level: 'critical',
        metric: 'system_overload',
        value: 100,
        threshold: 90,
        message: 'System overload',
        timestamp: Date.now(),
      }

      runInRequestContext(context, () => {
        manager.sendAlert(alert)
      })

      expect(mockSentryClient.setUser).not.toHaveBeenCalled()
    })

    it('should handle Sentry errors gracefully', () => {
      const brokenSentryClient: SentryClient = {
        captureMessage: vi.fn(() => {
          throw new Error('Sentry error')
        }),
        setUser: vi.fn(),
      }

      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        brokenSentryClient,
      )

      const alert: Alert = {
        level: 'critical',
        metric: 'test_metric',
        value: 100,
        threshold: 50,
        message: 'Test alert',
        timestamp: Date.now(),
      }

      // Should not throw
      expect(() => manager.sendAlert(alert)).not.toThrow()

      expect(logger.debug).toHaveBeenCalledWith(
        'Sentry not available for alert delivery',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      )
    })

    it('should not send to Sentry when client is null', () => {
      const manager = new AlertManager(
        { channels: ['sentry'], sentryProductionOnly: false, aggregateInProduction: false },
        null,
      )

      const alert: Alert = {
        level: 'critical',
        metric: 'test_metric',
        value: 100,
        threshold: 50,
        message: 'Test alert',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(logger.debug).toHaveBeenCalledWith('Sentry not available for alert delivery')
    })
  })

  describe('Multiple Channels', () => {
    it('should send alert through multiple channels', () => {
      const manager = new AlertManager(
        {
          channels: ['logger', 'sentry'],
          sentryProductionOnly: false,
          aggregateInProduction: false,
        },
        mockSentryClient,
      )

      const alert: Alert = {
        level: 'critical',
        metric: 'cpu_usage',
        value: 99,
        threshold: 90,
        message: 'Critical CPU usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(logger.error).toHaveBeenCalled()
      expect(mockSentryClient.captureMessage).toHaveBeenCalled()
    })

    it('should send to logger but not Sentry for warnings', () => {
      const manager = new AlertManager(
        {
          channels: ['logger', 'sentry'],
          sentryProductionOnly: false,
          aggregateInProduction: false,
        },
        mockSentryClient,
      )

      const alert: Alert = {
        level: 'warning',
        metric: 'memory_usage',
        value: 75,
        threshold: 70,
        message: 'Elevated memory usage',
        timestamp: Date.now(),
      }

      manager.sendAlert(alert)

      expect(logger.warn).toHaveBeenCalled()
      expect(mockSentryClient.captureMessage).not.toHaveBeenCalled()
    })
  })

  describe('sendAlerts', () => {
    it('should send multiple alerts', () => {
      const manager = new AlertManager({ channels: ['logger'] }, null)

      const alerts: Alert[] = [
        {
          level: 'warning',
          metric: 'cpu_usage',
          value: 85,
          threshold: 80,
          message: 'High CPU',
          timestamp: Date.now(),
        },
        {
          level: 'critical',
          metric: 'memory_usage',
          value: 98,
          threshold: 95,
          message: 'Critical memory',
          timestamp: Date.now(),
        },
      ]

      manager.sendAlerts(alerts)

      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('Alert Stats', () => {
    it('should return alert queue stats', () => {
      const manager = new AlertManager({}, null)

      const stats = manager.getStats()

      expect(stats).toHaveProperty('queueSize')
      expect(stats).toHaveProperty('lastAggregationTime')
      expect(stats).toHaveProperty('aggregationEnabled')
    })
  })

  describe('Cleanup', () => {
    it('should dispose resources properly', () => {
      const manager = new AlertManager({ aggregateInProduction: false }, null)

      // Should not throw
      expect(() => manager.dispose()).not.toThrow()
    })
  })
})
