# Zombie Process Prevention & Resolution

## Current Status

✅ **No zombie processes detected** (as of latest verification)

The previously reported zombie process (epmd PID 85328, child of Electric Sync beam.smp PID 85235) has been resolved.

## What Are Zombie Processes?

Zombie processes are defunct processes that have completed execution but still have entries in the process table. They occur when:

1. A child process exits
2. The parent process doesn't call `wait()` to read the exit status
3. The process remains in a "zombie" state until the parent reads its status

**Important**: Zombies don't consume CPU or memory - only a PID slot. They're more of a symptom of poor process management than a resource issue.

## Prevention Measures Implemented

The RevealUI monitoring system now includes comprehensive zombie prevention:

### 1. Automatic Detection (30-second interval)

```bash
# Runs automatically during pnpm dev
# Also available via:
pnpm monitor:watch
```

Scans for defunct processes every 30 seconds and:
- Logs warnings with PID, parent PID, and command
- Tracks zombie history
- Attempts automatic cleanup

### 2. Proper Signal Forwarding

All processes spawned via `execCommand()` now:
- Forward SIGTERM/SIGINT to child processes
- Remove signal handlers on child exit
- Properly wait for child processes to prevent zombies

**Implementation**: See `scripts/lib/exec.ts:145-156`

### 3. Graceful Shutdown with Timeout

Enhanced timeout handling:
- Send SIGTERM first (graceful, 5s wait)
- Send SIGKILL if still running (force)
- Always wait for child to reap zombie

**Implementation**: See `scripts/lib/exec.ts:79-95`

### 4. Cleanup Handlers

All resource managers register cleanup handlers:
- Database pools (priority 100)
- Orchestration engine (priority 95)
- MCP adapters (priority 90)
- AI runtime (priority 80)

### 5. Automatic Cleanup Attempts

When a zombie is detected, the system:
1. Identifies the parent process (PPID)
2. Sends SIGCHLD to the parent
3. Waits 1 second
4. Verifies if zombie was reaped
5. Logs results

**Implementation**: See `packages/core/src/monitoring/zombie-detector.ts:96-134`

## How to Handle Zombies

### Detection

Check for zombies:

```bash
# Real-time monitoring
pnpm monitor:watch

# One-time check
pnpm monitor

# Manual check
ps aux | grep -E ' (Z|z) '
```

### Investigation

If a zombie is detected:

```bash
# Get zombie details
ps -o pid,ppid,comm,state -p <zombie-pid>

# Check parent process
ps -o pid,comm,cmd -p <parent-pid>

# View monitoring history
pnpm monitor
# Look for "Recent Zombies" section
```

### Resolution

#### Automatic (Recommended)

The monitoring system will attempt cleanup automatically:

1. Detects zombie via 30s scan
2. Sends SIGCHLD to parent
3. Logs success/failure
4. Tracks in history

#### Manual (If Automatic Fails)

If automatic cleanup doesn't work:

```bash
# Option 1: Restart parent process
kill -HUP <parent-pid>

# Option 2: Force kill parent (last resort)
kill -9 <parent-pid>

# Verify zombie is gone
ps aux | grep -E ' (Z|z) '
```

**Note**: Killing the parent will cause the zombie to be adopted by init (PID 1), which will reap it immediately.

### Prevention for Electric Sync / Erlang Processes

The previous zombie was from Electric Sync (epmd - Erlang Port Mapper Daemon). To prevent recurrence:

#### Option 1: Upgrade Electric Sync

Check for updates:

```bash
pnpm outdated | grep electric
```

Update if available:

```bash
pnpm update @electric-sql/pglite
```

#### Option 2: Proper Shutdown Sequence

Ensure Electric Sync is properly shut down:

```typescript
// In cleanup handler
await electricSync.shutdown({ graceful: true, timeout: 5000 })
```

#### Option 3: Monitor epmd Specifically

Add specific monitoring for epmd:

```bash
# Watch for epmd processes
watch -n 5 'ps aux | grep epmd'
```

## Monitoring Integration

### During Development

```bash
pnpm dev
```

Automatically enables:
- Zombie detection (30s interval)
- Process tracking
- Cleanup handlers
- Exit summary

### Dashboard

View real-time zombie status:

1. Start dev server: `pnpm dev`
2. Open dashboard: http://localhost:3000
3. Click "System Health" tab
4. Check "Recent Zombie Processes" section

### API Access

```bash
# Get current health metrics (includes zombies)
curl http://localhost:3000/api/health-monitoring | jq '.recentZombies'

# Get all processes
curl http://localhost:3000/api/health-monitoring/processes | jq
```

## Alert Thresholds

Zombies trigger alerts at:

| Level | Threshold | Action |
|-------|-----------|--------|
| Warning | 3 zombies | Log warning |
| Critical | 5 zombies | Log error + Sentry alert (production) |

Configure thresholds in `packages/core/src/monitoring/types.ts:191-196`

## Testing Zombie Detection

To test the monitoring system:

### Create a Test Zombie (Development Only)

```bash
# Create a script that spawns a child and doesn't wait
cat > /tmp/test-zombie.sh << 'EOF'
#!/bin/bash
sleep 1 &
# Exit without waiting - creates zombie
EOF

chmod +x /tmp/test-zombie.sh
/tmp/test-zombie.sh

# Check for zombie
ps aux | grep -E ' (Z|z) '

# Watch monitoring system detect it
pnpm monitor:watch
```

### Verify Cleanup

The monitoring system should:
1. Detect the zombie within 30 seconds
2. Log a warning with PID and PPID
3. Attempt cleanup via SIGCHLD
4. Show in "Recent Zombies" list

## Troubleshooting

### Zombies persist after cleanup attempts

If zombies persist after automatic cleanup:

1. **Check parent process health**
   ```bash
   ps -o pid,comm,state -p <parent-pid>
   ```

2. **Restart parent if hung**
   ```bash
   kill -HUP <parent-pid>
   ```

3. **Force kill as last resort**
   ```bash
   kill -9 <parent-pid>
   ```

### Many zombies accumulating

If zombies accumulate rapidly:

1. **Find the source**
   ```bash
   pnpm monitor
   # Check "By Source" section
   ```

2. **Review process spawning**
   - Check for missing `wait()` calls
   - Verify cleanup handlers are registered
   - Look for process leaks

3. **Check for Electric Sync issues**
   ```bash
   # View Electric Sync logs
   journalctl -u electric-sync --since "1 hour ago"
   ```

### Zombie from unknown source

If monitoring doesn't identify the source:

1. **Check parent process**
   ```bash
   ps -o ppid,comm,cmd -p <zombie-pid>
   ```

2. **Trace process tree**
   ```bash
   pstree -p <parent-pid>
   ```

3. **Add manual tracking**
   ```typescript
   import { registerProcess } from '@revealui/core/monitoring'

   // When spawning process
   registerProcess(pid, command, args, 'custom-source', {
     description: 'Your process description'
   })
   ```

## Related Files

- **Zombie Detector**: `packages/core/src/monitoring/zombie-detector.ts`
- **Process Registry**: `packages/core/src/monitoring/process-registry.ts`
- **Cleanup Manager**: `packages/core/src/monitoring/cleanup-manager.ts`
- **Exec Monitoring**: `scripts/lib/exec.ts`

## References

- [Linux Zombie Processes](https://en.wikipedia.org/wiki/Zombie_process)
- [Process States](https://man7.org/linux/man-pages/man1/ps.1.html)
- [Signal Handling](https://man7.org/linux/man-pages/man7/signal.7.html)
- [Electric Sync Documentation](https://electric-sql.com/)
