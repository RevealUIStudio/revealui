# Execution Logging Migration Guide

## Overview

This document describes the execution logging system and how to apply it to scripts.

## What is Execution Logging?

Execution logging tracks script executions in a PGlite database, recording:
- Script name and command
- Start time and end time
- Success/failure status
- Error messages (if any)
- Execution duration

This enables:
- Debugging (see what ran and when)
- Performance monitoring (execution times)
- Error tracking (failure rates)
- Audit trails (who ran what)

## Current Coverage

### ✅ Fully Covered (9 CLIs)

All these CLIs have execution logging enabled:

**Domain CLIs** (5):
- `ops` - Operations and maintenance
- `check` - Quality checks and validation
- `state` - State and workflow management
- `assets` - Asset generation
- `info` - Information and discovery

**Standalone CLIs** (4):
- `dashboard` - Performance monitoring
- `release` - Version management and publishing
- `scripts` - Script explorer
- `skills` - Agent skills management

**Deprecated Wrappers** (20):
All deprecated CLI wrappers inherit logging from the domain CLIs they forward to.

### 📝 Not Covered

**Standalone Scripts** (15+ in `scripts/generate/`):
- These don't use the CLI framework
- Run directly via `tsx script.ts`
- Would need manual logging implementation

## How to Add Execution Logging

### For CLI Classes

#### Before

```typescript
import { BaseCLI } from './_base.js'

class MyCLI extends BaseCLI {
  name = 'mycli'
  description = 'My CLI tool'

  // ... commands
}
```

#### After

```typescript
import { ExecutingCLI } from './_base.js'

class MyCLI extends ExecutingCLI {
  name = 'mycli'
  description = 'My CLI tool'
  protected enableExecutionLogging = true

  // ... commands
}
```

**Changes**:
1. Import `ExecutingCLI` instead of `BaseCLI`
2. Extend `ExecutingCLI` instead of `BaseCLI`
3. Add `protected enableExecutionLogging = true`

### For Standalone Scripts

For scripts that don't use the CLI framework:

```typescript
#!/usr/bin/env tsx
import { getExecutionLogger } from './lib/audit/execution-logger.js'
import { ErrorCode } from './lib/errors.js'

const logger = await getExecutionLogger(process.cwd())

const executionId = await logger.startExecution({
  scriptName: 'my-script',
  command: process.argv[2] || 'default',
  args: process.argv.slice(3),
})

try {
  // Your script logic here
  await doWork()

  await logger.endExecution(executionId, {
    success: true,
  })

  process.exit(ErrorCode.SUCCESS)
} catch (error) {
  await logger.endExecution(executionId, {
    success: false,
    error: error instanceof Error ? error.message : String(error),
  })

  process.exit(ErrorCode.EXECUTION_ERROR)
}
```

## ExecutionLogger API

### Methods

```typescript
// Start tracking an execution
const executionId = await logger.startExecution({
  scriptName: string      // Name of the script
  command?: string        // Command/subcommand being run
  args?: string[]        // Arguments passed to script
})

// End tracking an execution
await logger.endExecution(executionId, {
  success: boolean       // Whether execution succeeded
  error?: string        // Error message if failed
})

// Query execution history
const executions = await logger.getRecentExecutions(limit?: number)
const scriptStats = await logger.getScriptStats(scriptName: string)
```

### Database Schema

Executions are stored in PGlite with this structure:

```typescript
interface Execution {
  id: string              // UUID
  scriptName: string      // Name of script
  command: string | null  // Command run
  args: string[] | null   // Arguments
  startTime: Date        // When started
  endTime: Date | null   // When ended (null if running)
  success: boolean | null // Success status
  error: string | null   // Error message
  duration: number | null // Duration in ms
}
```

## Benefits

### 1. Debugging
See execution history to debug issues:
```typescript
const recent = await logger.getRecentExecutions(10)
// Shows last 10 script runs with timing and errors
```

### 2. Performance Monitoring
Track slow scripts:
```typescript
const stats = await logger.getScriptStats('generate-types')
// Shows avg duration, success rate, etc.
```

### 3. Error Tracking
Find failing scripts:
```typescript
const failed = await logger.getRecentExecutions()
  .then(e => e.filter(x => !x.success))
// Shows all recent failures
```

### 4. Audit Trails
See what ran and when for compliance/security.

## Migration Strategy

### Phase 1: Core CLIs ✅ COMPLETE
- 5 domain CLIs
- 4 standalone CLIs
- All deprecated wrappers (inherit from domain CLIs)

### Phase 2: High-Priority Standalone Scripts (Optional)
Scripts run frequently or critical to operations:
- `scripts/generate/generate-types.ts`
- `scripts/setup/seed-sample-content.ts`
- `scripts/setup/reset-database.ts`

### Phase 3: Remaining Scripts (As Needed)
Add logging to other standalone scripts as they're updated or when debugging is needed.

## Testing Execution Logging

Verify logging works:

```bash
# Run a CLI with logging
pnpm ops fix-imports --dry-run

# Check PGlite database (if you have DB access tools)
# Or add this to a script:
const logger = await getExecutionLogger(process.cwd())
const recent = await logger.getRecentExecutions(5)
console.log(recent)
```

## Troubleshooting

### Logging Not Working

**Check 1**: Is `enableExecutionLogging` set to `true`?
```typescript
protected enableExecutionLogging = true
```

**Check 2**: Is the class extending `ExecutingCLI`?
```typescript
class MyCLI extends ExecutingCLI {
```

**Check 3**: Is PGlite initialized?
The execution logger uses PGlite for storage. If PGlite isn't available, logging will fail silently.

### Performance Impact

Execution logging is async and non-blocking:
- ~5-10ms overhead per script execution
- PGlite operations are fast (in-memory)
- Negligible impact on script performance

### Storage

Executions are stored in PGlite (in-memory database with optional persistence):
- Location: `.revealui/execution-log.db` (if persistence enabled)
- Retention: No automatic cleanup (implement as needed)
- Size: ~200 bytes per execution

## Future Enhancements

1. **Automatic Cleanup**: Purge old executions (>30 days)
2. **Dashboard Integration**: View execution history in dashboard CLI
3. **Alerts**: Notify on repeated failures
4. **Metrics Export**: Export to monitoring systems (Prometheus, etc.)
5. **Query Interface**: CLI command to query execution history

## Related Files

- **Base Class**: `scripts/cli/_base.ts`
- **Execution Logger**: `scripts/lib/audit/execution-logger.ts`
- **Error Codes**: `scripts/lib/errors.ts`

---

**Status**: ✅ 9 CLIs covered (100% of CLI framework)
**Date**: 2026-02-03
**Coverage**: All domain + standalone CLIs
**Standalone Scripts**: 0 of ~15 (manual migration as needed)
