# EnhancedCLI Migration Guide

This guide explains how to upgrade existing scripts from `BaseCLI` to `EnhancedCLI` to gain automatic validation, snapshots, logging, and dry-run capabilities.

## Overview

`EnhancedCLI` extends `BaseCLI` with integrated features while maintaining 100% backward compatibility. Scripts opt-in by changing their base class.

### Features Provided

- ✅ **Pre-execution validation** - Check environment, dependencies, disk space, etc.
- ✅ **Automatic snapshots** - Create restore points before operations
- ✅ **Execution logging** - Track all executions in PGlite database
- ✅ **Dry-run mode** - Preview changes without executing
- ✅ **Impact analysis** - Assess risk and complexity
- ✅ **Auto-rollback** - Automatic rollback on failure (optional)

## Quick Start

### Step 1: Change Base Class

**Before:**
```typescript
import { BaseCLI, runCLI } from './_base.js'

class MyScript extends BaseCLI {
  // ...
}

runCLI(MyScript)
```

**After:**
```typescript
import { EnhancedCLI, runEnhancedCLI } from './_base-enhanced.js'

class MyScript extends EnhancedCLI {
  // ...
}

runEnhancedCLI(MyScript)
```

That's it! Your script now has execution logging enabled by default.

### Step 2: Enable Additional Features

Add feature flags to your class:

```typescript
class MyScript extends EnhancedCLI {
  name = 'my-script'
  description = 'My enhanced script'

  // Enable features
  protected enableValidation = true      // Pre-execution validation
  protected enableSnapshots = true       // Automatic snapshots
  protected enableLogging = true         // Execution logging (default)
  protected enableDryRun = true          // Dry-run mode support
  protected enableImpactAnalysis = true  // Show impact analysis
  protected autoRollbackOnFailure = false // Auto-rollback on error

  // Configure validation
  protected validationOptions = {
    checks: ['env', 'git', 'disk'],
    requiredEnvVars: ['DATABASE_URL'],
    minDiskSpace: 1024 * 1024 * 1024, // 1GB
  }

  // Rest of your script...
}
```

### Step 3: Use Dry-Run Support

Replace direct file/database operations with dry-run wrappers:

**Before:**
```typescript
import { writeFile, mkdir } from 'node:fs/promises'

async runOperation() {
  await mkdir('output', { recursive: true })
  await writeFile('output/file.txt', 'content')
}
```

**After:**
```typescript
async runOperation() {
  await this.dryRun.fs.mkdir('output', true)
  await this.dryRun.fs.writeFile('output/file.txt', 'content')

  // In dry-run mode: operations recorded but not executed
  // In normal mode: operations executed as usual
}
```

## Feature Details

### 1. Pre-Execution Validation

Validates environment before script execution:

```typescript
protected enableValidation = true

protected validationOptions = {
  checks: ['env', 'dependencies', 'database', 'git', 'disk', 'permissions'],
  requiredEnvVars: ['DATABASE_URL', 'API_KEY'],
  optionalEnvVars: ['DEBUG'],
  minDiskSpace: 1024 * 1024 * 100, // 100MB
  requiredPaths: ['config.json', 'data/'],
  writablePaths: ['output/', 'logs/'],
  requireCleanGit: true,
  minNodeVersion: '18.0.0',
}
```

**Available Checks:**
- `env` - Environment variables
- `dependencies` - npm packages installed
- `database` - Database connectivity
- `git` - Git repository status
- `disk` - Available disk space
- `permissions` - File permissions
- `network` - Network connectivity
- `node-version` - Node.js version

### 2. Automatic Snapshots

Creates restore points before operations:

```typescript
protected enableSnapshots = true
```

**Features:**
- Automatic snapshot creation before execution
- Includes files, configuration, and database (optional)
- Rollback capability if something goes wrong
- Manual snapshot creation available

**Manual snapshots:**
```typescript
const snapshotId = await this.createManualSnapshot('before-risky-operation')
// ... perform operation ...
if (failed) {
  await this.restoreFromSnapshot(snapshotId)
}
```

**Disable for specific execution:**
```bash
pnpm my-script run --no-snapshot
```

### 3. Execution Logging

Tracks all script executions in PGlite database:

```typescript
protected enableLogging = true // Enabled by default
```

