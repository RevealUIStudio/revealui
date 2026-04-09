# Alert Integration Guide

Complete guide to using the RevealUI alert system with request context and Sentry integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Alert Channels](#alert-channels)
- [Request Context Integration](#request-context-integration)
- [Sentry Integration](#sentry-integration)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The RevealUI alert system provides a unified interface for sending alerts through multiple channels (logger, console, Sentry) with automatic request context integration for distributed tracing.

**Key Features:**
- Multiple delivery channels (logger, console, Sentry)
- Automatic request context enrichment
- Alert aggregation in production
- Sentry integration with user tracking
- Configurable thresholds and channels

## Quick Start

```typescript
import { sendAlert } from '@revealui/core/monitoring/alerts'

// Send a warning alert
sendAlert({
  level: 'warning',
  metric: 'cpu_usage',
  value: 85,
  threshold: 80,
  message: 'High CPU usage detected',
  timestamp: Date.now(),
})

// Send a critical alert (will be sent to Sentry in production)
sendAlert({
  level: 'critical',
  metric: 'memory_usage',
  value: 98,
  threshold: 95,
  message: 'Critical memory usage - immediate action required',
  timestamp: Date.now(),
})
```

## Alert Channels

The alert system supports three channels:

### 1. Logger Channel

Logs alerts using the standard logger with automatic request ID inclusion:

```typescript
// Logs are automatically enriched with request context
sendAlert({
  level: 'warning',
  metric: 'response_time',
  value: 2500,
  threshold: 2000,
  message: 'Slow API response detected',
  timestamp: Date.now(),
})

// Log output includes:
// - requestId (if in request context)
// - userId (if available)
// - path, method, ip (if available)
// - metric, value, threshold
```

### 2. Console Channel

Outputs formatted alerts to console (useful for development):

```typescript
// Console output:
// [2026-02-01T19:00:00.000Z] 🔴 CRITICAL: Critical memory usage
// [2026-02-01T19:00:00.000Z] ⚠️  WARNING: High CPU usage
```

### 3. Sentry Channel

Sends critical alerts to Sentry with full context:

```typescript
// Only critical alerts are sent to Sentry
sendAlert({
  level: 'critical',
  metric: 'database_errors',
  value: 50,
  threshold: 10,
  message: 'Database error spike detected',
  timestamp: Date.now(),
})

// Sentry event includes:
// - Tags: metric, alert_level, request_id, user_id, path, method
// - Extra: value, threshold, timestamp, full request context
// - User context: userId, IP address
```

## Request Context Integration

When alerts are sent within a request context, they are automatically enriched with tracing information:

```typescript
import { withRequestContext } from '@revealui/core/utils/api-wrapper'
import { sendAlert } from '@revealui/core/monitoring/alerts'

// In a Next.js API route
export const GET = withRequestContext(async (request) => {
  // Alert automatically includes:
  // - requestId
  // - userId (if authenticated)
  // - path (/api/users)
  // - method (GET)
  // - ip address
  // - user agent

  sendAlert({
    level: 'warning',
    metric: 'slow_query',
    value: 3000,
    threshold: 1000,
    message: 'Database query exceeded threshold',
    timestamp: Date.now(),
  })

  return NextResponse.json({ status: 'ok' })
})
```

### Manual Request Context

You can also manually create request context:

```typescript
import { runInRequestContext, createRequestContext } from '@revealui/core/utils/request-context'
import { sendAlert } from '@revealui/core/monitoring/alerts'

const context = createRequestContext({
  userId: 'user-123',
  path: '/background-job',
  method: 'CRON',
})

runInRequestContext(context, () => {
  sendAlert({
    level: 'critical',
    metric: 'job_failure',
    value: 1,
    threshold: 0,
    message: 'Background job failed',
    timestamp: Date.now(),
  })
})
```

## Sentry Integration

### Automatic Integration

Sentry is automatically integrated when available:

```typescript
// In your app initialization (sentry.server.config.ts)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
})

// Alert system will automatically use Sentry
// No additional configuration needed
```

### What Gets Sent to Sentry

**Only critical alerts** are sent to Sentry to avoid noise:

```typescript
// ✅ Sent to Sentry
sendAlert({ level: 'critical', ... })

// ❌ Not sent to Sentry (only logged)
sendAlert({ level: 'warning', ... })
```

**Sentry Event Structure:**

```typescript
{
  message: 'Critical memory usage',
  level: 'error',
  tags: {
    metric: 'memory_usage',
    alert_level: 'critical',
    request_id: 'req-123',      // From request context
    user_id: 'user-456',         // From request context
    path: '/api/users',          // From request context
    method: 'GET'                // From request context
  },
  extra: {
    value: 98,
    threshold: 95,
    timestamp: 1706832000000,
    request_context: {
      requestId: 'req-123',
      startTime: 1706831999000,
      duration: 1000,
      userId: 'user-456',
      path: '/api/users',
      method: 'GET',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...'
    }
  },
  user: {
    id: 'user-456',
    ip_address: '192.168.1.1'
  }
}
```

## Configuration

### Default Configuration

```typescript
{
  channels: ['logger', 'console'],
  aggregateInProduction: true,        // Aggregate alerts in production
  aggregationInterval: 5 * 60 * 1000, // 5 minutes
  sentryProductionOnly: true          // Only use Sentry in production
}
```

### Custom Configuration

Create a custom AlertManager instance:

```typescript
import { AlertManager } from '@revealui/core/monitoring/alerts'

const customAlertManager = new AlertManager({
  channels: ['logger', 'sentry'],
  aggregateInProduction: false,     // Send immediately
  sentryProductionOnly: false       // Use Sentry in all environments
})

// Use custom instance
customAlertManager.sendAlert({
  level: 'critical',
  metric: 'custom_metric',
  value: 100,
  threshold: 50,
  message: 'Custom alert',
  timestamp: Date.now(),
})
```

### Dynamic Channel Configuration

```typescript
import { setAlertChannels } from '@revealui/core/monitoring/alerts'

// In development
if (process.env.NODE_ENV === 'development') {
  setAlertChannels(['logger', 'console'])
}

// In production
if (process.env.NODE_ENV === 'production') {
  setAlertChannels(['logger', 'sentry'])
}
```

## Best Practices

### 1. Use Appropriate Alert Levels

```typescript
// ⚠️  WARNING: For non-critical issues that need attention
sendAlert({
  level: 'warning',
  metric: 'api_latency',
  value: 1500,
  threshold: 1000,
  message: 'API response time elevated',
  timestamp: Date.now(),
})

// 🔴 CRITICAL: For issues requiring immediate action
sendAlert({
  level: 'critical',
  metric: 'service_down',
  value: 1,
  threshold: 0,
  message: 'Database connection lost',
  timestamp: Date.now(),
})
```

### 2. Provide Clear, Actionable Messages

```typescript
// ❌ Bad: Vague message
message: 'Something went wrong'

// ✅ Good: Clear and actionable
message: 'Database connection pool exhausted (95/100 connections in use)'
```

### 3. Include Relevant Metrics

```typescript
// ❌ Bad: Missing context
sendAlert({
  level: 'critical',
  metric: 'error',
  value: 1,
  threshold: 0,
  message: 'Error occurred',
  timestamp: Date.now(),
})

// ✅ Good: Includes specific metrics
sendAlert({
  level: 'critical',
  metric: 'error_rate_5min',
  value: 45,        // 45% error rate
  threshold: 5,     // 5% threshold
  message: 'Error rate exceeded threshold: 45% errors in last 5 minutes',
  timestamp: Date.now(),
})
```

### 4. Batch Related Alerts

```typescript
import { sendAlerts } from '@revealui/core/monitoring/alerts'

// Send multiple related alerts at once
const healthAlerts = [
  {
    level: 'warning' as const,
    metric: 'cpu_usage',
    value: 85,
    threshold: 80,
    message: 'High CPU usage',
    timestamp: Date.now(),
  },
  {
    level: 'warning' as const,
    metric: 'memory_usage',
    value: 88,
    threshold: 85,
    message: 'High memory usage',
    timestamp: Date.now(),
  },
]

sendAlerts(healthAlerts)
```

### 5. Use Request Context for Traceability

```typescript
// ✅ Always use request context in API routes
export const POST = withRequestContext(async (request) => {
  try {
    await processPayment()
  } catch (error) {
    // Alert includes requestId, userId, path, method automatically
    sendAlert({
      level: 'critical',
      metric: 'payment_failure',
      value: 1,
      threshold: 0,
      message: 'Payment processing failed',
      timestamp: Date.now(),
    })
    throw error
  }
})
```

## Examples

### Health Monitoring

```typescript
import { sendAlert } from '@revealui/core/monitoring/alerts'

interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
}

function checkSystemHealth(metrics: SystemMetrics) {
  const alerts = []

  if (metrics.cpuUsage > 80) {
    alerts.push({
      level: 'warning' as const,
      metric: 'cpu_usage',
      value: metrics.cpuUsage,
      threshold: 80,
      message: `CPU usage at ${metrics.cpuUsage}%`,
      timestamp: Date.now(),
    })
  }

  if (metrics.cpuUsage > 95) {
    alerts.push({
      level: 'critical' as const,
      metric: 'cpu_usage',
      value: metrics.cpuUsage,
      threshold: 95,
      message: `CRITICAL: CPU usage at ${metrics.cpuUsage}%`,
      timestamp: Date.now(),
    })
  }

  if (metrics.memoryUsage > 90) {
    alerts.push({
      level: 'critical' as const,
      metric: 'memory_usage',
      value: metrics.memoryUsage,
      threshold: 90,
      message: `CRITICAL: Memory usage at ${metrics.memoryUsage}%`,
      timestamp: Date.now(),
    })
  }

  if (alerts.length > 0) {
    sendAlerts(alerts)
  }
}
```

### Error Rate Monitoring

```typescript
import { sendAlert } from '@revealui/core/monitoring/alerts'

class ErrorRateMonitor {
  private errorCount = 0
  private totalRequests = 0

  recordRequest(isError: boolean) {
    this.totalRequests++
    if (isError) this.errorCount++

    // Check every 100 requests
    if (this.totalRequests % 100 === 0) {
      this.checkErrorRate()
    }
  }

  private checkErrorRate() {
    const errorRate = (this.errorCount / this.totalRequests) * 100

    if (errorRate > 5 && errorRate <= 10) {
      sendAlert({
        level: 'warning',
        metric: 'error_rate',
        value: errorRate,
        threshold: 5,
        message: `Elevated error rate: ${errorRate.toFixed(2)}%`,
        timestamp: Date.now(),
      })
    } else if (errorRate > 10) {
      sendAlert({
        level: 'critical',
        metric: 'error_rate',
        value: errorRate,
        threshold: 10,
        message: `CRITICAL: Error rate at ${errorRate.toFixed(2)}%`,
        timestamp: Date.now(),
      })
    }
  }
}
```

### Database Connection Monitoring

```typescript
import { sendAlert } from '@revealui/core/monitoring/alerts'

interface PoolStats {
  activeConnections: number
  idleConnections: number
  maxConnections: number
}

function monitorConnectionPool(stats: PoolStats) {
  const utilizationPercent = (stats.activeConnections / stats.maxConnections) * 100

  if (utilizationPercent > 80) {
    sendAlert({
      level: 'warning',
      metric: 'db_pool_utilization',
      value: utilizationPercent,
      threshold: 80,
      message: `Database connection pool at ${utilizationPercent.toFixed(1)}% capacity (${stats.activeConnections}/${stats.maxConnections})`,
      timestamp: Date.now(),
    })
  }

  if (utilizationPercent > 95) {
    sendAlert({
      level: 'critical',
      metric: 'db_pool_utilization',
      value: utilizationPercent,
      threshold: 95,
      message: `CRITICAL: Database connection pool nearly exhausted (${stats.activeConnections}/${stats.maxConnections})`,
      timestamp: Date.now(),
    })
  }
}
```

### API Response Time Monitoring

```typescript
import { withRequestContext } from '@revealui/core/utils/api-wrapper'
import { sendAlert } from '@revealui/core/monitoring/alerts'
import { getRequestDuration } from '@revealui/core/utils/request-context'

export const GET = withRequestContext(async (request) => {
  const result = await fetchData()

  // Check response time
  const duration = getRequestDuration()
  if (duration && duration > 2000) {
    sendAlert({
      level: duration > 5000 ? 'critical' : 'warning',
      metric: 'api_response_time',
      value: duration,
      threshold: 2000,
      message: `Slow API response: ${duration}ms`,
      timestamp: Date.now(),
    })
  }

  return NextResponse.json(result)
})
```

## Testing

### Unit Testing with Mock Sentry

```typescript
import { describe, expect, it, vi } from 'vitest'
import { AlertManager, type SentryClient } from '@revealui/core/monitoring/alerts'

describe('Alert Integration', () => {
  it('should send critical alerts to Sentry', () => {
    // Create mock Sentry client
    const mockSentry: SentryClient = {
      captureMessage: vi.fn(),
      setUser: vi.fn(),
    }

    // Create AlertManager with mock
    const manager = new AlertManager(
      { channels: ['sentry'], sentryProductionOnly: false },
      mockSentry,
    )

    // Send alert
    manager.sendAlert({
      level: 'critical',
      metric: 'test_metric',
      value: 100,
      threshold: 50,
      message: 'Test alert',
      timestamp: Date.now(),
    })

    // Verify Sentry was called
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      'Test alert',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({
          metric: 'test_metric',
          alert_level: 'critical',
        }),
      }),
    )
  })
})
```

## Troubleshooting

### Alerts Not Appearing in Sentry

1. **Check Sentry is initialized:**
   ```typescript
   // Ensure Sentry.init() is called before using alerts
   import * as Sentry from '@sentry/nextjs'
   Sentry.init({ dsn: process.env.SENTRY_DSN })
   ```

2. **Check environment:**
   ```typescript
   // Sentry is production-only by default
   // Set sentryProductionOnly: false for development
   setAlertChannels(['logger', 'sentry'])
   ```

3. **Check alert level:**
   ```typescript
   // Only 'critical' alerts go to Sentry
   sendAlert({ level: 'critical', ... }) // ✅ Sent to Sentry
   sendAlert({ level: 'warning', ... })   // ❌ Not sent to Sentry
   ```

### Request Context Not Included

1. **Ensure using request context wrapper:**
   ```typescript
   // ✅ Correct
   export const GET = withRequestContext(async (request) => {
     sendAlert({ ... })
   })

   // ❌ Wrong - no request context
   export async function GET(request) {
     sendAlert({ ... })
   }
   ```

2. **Check middleware is configured:**
   ```typescript
   // apps/admin/src/middleware.ts should be present
   export function middleware(request: NextRequest) {
     // ... request ID generation
   }
   ```

## Related Documentation

- [Request Context Guide](../utils/REQUEST_TRACING.md)
- [Error Handling Guide](../utils/ERROR_HANDLING.md)
- [Database Error Tracking](../utils/DATABASE_ERROR_HANDLING.md)
- [Monitoring System](./README.md)
