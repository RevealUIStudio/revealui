# Dashboard Demo

Interactive performance monitoring dashboard demo.

## What is the Dashboard?

The dashboard provides real-time performance monitoring for your monorepo:
- System metrics (CPU, memory usage)
- Telemetry data (script executions, errors)
- Cache performance (hit rates, size)
- Script analytics (duration, failure rates)

## Quick Start

```bash
# Launch interactive dashboard
pnpm dashboard

# Auto-refresh mode (updates every 3 seconds)
pnpm dashboard:watch

# Quick summary view
pnpm dashboard:summary

# Generate HTML report
pnpm dashboard:report
```

## Demo Walkthrough

### Step 1: View Current State

```bash
pnpm dashboard:summary
```

**Expected Output:**
```
📊 Performance Summary
======================

🖥️  System:
   CPU Usage:     15.2%
   Memory Used:   2.1 GB / 16 GB
   Memory Free:   13.9 GB

📈 Telemetry:
   Total Events:  156
   Recent Errors: 0

💾 Cache:
   Hit Rate:      72.5%
   Entries:       45
   Size:          128 MB

⚡ Scripts:
   Executions:    23
   Avg Duration:  3.2s
   Failure Rate:  0.0%
```

### Step 2: Run Some Scripts

Generate telemetry data by running scripts:

```bash
# Build all packages (creates telemetry events)
pnpm build

# Run tests (more telemetry)
pnpm test

# Run type checking
pnpm typecheck:all
```

### Step 3: Watch Live Updates

```bash
pnpm dashboard:watch
```

**What You'll See:**
- Real-time CPU and memory tracking
- Script execution counts incrementing
- Cache hit rates updating
- Error tracking (if any scripts fail)

**Press Ctrl+C to exit**

### Step 4: Generate HTML Report

```bash
pnpm dashboard:report --output=my-report.html
```

**Opens in browser**: Beautiful HTML report with:
- All current metrics
- Top scripts by execution count
- Recent errors (if any)
- Cache performance charts
- System health indicators

**View the report:**
```bash
# On macOS
open my-report.html

# On Linux
xdg-open my-report.html

# On Windows
start my-report.html
```

## Advanced Usage

### Custom Refresh Interval

```bash
# Refresh every 1 second
pnpm dashboard:watch --interval 1

# Refresh every 10 seconds
pnpm dashboard:watch --interval 10
```

### JSON Output

```bash
# Get dashboard data as JSON
pnpm dashboard:summary --json

# Useful for CI/CD integration
```

### Historical Reports

```bash
# Report for last 7 days (default)
pnpm dashboard:report

# Report for last 30 days
pnpm dashboard:report --days 30

# Report for last 24 hours
pnpm dashboard:report --days 1
```

## Use Cases

### Daily Health Check
```bash
# Morning routine: check overnight builds
pnpm dashboard:summary
```

### Performance Regression Detection
```bash
# Before code review, check if PR slowed things down
pnpm dashboard:report --days 7
```

### CI/CD Integration
```bash
# In your CI pipeline
pnpm dashboard:summary --json > metrics.json
# Analyze metrics.json for performance degradation
```

### Team Retrospectives
```bash
# Generate weekly report for team review
pnpm dashboard:report --output "weekly-$(date +%Y-%m-%d).html"
```

## Interpreting the Dashboard

### 🟢 Healthy Indicators
- **CPU Usage**: < 50% (green indicator)
- **Memory**: < 70% used (green indicator)
- **Cache Hit Rate**: > 60% (green indicator)
- **Failure Rate**: 0% (green checkmark)

### 🟡 Warning Signs
- **CPU Usage**: 50-80% (yellow indicator)
- **Memory**: 70-90% used (yellow indicator)
- **Cache Hit Rate**: 30-60% (yellow indicator)
- **Recent Errors**: 1-5 errors (yellow warning)

### 🔴 Critical Issues
- **CPU Usage**: > 80% (red indicator)
- **Memory**: > 90% used (red indicator)
- **Cache Hit Rate**: < 30% (red indicator)
- **Recent Errors**: > 5 errors (red warning)

## Next Steps

- [Profile Performance](./profiling-demo.md) - Identify bottlenecks
- [Explore Scripts](./explorer-demo.md) - Discover available commands
- [Script Management](./script-management-demo.md) - Maintain package scripts

---

**See also**: [Dashboard CLI Reference](../../SCRIPTS.md#performance-dashboard-)
