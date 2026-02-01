# Final System Verification Checklist

Comprehensive verification checklist for the system health monitoring implementation.

## Pre-Verification

### System State

- [ ] Run system health check: `./scripts/system/verify-system-health.sh`
- [ ] Verify Node.js version: `node --version` (should be v24.13.0)
- [ ] Verify pnpm version: `pnpm --version`
- [ ] Check for zombie processes: `ps aux | grep -E ' (Z|z) '`
- [ ] Check available disk space: `df -h /` (should have > 20% free)
- [ ] Check memory usage: `free -h` (should have > 1GB free)

### Dependencies

- [ ] Install dependencies: `pnpm install --frozen-lockfile`
- [ ] Run type checking: `pnpm typecheck:all`
- [ ] Run linting: `pnpm lint`
- [ ] Run tests: `pnpm test`

## Phase 1: Foundation Verification

### Process Registry

- [ ] Process registration works
  ```bash
  # Start dev, spawn a process, check it's tracked
  pnpm dev &
  sleep 5
  pnpm monitor
  # Should see dev-server processes
  ```

- [ ] Process status updates correctly
  ```bash
  # Check completed/failed processes
  pnpm monitor | grep -A 10 "PROCESSES"
  ```

- [ ] Process metadata tracking works
  ```bash
  # Spawn process with metadata, verify it's captured
  # (automated in integration tests)
  ```

### Zombie Detection

- [ ] Zombie detector starts automatically
  ```bash
  pnpm dev
  # Should see: "Zombie detection running (30s interval)"
  ```

- [ ] Zombie detection scans work
  ```bash
  # Create test zombie
  bash /tmp/test-zombie.sh
  # Wait 30s, check monitoring
  pnpm monitor:watch
  # Should detect zombie
  ```

- [ ] Zombie cleanup attempts work
  ```bash
  # After detection, verify cleanup attempted
  # Check logs for "Attempting zombie cleanup"
  ```

### Cleanup Manager

- [ ] Cleanup handlers register
  ```bash
  # Start dev and check handlers
  pnpm dev &
  sleep 5
  # (handlers are internal, verified via graceful shutdown)
  ```

- [ ] Graceful shutdown works
  ```bash
  pnpm dev &
  sleep 10
  # Press Ctrl+C
  # Should see: "Starting graceful shutdown"
  # Should see: "Development Session Summary"
  ```

- [ ] Cleanup timeout works
  ```bash
  # (automatic - handlers have 30s timeout)
  ```

## Phase 2: Integration Verification

### exec.ts Monitoring

- [ ] Processes tracked on spawn
  ```bash
  # Run command, check tracking
  pnpm monitor | grep "exec"
  # Should see exec processes
  ```

- [ ] Status updated on completion
  ```bash
  # (automated in integration tests)
  ```

- [ ] Status updated on failure
  ```bash
  # (automated in integration tests)
  ```

- [ ] Signal forwarding works
  ```bash
  # Ctrl+C should propagate to children
  pnpm dev &
  sleep 5
  # Ctrl+C - all processes should stop cleanly
  ```

- [ ] Graceful timeout works
  ```bash
  # (automated - SIGTERM → 5s → SIGKILL)
  ```

### Database Pool Tracking

- [ ] Pools tracked after creation
  ```bash
  pnpm dev &
  sleep 10
  pnpm monitor | grep -A 5 "DATABASE POOLS"
  # Should see pool metrics
  ```

- [ ] Pool metrics accurate
  ```bash
  curl http://localhost:3000/api/health-monitoring | jq '.database'
  # Verify totalCount, idleCount, waitingCount
  ```

- [ ] Pools close on shutdown
  ```bash
  pnpm dev &
  sleep 10
  # Ctrl+C
  # Should see: "Close all database connection pools" in logs
  ```

### MCP Adapter Cleanup

- [ ] Adapters register on creation
  ```bash
  # (automatic via constructor)
  ```

- [ ] Adapters dispose on shutdown
  ```bash
  # (automatic via cleanup handler)
  ```

### AI Runtime Cleanup

- [ ] Tasks cancel on shutdown
  ```bash
  # (automatic if AI runtime is active)
  ```

- [ ] Queue clears properly
  ```bash
  # (verified via unit tests)
  ```

### Orchestration Engine Cleanup

- [ ] Engine closes on shutdown
  ```bash
  # (automatic via cleanup handler)
  ```

- [ ] Workflow tracked as process
  ```bash
  # (automatic when workflow starts)
  ```

## Phase 3: Monitoring API Verification

### Health Monitor