**Logged Information:**
- Script name and command
- Arguments and flags
- Start/end timestamps
- Duration
- Success/failure status
- Error messages
- User and hostname
- Git commit/branch
- Environment (dev/prod/CI)

**Query history:**
```bash
pnpm scripts:history my-script
pnpm scripts:history --failed
```

### 4. Dry-Run Mode

Preview changes without executing:

```typescript
protected enableDryRun = true
```

**Usage:**
```bash
pnpm my-script run --dry-run
```

**Supported Operations:**
```typescript
// File operations
await this.dryRun.fs.writeFile(path, content)
await this.dryRun.fs.deleteFile(path)
await this.dryRun.fs.mkdir(path, recursive)
await this.dryRun.fs.rmdir(path, recursive)

// Database operations
await this.dryRun.db.query(sql, params)

// External commands
await this.dryRun.exec(command)
```

**Check if dry-run:**
```typescript
if (this.isDryRun()) {
  // Preview mode
} else {
  // Actual execution
}
```

### 5. Impact Analysis

Shows risk assessment and recommendations:

```typescript
protected enableImpactAnalysis = true
```

**Displays:**
- Total changes by type
- Overall impact level (low/medium/high/critical)
- Identified risks and mitigations
- Rollback complexity
- Estimated duration
- Affected resources

### 6. Auto-Rollback

Automatically rollback on failure:

```typescript
protected autoRollbackOnFailure = true
```

**Behavior:**
- Creates snapshot before execution
- On error, restores from snapshot
- Only works when `enableSnapshots = true`

**Use cases:**
- Database migrations
- Configuration changes
- Risky operations

## Migration Examples

### Example 1: Simple Script

**Before (BaseCLI):**
```typescript
import { BaseCLI, runCLI } from './_base.js'
import { writeFile } from 'node:fs/promises'

class ExportData extends BaseCLI {
  name = 'export-data'
  description = 'Export data to JSON'

  defineCommands() {
    return [{
      name: 'run',
      description: 'Run export',
      handler: async () => this.runExport(),
    }]
  }

  async runExport() {
    const data = await fetchData()
    await writeFile('output.json', JSON.stringify(data))
    return this.output.success({ exported: data.length })
  }
}

runCLI(ExportData)
```

**After (EnhancedCLI):**
```typescript
import { EnhancedCLI, runEnhancedCLI } from './_base-enhanced.js'

class ExportData extends EnhancedCLI {
  name = 'export-data'
  description = 'Export data to JSON'

  // Enable features
  protected enableValidation = true
  protected enableLogging = true
  protected enableDryRun = true

  defineCommands() {
    return [{
      name: 'run',
      description: 'Run export',
      handler: async () => this.runExport(),
    }]
  }

  async runExport() {
    const data = await fetchData()

    // Use dry-run wrapper
    await this.dryRun.fs.writeFile(
      'output.json',
      JSON.stringify(data, null, 2)
    )

    return this.output.success({ exported: data.length })
  }
}

runEnhancedCLI(ExportData)
```

**New capabilities:**
- `--dry-run` flag to preview
- Automatic execution logging
- Pre-execution validation
- Try it: `pnpm export-data run --dry-run`

### Example 2: Database Migration

**Before:**
```typescript
class MigrateCLI extends BaseCLI {
  async migrate() {
    await db.query('ALTER TABLE users ADD COLUMN email TEXT')
    return this.output.success({ migrated: true })
  }
}
```

**After:**
```typescript
class MigrateCLI extends EnhancedCLI {
  protected enableSnapshots = true
  protected enableDryRun = true
  protected autoRollbackOnFailure = true

  protected validationOptions = {
    checks: ['database', 'git'],
    requireCleanGit: true,
  }

  async migrate() {
    // Snapshot created automatically
    await this.dryRun.db.query('ALTER TABLE users ADD COLUMN email TEXT')
    // Auto-rollback on failure
    return this.output.success({ migrated: true })
  }
}
```

**New capabilities:**
- Automatic snapshot before migration
- Auto-rollback if migration fails
- Dry-run to preview changes
- Git cleanliness check

### Example 3: File Cleanup

**Before:**
```typescript
class CleanupCLI extends BaseCLI {
  async cleanup() {
    await unlink('temp1.txt')
    await unlink('temp2.txt')
    return this.output.success({ deleted: 2 })
  }
}
```

