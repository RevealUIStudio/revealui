# System Maintenance Scripts

Scripts for maintaining system health, applying updates, and monitoring processes.

## Scripts

> **Note:** `verify-system-health.sh` and `apply-ubuntu-updates.sh` referenced below
> are not currently present in `scripts/system/`. The descriptions below document
> the intended behavior if/when those scripts are (re)created.

### 1. System Health Verification (planned)

Intended: check current system state without requiring sudo — Node.js version,
Ubuntu updates, zombie processes, system resources, and project health.

### 2. Ubuntu System Updates (planned)

Intended: apply Ubuntu updates in a safe, staged manner with manual confirmation
at each stage. Requires sudo access.

## Monitoring

### Real-Time Monitoring

Watch system health in real-time:

```bash
pnpm monitor:watch
```

Press Ctrl+C to exit.

### One-Time Check

Quick status check:

```bash
pnpm monitor
```

### During Development

Monitoring is automatically enabled when you run:

```bash
pnpm dev
```

Features:
- Zombie detection (30s interval)
- Status logging (5min interval)
- Exit summary on Ctrl+C

## Zombie Process Handling

### Current Status
✅ No zombie processes currently detected

### If Zombies Appear

The monitoring system will:
1. Detect zombies automatically (30s interval)
2. Log warning with PID and parent PID
3. Attempt automatic cleanup via SIGCHLD
4. Track in history for analysis

### Manual Investigation

If zombies persist:

```bash
# View recent zombies
pnpm monitor

# Check specific process
ps -o ppid= -p <zombie-pid>

# Restart parent process
kill -HUP <parent-pid>
```

### Prevention

The monitoring system now prevents zombies by:
- Proper signal forwarding to child processes
- Wait() calls after child process exits
- Cleanup handlers on SIGTERM/SIGINT
- Timeout with graceful→force escalation

## Integration with Monitoring System

All scripts integrate with the RevealUI monitoring system:

- Process tracking for all spawned processes
- Database pool monitoring
- Cleanup handlers for graceful shutdown
- Alert system for threshold violations

Health dashboard available at `/api/health-monitoring` when dev server is running.

## Troubleshooting

### Zombie process detected

Check the monitoring dashboard or run:

```bash
pnpm monitor
```

Look for the "Recent Zombies" section to see details.

## Related Documentation

- [Process Monitoring](../lib/monitoring/README.md)
- [Development Workflow](../../README.md#development)
- [Health Monitoring API](../../apps/admin/src/app/api/health-monitoring/README.md)