- [ ] Metrics collection works
  ```bash
  curl http://localhost:3000/api/health-monitoring | jq
  # Should return valid JSON with all metrics
  ```

- [ ] System metrics accurate
  ```bash
  curl http://localhost:3000/api/health-monitoring | jq '.system'
  # Verify memoryUsage, cpuUsage, uptime
  ```

- [ ] Process metrics accurate
  ```bash
  curl http://localhost:3000/api/health-monitoring | jq '.processes'
  # Verify active, zombies, failed, spawnRate
  ```

- [ ] Database metrics accurate
  ```bash
  curl http://localhost:3000/api/health-monitoring | jq '.database'
  # Verify rest and vector pools
  ```

### Health Monitoring API

- [ ] Returns 200 when healthy
  ```bash
  curl -I http://localhost:3000/api/health-monitoring
  # Should see: HTTP/1.1 200 OK
  ```

- [ ] Returns 206 with warnings
  ```bash
  # Create warning condition, check status code
  # (manual test or wait for natural warning)
  ```

- [ ] Returns 503 with critical alerts
  ```bash
  # Create critical condition, check status code
  # (manual test or wait for critical alert)
  ```

### Process List API

- [ ] Returns process list
  ```bash
  curl http://localhost:3000/api/health-monitoring/processes | jq '.processes | length'
  # Should return > 0
  ```

- [ ] Filtering by status works
  ```bash
  curl "http://localhost:3000/api/health-monitoring/processes?status=running" | jq '.processes[0].status'
  # Should return: "running"
  ```

- [ ] Filtering by source works
  ```bash
  curl "http://localhost:3000/api/health-monitoring/processes?source=exec" | jq '.processes[0].source'
  # Should return: "exec"
  ```

- [ ] Sorting works
  ```bash
  curl "http://localhost:3000/api/health-monitoring/processes?sort=pid&order=asc" | jq '.processes[0:2] | .[0].pid < .[1].pid'
  # Should return: true
  ```

- [ ] Limit works
  ```bash
  curl "http://localhost:3000/api/health-monitoring/processes?limit=5" | jq '.processes | length'
  # Should return: 5 (or less if fewer processes)
  ```

### Alert System

- [ ] Alerts trigger at thresholds
  ```bash
  # Checked automatically by monitoring system
  ```

- [ ] Alerts log to console
  ```bash
  # Check console output during pnpm dev
  ```

- [ ] Alerts log to logger
  ```bash
  # Check log files or console
  ```

- [ ] Alerts aggregated in production
  ```bash
  # Set NODE_ENV=production and verify
  # (manual test)
  ```

## Phase 4: Dashboard UI Verification

### SystemHealthPanel Component

- [ ] Panel loads without errors
  ```bash
  # Open http://localhost:3000
  # Click "System Health" tab
  # Should load without console errors
  ```

- [ ] System metrics display
  - [ ] Memory usage shown
  - [ ] CPU usage shown
  - [ ] Uptime shown
  - [ ] Process count shown

- [ ] Process statistics display
  - [ ] Active processes count
  - [ ] Zombies count
  - [ ] Failed count
  - [ ] Spawn rate
  - [ ] By source breakdown

- [ ] Database pools display
  - [ ] Pool names shown
  - [ ] Active/total connections shown
  - [ ] Waiting count shown

- [ ] Alerts display
  - [ ] Alert count badge
  - [ ] Alert messages
  - [ ] Alert levels (warning/critical)
  - [ ] Alert timestamps

- [ ] Process list displays
  - [ ] PID, command, source, status columns
  - [ ] Recent processes (default 50)

- [ ] Filtering works
  - [ ] Source filter dropdown
  - [ ] Status filter dropdown
  - [ ] Filtered results update

- [ ] Real-time updates work
  - [ ] Metrics update every 5s
  - [ ] Process list updates every 5s
  - [ ] No visible lag or errors

- [ ] Recent zombies display
  - [ ] Shows when zombies exist
  - [ ] Hides when no zombies
  - [ ] Shows PID, command, timestamp

### Dashboard Integration

- [ ] Tab switching works
  - [ ] Can switch between "Data & Analytics" and "System Health"
  - [ ] Tab state persists
  - [ ] No content flash

- [ ] Panel resizing works
  - [ ] Can resize dashboard panels
  - [ ] Content adapts to size

- [ ] No console errors
  - [ ] Check browser console for errors
  - [ ] Check browser console for warnings

## Phase 5: Dev Workflow Verification

### Monitor Command

- [ ] `pnpm monitor` works
  ```bash
  pnpm monitor
  # Should display formatted status
  ```