**After:**
```typescript
class CleanupCLI extends EnhancedCLI {
  protected enableDryRun = true
  protected enableImpactAnalysis = true

  async cleanup() {
    await this.dryRun.fs.deleteFile('temp1.txt')
    await this.dryRun.fs.deleteFile('temp2.txt')

    if (this.isDryRun()) {
      // Impact analysis shown automatically
      return this.output.success({
        message: 'Preview mode - no files deleted'
      })
    }

    return this.output.success({ deleted: 2 })
  }
}
```

**New capabilities:**
- Preview deletions with `--dry-run`
- See impact analysis before confirming
- Interactive confirmation

## Best Practices

### 1. Start with Logging Only

For low-risk scripts, just enable logging:

```typescript
class MyScript extends EnhancedCLI {
  protected enableLogging = true
  // That's it!
}
```

### 2. Add Validation for Critical Scripts

For production scripts, add validation:

```typescript
class MyScript extends EnhancedCLI {
  protected enableLogging = true
  protected enableValidation = true

  protected validationOptions = {
    checks: ['env', 'dependencies'],
    requiredEnvVars: ['DATABASE_URL', 'API_KEY'],
  }
}
```

### 3. Use Snapshots for Risky Operations

For operations that modify data:

```typescript
class MyScript extends EnhancedCLI {
  protected enableLogging = true
  protected enableValidation = true
  protected enableSnapshots = true
}
```

### 4. Full Suite for Production Operations

For production database migrations, deployments:

```typescript
class MyScript extends EnhancedCLI {
  protected enableValidation = true
  protected enableSnapshots = true
  protected enableLogging = true
  protected enableDryRun = true
  protected enableImpactAnalysis = true
  protected autoRollbackOnFailure = true
}
```

## Troubleshooting

### Issue: "Execution context not initialized"

**Cause:** Accessing `this.dryRun` outside command handler

**Solution:** Only use `this.dryRun` inside command handlers:
```typescript
defineCommands() {
  return [{
    handler: async () => this.myHandler(), // ✓ Correct
  }]
}

async myHandler() {
  await this.dryRun.fs.writeFile(...) // ✓ Correct
}

// ✗ Wrong: accessing in constructor or class body
```

### Issue: Validation fails with "Missing required environment variables"

**Cause:** Required env vars not set

**Solution:** Either set the env vars or update validation options:
```typescript
protected validationOptions = {
  requiredEnvVars: [], // Remove requirement
  // Or add to optional:
  optionalEnvVars: ['DATABASE_URL'],
}
```

### Issue: Snapshot creation fails

**Cause:** Insufficient disk space or permissions

**Solution:**
1. Check disk space: `df -h`
2. Check permissions: `ls -la .revealui/snapshots`
3. Disable snapshots: `--no-snapshot` flag

## Backward Compatibility

EnhancedCLI is 100% backward compatible:

1. **Existing BaseCLI scripts continue working** - No changes required
2. **Gradual migration** - Upgrade scripts one at a time
3. **Feature flags** - All features are opt-in
4. **No breaking changes** - All BaseCLI methods work identically

## Performance Considerations

### Overhead

- **Logging:** ~5-10ms per execution
- **Validation:** ~50-100ms (depends on checks)
- **Snapshots:** ~100-500ms (depends on file count)
- **Dry-run:** Negligible (operations not executed)

### Optimization Tips

1. Disable unused features:
   ```typescript
   protected enableValidation = false // Skip if not needed
   ```

2. Use `--no-snapshot` for rapid iterations:
   ```bash
   pnpm my-script run --no-snapshot
   ```

3. Limit validation checks:
   ```typescript
   protected validationOptions = {
     checks: ['env'], // Only check what you need
   }
   ```

## Next Steps

1. **Try the example:** `pnpm tsx scripts/cli/_enhanced-example.ts process --dry-run`
2. **Migrate one script** as a pilot
3. **Enable features incrementally**
4. **Review execution history:** `pnpm scripts:history`
5. **Create snapshots:** `pnpm rollback:create "my-snapshot"`

## Support

For questions or issues:
- Check examples in `scripts/cli/_enhanced-example.ts`
- Review API docs in `scripts/cli/_base-enhanced.ts`
- See existing enhanced scripts for patterns
