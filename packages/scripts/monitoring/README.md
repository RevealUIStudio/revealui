# Development Monitoring

Process health monitoring utilities for RevealUI development workflow.

## Overview

The monitoring system tracks all spawned processes, detects zombies, manages cleanup, and provides real-time health metrics during development.

## Features

- **Process Tracking**: All spawned processes are tracked with PID, status, and metadata
- **Zombie Detection**: Automatic scanning every 30 seconds for defunct processes
- **Graceful Shutdown**: Coordinated cleanup on SIGTERM/SIGINT with 30s timeout
- **Health Metrics**: System resources, process stats, database pools, alerts
- **Real-Time Dashboard**: Web UI at `/api/health-monitoring` when dev server is running

## Usage

### Automatic Monitoring (during `pnpm dev`)

Monitoring is automatically enabled when you run `pnpm dev`:

```bash
pnpm dev
```

This will:
- Start zombie detection (30s interval)
- Log monitoring status every 5 minutes
- Display a summary on exit (Ctrl+C)
- Track all spawned processes

### Manual Monitoring Status

Check current system health:

```bash
# One-time status check
pnpm monitor

# Watch mode (updates every 5s)
pnpm monitor:watch

# Custom interval
pnpm monitor:watch --interval 10  # Updates every 10s
```

### Web Dashboard

When the dev server is running, access the health monitoring dashboard:

1. Open your browser to the dashboard app
2. Click the "System Health" tab in the bottom panel
3. See real-time metrics, process list, and alerts

### API Endpoints

#### GET /api/health-monitoring

Returns comprehensive health metrics:

```bash
curl http://localhost:3000/api/health-monitoring | jq
```

Response:
- **200**: Healthy (no alerts)
- **206**: Degraded (warnings present)
- **503**: Unhealthy (critical alerts)

#### GET /api/health-monitoring/processes

Returns tracked process list with filtering:

```bash
# All processes
curl http://localhost:3000/api/health-monitoring/processes

# Filter by status
curl http://localhost:3000/api/health-monitoring/processes?status=running

# Filter by source
curl http://localhost:3000/api/health-monitoring/processes?source=exec

# Combined filters with limit
curl "http://localhost:3000/api/health-monitoring/processes?status=running&source=exec&limit=10"
```

## Process Sources

Processes are categorized by source:

- **exec**: Script executions via `execCommand()`
- **orchestration**: Workflow orchestration engine
- **mcp**: MCP adapter processes
- **ai-runtime**: AI agent runtime tasks
- **dev-server**: Development servers (Next.js, Vite, etc.)
- **database**: Database connection pools

## Alert Thresholds

Default thresholds that trigger alerts:

| Metric | Warning | Critical |
|--------|---------|----------|
| Zombies | 3 | 5 |
| Memory | 512MB | 1024MB |
| Active Processes | 50 | 100 |
| DB Waiting | 5 | 10 |
| Spawn Rate | 20/min | 50/min |

## Cleanup Handlers

The monitoring system coordinates cleanup on shutdown:

1. **Priority 100**: Database pools
2. **Priority 95**: Orchestration engine
3. **Priority 90**: MCP adapters
4. **Priority 80**: AI runtime tasks

All handlers execute in priority order with a 30-second timeout.

## Programmatic Usage

### Start Monitoring

```typescript
import { startDevMonitoring } from '@/scripts/lib/monitoring'

startDevMonitoring()
```

### Get Status

```typescript
import { getMonitoringStatus } from '@/scripts/lib/monitoring'

const status = getMonitoringStatus()
console.log(`Running processes: ${status.processes.running}`)
console.log(`Spawn rate: ${status.spawnRate}/min`)
console.log(`Active alerts: ${status.alerts}`)
```

### Display Summary

```typescript
import { displayMonitoringSummary } from '@/scripts/lib/monitoring'

// On exit
process.on('exit', () => {
  displayMonitoringSummary()
})
```

## Troubleshooting

### Zombie Processes Detected

If you see zombie process warnings:

1. Check the parent process (PPID) in the alert
2. The system will attempt automatic cleanup via SIGCHLD
3. If persistent, restart the parent process manually
4. Zombies don't consume resources (CPU/memory), only a PID slot

### High Memory Usage

If memory alerts are triggered:

1. Check the process list for memory-intensive processes
2. Review recent failed processes for memory leaks
3. Consider reducing concurrent processes
4. Check for infinite loops or unclosed resources

### Database Connection Issues

If database waiting alerts appear:

1. Check pool metrics in the dashboard
2. Review active vs idle connections
3. Ensure connections are properly released after use
4. Check for long-running queries

## Development Notes

- Monitoring overhead is < 1% CPU
- Health API response time < 100ms
- Dashboard updates every 5 seconds
- Zombie detection runs every 30 seconds
- Status logging every 5 minutes (can be configured)

## Related Documentation

- [Process Registry](../../../packages/core/src/monitoring/process-registry.ts)
- [Zombie Detector](../../../packages/core/src/monitoring/zombie-detector.ts)
- [Cleanup Manager](../../../packages/core/src/monitoring/cleanup-manager.ts)
- [Health Monitor](../../../packages/core/src/monitoring/health-monitor.ts)