- [ ] `pnpm monitor:watch` works
  ```bash
  pnpm monitor:watch
  # Should update every 5s
  # Ctrl+C to exit
  ```

- [ ] Status display accurate
  - [ ] System section
  - [ ] Processes section
  - [ ] By source section
  - [ ] Database pools section
  - [ ] Alerts section
  - [ ] Recent processes section

### Dev Server Integration

- [ ] Monitoring starts on `pnpm dev`
  ```bash
  pnpm dev
  # Should see: "Process monitoring enabled"
  # Should see: "Zombie detection running"
  ```

- [ ] Periodic logging works
  ```bash
  # Wait 5 minutes during pnpm dev
  # Should see periodic status logs
  ```

- [ ] Exit summary displays
  ```bash
  pnpm dev &
  sleep 30
  # Ctrl+C
  # Should see: "Development Session Summary"
  ```

## Phase 6: System Fixes Verification

### Ubuntu Updates

- [ ] Update script exists
  ```bash
  ls -l scripts/system/apply-ubuntu-updates.sh
  ```

- [ ] Script is executable
  ```bash
  test -x scripts/system/apply-ubuntu-updates.sh && echo "OK"
  ```

- [ ] Documentation available
  ```bash
  cat scripts/system/README.md
  ```

### Zombie Process

- [ ] No zombies currently
  ```bash
  ps aux | grep -E ' (Z|z) ' | wc -l
  # Should return: 0
  ```

- [ ] Monitoring detects zombies
  - [ ] Create test zombie
  - [ ] Wait 30s
  - [ ] Check monitoring detected it
  - [ ] Verify cleanup attempted

- [ ] Prevention measures in place
  - [ ] Signal forwarding in exec.ts
  - [ ] Cleanup handlers registered
  - [ ] Graceful shutdown works

## Load Testing (24-Hour Test)

### Setup

```bash
# Start dev server
pnpm dev > dev-output.log 2>&1 &
DEV_PID=$!

# Start monitoring
pnpm monitor:watch > monitor-output.log 2>&1 &
MONITOR_PID=$!

# Record start time
echo "Load test started at: $(date)" > load-test.log
```

### During Test (Check Every 4 Hours)

- [ ] Hour 0: Initial state recorded
- [ ] Hour 4: Check memory, zombies, alerts
- [ ] Hour 8: Check memory, zombies, alerts
- [ ] Hour 12: Check memory, zombies, alerts
- [ ] Hour 16: Check memory, zombies, alerts
- [ ] Hour 20: Check memory, zombies, alerts
- [ ] Hour 24: Final check

Commands for each check:

```bash
# Memory usage
free -h >> load-test.log

# Zombie count
ps aux | grep -E ' (Z|z) ' | wc -l >> load-test.log

# Active alerts
curl -s http://localhost:3000/api/health-monitoring | jq '.alerts | length' >> load-test.log

# Process count
curl -s http://localhost:3000/api/health-monitoring | jq '.processes.active' >> load-test.log

# Timestamp
echo "Check at: $(date)" >> load-test.log
echo "---" >> load-test.log
```

### After 24 Hours

```bash
# Stop processes
kill $DEV_PID
kill $MONITOR_PID

# Analyze results
cat load-test.log

# Check for memory leaks
# Memory should not have increased significantly

# Check for accumulated zombies
# Should be 0 or minimal

# Check for repeated alerts
# Should not have critical alerts
```

### Verification Criteria

- [ ] Memory usage stable (< 10% increase over 24h)
- [ ] No zombie accumulation (< 3 total zombies)
- [ ] No critical alerts
- [ ] Process count reasonable (< 100 active)
- [ ] No crashes or restarts
- [ ] Health API responsive (< 100ms)
- [ ] Dashboard loads (< 500ms)

## Final Sign-Off

### All Systems Operational

- [ ] Foundation complete
- [ ] Integration complete
- [ ] Monitoring API complete
- [ ] Dashboard UI complete
- [ ] Dev workflow complete
- [ ] System fixes complete
- [ ] 24-hour load test passed

### Documentation Complete

- [ ] Monitoring README
- [ ] System maintenance README
- [ ] Zombie prevention guide
- [ ] Verification checklist
- [ ] API documentation

### Performance Verified

- [ ] Monitoring overhead < 1% CPU
- [ ] Health API < 100ms
- [ ] Dashboard < 500ms
- [ ] No memory leaks
- [ ] No zombie accumulation

## Sign-Off

Date: __________________

Verified by: __________________

Issues found: __________________

Notes: __________________
