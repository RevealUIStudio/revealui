# System Maintenance Scripts

Scripts for maintaining system health, applying updates, and monitoring processes.

## Scripts

### 1. System Health Verification

Check current system state without requiring sudo:

```bash
./scripts/system/verify-system-health.sh
```

**Checks:**
- Node.js version
- Available Ubuntu updates
- Zombie processes
- System resources (memory, disk)
- Project health (dependencies, env files)

**Output:**
- ✓ Green: Everything OK
- ⚠️ Yellow: Action recommended
- 🔴 Red: Action required

### 2. Ubuntu System Updates

Apply Ubuntu updates in a safe, staged manner:

```bash
./scripts/system/apply-ubuntu-updates.sh
```

**Requires:** sudo access

**Stages:**
1. **System Libraries** - libc, linux-libc-dev, locales
2. **Ubuntu Metapackages** - ubuntu-minimal, ubuntu-server, ubuntu-standard, ubuntu-wsl
3. **Services** - snapd
4. **Node.js** - if update available

Each stage includes verification and requires manual confirmation before proceeding.

**Safety Features:**
- Staged approach (can abort between stages)
- Verification after each stage
- Manual confirmation required
- Exits on any error
- Final type check to ensure compatibility

## Current Status

Based on latest verification:

- ✅ **Node.js**: v24.13.0 (up to date)
- ✅ **Zombie Processes**: None detected
- ✅ **Project Health**: Good (dependencies installed, env configured)
- ⚠️ **Ubuntu Updates**: 12 updates available

## Applying Updates

### Prerequisites

1. Ensure you have sudo access:
   ```bash
   sudo -v
   ```

2. Verify current state:
   ```bash
   ./scripts/system/verify-system-health.sh
   ```

3. Stop all running processes:
   ```bash
   # Stop dev servers if running
   pkill -f "pnpm dev"
   pkill -f "turbo"
   ```

### Update Process

1. Run the update script:
   ```bash
   ./scripts/system/apply-ubuntu-updates.sh
   ```

2. Review updates at each stage and press Enter to confirm

3. After all stages complete, verify:
   ```bash
   ./scripts/system/verify-system-health.sh
   ```

4. Test the project:
   ```bash
   cd ~/projects/RevealUI
   pnpm install --frozen-lockfile
   pnpm typecheck:all
   pnpm dev
   ```

### If Updates Fail

If updates fail at any stage:

1. The script will exit immediately (set -e)
2. Check the error message
3. Fix the issue manually
4. Re-run the script (it will skip completed stages if packages are already updated)

Common issues:
- **Package conflicts**: Run `sudo apt --fix-broken install`
- **Disk space**: Check with `df -h` and free up space
- **Lock files**: Kill other apt processes or wait for them to complete

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

### "12 updates available" persists

This is expected! The updates require sudo access. Run:

```bash
./scripts/system/apply-ubuntu-updates.sh
```

### Zombie process detected

Check the monitoring dashboard or run:

```bash
pnpm monitor
```

Look for the "Recent Zombies" section to see details.

### "Permission denied" on scripts

Make scripts executable:

```bash
chmod +x scripts/system/*.sh
```

### Updates break the project

Revert to previous state:

```bash
# Reinstall dependencies
pnpm clean:install

# Rebuild everything
pnpm build

# Type check
pnpm typecheck:all
```

If Node.js version changed, consider using nvm/fnm to switch back.

## Related Documentation

- [Process Monitoring](../lib/monitoring/README.md)
- [Development Workflow](../../README.md#development)
- [Health Monitoring API](../../apps/admin/src/app/api/health-monitoring/README.md)
