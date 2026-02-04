# Exit Code Audit Report

Generated: 2/4/2026, 5:53:32 AM

## Summary

| Metric | Count |
|--------|-------|
| Total files scanned | 259 |
| Files with violations | 118 |
| Total violations | 400 |
| Hardcoded exit codes | 93 |
| Throw without ErrorCode | 116 |
| Missing try-catch | 191 |

## Violations

### `scripts/__tests__/setup.ts`

ℹ️ **Line 28**: Async function "getTestMachine" has await calls but no try-catch

```typescript
async getTestMachine()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 41**: Async function "cleanup" has await calls but no try-catch

```typescript
async cleanup()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/analysis.ts`

⚠️ **Line 190**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 89**: Async function "generateReport" has await calls but no try-catch

```typescript
async generateReport()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/audit-any-types.ts`

⚠️ **Line 281**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/analyze/audit-docs.ts`

ℹ️ **Line 61**: Async function "scanForFalseClaims" has await calls but no try-catch

```typescript
async scanForFalseClaims()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/clean-root-files.ts`

ℹ️ **Line 145**: Async function "clean" has await calls but no try-catch

```typescript
async clean()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/cleanup-docs.ts`

ℹ️ **Line 25**: Async function "cleanupStaleDocs" has await calls but no try-catch

```typescript
async cleanupStaleDocs()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 68**: Async function "cleanupDuplicates" has await calls but no try-catch

```typescript
async cleanupDuplicates()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 106**: Async function "optimizeDocumentation" has await calls but no try-catch

```typescript
async optimizeDocumentation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 139**: Async function "archiveOldVersions" has await calls but no try-catch

```typescript
async archiveOldVersions()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/cleanup-obsolete.ts`

ℹ️ **Line 67**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/component-inventory.ts`

ℹ️ **Line 59**: Async function "audit" has await calls but no try-catch

```typescript
async audit()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 88**: Async function "auditScripts" has await calls but no try-catch

```typescript
async auditScripts()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 102**: Async function "auditPackages" has await calls but no try-catch

```typescript
async auditPackages()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 131**: Async function "auditCommands" has await calls but no try-catch

```typescript
async auditCommands()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 147**: Async function "auditConfigs" has await calls but no try-catch

```typescript
async auditConfigs()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 491**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/console-usage.ts`

⚠️ **Line 431**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/analyze/docs.ts`

ℹ️ **Line 47**: Async function "analyzeJSDocCoverage" has await calls but no try-catch

```typescript
async analyzeJSDocCoverage()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 183**: Async function "analyzeQualityMetrics" has await calls but no try-catch

```typescript
async analyzeQualityMetrics()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/analyze/measure-performance.ts`

⚠️ **Line 114**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/analyze/migrate-types.ts`

⚠️ **Line 308**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/cli/_base-enhanced.ts`

ℹ️ **Line 35**: Async function "runOperation" has await calls but no try-catch

```typescript
async runOperation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 208**: Async function "beforeRun" has await calls but no try-catch

```typescript
async beforeRun()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 295**: Async function "runPreValidation" has await calls but no try-catch

```typescript
async runPreValidation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 464**: Async function "showImpactAnalysis" has await calls but no try-catch

```typescript
async showImpactAnalysis()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/_base.ts`

ℹ️ **Line 483**: Async function "beforeRun" has await calls but no try-catch

```typescript
async beforeRun()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 498**: Async function "afterRun" has await calls but no try-catch

```typescript
async afterRun()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/_enhanced-example.ts`

ℹ️ **Line 85**: Async function "processFiles" has await calls but no try-catch

```typescript
async processFiles()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 122**: Async function "cleanup" has await calls but no try-catch

```typescript
async cleanup()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/dashboard.ts`

⚠️ **Line 180**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 130**: Async function "runInteractive" has await calls but no try-catch

```typescript
async runInteractive()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 190**: Async function "generateReport" has await calls but no try-catch

```typescript
async generateReport()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 335**: Async function "getCPUUsage" has await calls but no try-catch

```typescript
async getCPUUsage()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/ops.ts`

ℹ️ **Line 346**: Async function "migratePlan" has await calls but no try-catch

```typescript
async migratePlan()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 371**: Async function "migrateExecute" has await calls but no try-catch

```typescript
async migrateExecute()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 389**: Async function "migrateCompare" has await calls but no try-catch

```typescript
async migrateCompare()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 415**: Async function "rollback" has await calls but no try-catch

```typescript
async rollback()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/release.ts`

ℹ️ **Line 114**: Async function "bumpVersion" has await calls but no try-catch

```typescript
async bumpVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 139**: Async function "previewRelease" has await calls but no try-catch

```typescript
async previewRelease()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 171**: Async function "publishPackages" has await calls but no try-catch

```typescript
async publishPackages()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 204**: Async function "createTag" has await calls but no try-catch

```typescript
async createTag()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 243**: Async function "dryRun" has await calls but no try-catch

```typescript
async dryRun()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/revealui.ts`

❌ **Line 357**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 315**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/scripts.ts`

ℹ️ **Line 124**: Async function "list" has await calls but no try-catch

```typescript
async list()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 250**: Async function "info" has await calls but no try-catch

```typescript
async info()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 362**: Async function "runScript" has await calls but no try-catch

```typescript
async runScript()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 434**: Async function "history" has await calls but no try-catch

```typescript
async history()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/cli/skills.ts`

ℹ️ **Line 607**: Async function "trending" has await calls but no try-catch

```typescript
async trending()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/dev-tools/run-integration-tests.ts`

⚠️ **Line 88**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/dev-tools/teardown-test-database.ts`

⚠️ **Line 134**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 100**: Async function "teardownTestDatabase" has await calls but no try-catch

```typescript
async teardownTestDatabase()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/dev-tools/test-database.ts`

ℹ️ **Line 81**: Async function "applyMigrations" has await calls but no try-catch

```typescript
async applyMigrations()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 136**: Async function "enablePgVector" has await calls but no try-catch

```typescript
async enablePgVector()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/dev-tools/test-neon-connection.ts`

❌ **Line 17**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

⚠️ **Line 35**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

❌ **Line 38**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 45**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/dev-tools/verify-test-setup.ts`

⚠️ **Line 438**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 441**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/generate/copy-generated-types.ts`

❌ **Line 90**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/generate/enhanced-validate.ts`

❌ **Line 387**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 393**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/generate/generate-content.ts`

⚠️ **Line 44**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

❌ **Line 67**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/generate/migration-detector.ts`

❌ **Line 371**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

⚠️ **Line 59**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Generated schemas not found. Run: pnpm generate:all')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/generate/reorganize-structure.ts`

ℹ️ **Line 173**: Async function "reorganize" has await calls but no try-catch

```typescript
async reorganize()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 226**: Async function "moveItems" has await calls but no try-catch

```typescript
async moveItems()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 259**: Async function "mergeDirectories" has await calls but no try-catch

```typescript
async mergeDirectories()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/generate/review-generator.ts`

ℹ️ **Line 70**: Async function "generateReview" has await calls but no try-catch

```typescript
async generateReview()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 86**: Async function "collectReviewData" has await calls but no try-catch

```typescript
async collectReviewData()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 326**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/generate/unified-types.ts`

❌ **Line 82**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 107**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

⚠️ **Line 52**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Database package not found at: ${dbPackage}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/generate/validate-sync.ts`

❌ **Line 149**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 155**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/lib/args.ts`

⚠️ **Line 264**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Argument --${argDef.name} requires a value`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 272**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Argument --${argDef.name} must be a number, got: ${value}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/lib/cache.ts`

⚠️ **Line 233**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Cache entry not found: ${key}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 272**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Source directory not found: ${source}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 138**: Async function "getCacheKey" has await calls but no try-catch

```typescript
async getCacheKey()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 331**: Async function "clear" has await calls but no try-catch

```typescript
async clear()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 437**: Async function "getStats" has await calls but no try-catch

```typescript
async getStats()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/telemetry.ts`

ℹ️ **Line 477**: Async function "stop" has await calls but no try-catch

```typescript
async stop()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/utils.ts`

⚠️ **Line 239**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Required environment variable ${key} or ${fallbackKey} is not set`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 242**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Required environment variable ${key} is not set`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 286**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Missing dependencies: ${missing.join(', ')}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 99**: Async function "confirm" has await calls but no try-catch

```typescript
async confirm()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/mcp/adapter.ts`

⚠️ **Line 316**: Throwing generic Error without ErrorCode

```typescript
throw new Error('All retry attempts exhausted')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 345**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Request must include an action')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 349**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported action: ${request.action}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 419**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`HTTP request failed: ${result.message}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 429**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Request to ${this.serviceName} failed: ${error}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 491**: Throwing generic Error without ErrorCode

```typescript
if (!id) throw new Error('Deployment ID required')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 497**: Throwing generic Error without ErrorCode

```typescript
if (!deploymentId) throw new Error('Deployment ID required')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 502**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported action: ${request.action}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 542**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported action: ${request.action}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 572**: Throwing generic Error without ErrorCode

```typescript
if (!id) throw new Error('Project ID required')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 578**: Throwing generic Error without ErrorCode

```typescript
if (!projectId) throw new Error('Project ID required')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 583**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported action: ${request.action}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 598**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported MCP service: ${service}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/performance/benchmark-api.ts`

❌ **Line 499**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 504**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 109**: Async function "benchmarkCompression" has await calls but no try-catch

```typescript
async benchmarkCompression()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 167**: Async function "benchmarkCaching" has await calls but no try-catch

```typescript
async benchmarkCaching()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 246**: Async function "benchmarkPayloadOptimization" has await calls but no try-catch

```typescript
async benchmarkPayloadOptimization()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 307**: Async function "benchmarkRateLimiting" has await calls but no try-catch

```typescript
async benchmarkRateLimiting()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 394**: Async function "benchmarkCombined" has await calls but no try-catch

```typescript
async benchmarkCombined()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 455**: Async function "runAllBenchmarks" has await calls but no try-catch

```typescript
async runAllBenchmarks()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/performance/benchmark-bundle.ts`

❌ **Line 499**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 504**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 445**: Async function "runAllBenchmarks" has await calls but no try-catch

```typescript
async runAllBenchmarks()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/performance/benchmark-cache.ts`

❌ **Line 462**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 467**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 56**: Async function "benchmarkCDNHeaders" has await calls but no try-catch

```typescript
async benchmarkCDNHeaders()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 86**: Async function "benchmarkCacheKeys" has await calls but no try-catch

```typescript
async benchmarkCacheKeys()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 123**: Async function "benchmarkOptimisticUpdates" has await calls but no try-catch

```typescript
async benchmarkOptimisticUpdates()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 236**: Async function "benchmarkQueryDeduplication" has await calls but no try-catch

```typescript
async benchmarkQueryDeduplication()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 358**: Async function "benchmarkCacheStorage" has await calls but no try-catch

```typescript
async benchmarkCacheStorage()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 404**: Async function "runAllBenchmarks" has await calls but no try-catch

```typescript
async runAllBenchmarks()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/performance/benchmark-queries.ts`

❌ **Line 318**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 113**: Async function "benchmarkN1Optimization" has await calls but no try-catch

```typescript
async benchmarkN1Optimization()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 152**: Async function "benchmarkPagination" has await calls but no try-catch

```typescript
async benchmarkPagination()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 193**: Async function "benchmarkAggregation" has await calls but no try-catch

```typescript
async benchmarkAggregation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 231**: Async function "benchmarkSearch" has await calls but no try-catch

```typescript
async benchmarkSearch()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 270**: Async function "benchmarkIndexes" has await calls but no try-catch

```typescript
async benchmarkIndexes()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/setup/cleanup-failed-attempts.ts`

⚠️ **Line 58**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/cleanup-rate-limits.ts`

⚠️ **Line 49**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/cleanup-sessions.ts`

⚠️ **Line 34**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/create-globals.ts`

⚠️ **Line 120**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

❌ **Line 124**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/setup/environment.ts`

ℹ️ **Line 189**: Async function "generateSecrets" has await calls but no try-catch

```typescript
async generateSecrets()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/setup/install-clean.ts`

⚠️ **Line 27**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/migrations.ts`

⚠️ **Line 51**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/postinstall.ts`

⚠️ **Line 13**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 21**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

❌ **Line 28**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/setup/setup-docker-wsl2.ts`

⚠️ **Line 196**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 14**: Async function "checkDockerInstalled" has await calls but no try-catch

```typescript
async checkDockerInstalled()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 164**: Async function "fixDockerConfig" has await calls but no try-catch

```typescript
async fixDockerConfig()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/setup/setup-dual-database.ts`

⚠️ **Line 370**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/setup/setup-vector-database.ts`

⚠️ **Line 183**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 211**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 140**: Async function "verifySetup" has await calls but no try-catch

```typescript
async verifySetup()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/utils/orchestration.ts`

⚠️ **Line 47**: Throwing generic Error without ErrorCode

```typescript
throw new Error('No active workflow state file found')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 55**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Invalid state file format: missing frontmatter')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 91**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Invalid state file: missing required fields')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 43**: Async function "readStateFile" has await calls but no try-catch

```typescript
async readStateFile()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 236**: Async function "cleanupWorkflow" has await calls but no try-catch

```typescript
async cleanupWorkflow()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/package-extraction-guardrails.ts`

⚠️ **Line 42**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/pre-launch.ts`

⚠️ **Line 226**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 229**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 41**: Async function "checkTypeScript" has await calls but no try-catch

```typescript
async checkTypeScript()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 50**: Async function "checkPackageScripts" has await calls but no try-catch

```typescript
async checkPackageScripts()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 61**: Async function "checkLinting" has await calls but no try-catch

```typescript
async checkLinting()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 70**: Async function "checkTests" has await calls but no try-catch

```typescript
async checkTests()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 81**: Async function "checkBuild" has await calls but no try-catch

```typescript
async checkBuild()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 110**: Async function "checkEnvironment" has await calls but no try-catch

```typescript
async checkEnvironment()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 121**: Async function "checkDocumentation" has await calls but no try-catch

```typescript
async checkDocumentation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 142**: Async function "checkHealthEndpoint" has await calls but no try-catch

```typescript
async checkHealthEndpoint()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/production.ts`

⚠️ **Line 281**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 61**: Async function "checkDatabaseConnection" has await calls but no try-catch

```typescript
async checkDatabaseConnection()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/run-automated-validation.ts`

ℹ️ **Line 35**: Async function "verifyMigration" has await calls but no try-catch

```typescript
async verifyMigration()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 57**: Async function "runIntegrationTests" has await calls but no try-catch

```typescript
async runIntegrationTests()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 80**: Async function "runPerformanceTests" has await calls but no try-catch

```typescript
async runPerformanceTests()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 158**: Async function "testApiRoutes" has await calls but no try-catch

```typescript
async testApiRoutes()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 188**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/security-test.ts`

⚠️ **Line 235**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 32**: Async function "getFetch" has await calls but no try-catch

```typescript
async getFetch()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/test-api-routes.ts`

⚠️ **Line 202**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/test-nextjs-mcp-endpoint.ts`

ℹ️ **Line 53**: Async function "testMCPEndpoint" has await calls but no try-catch

```typescript
async testMCPEndpoint()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/validate-automation.ts`

⚠️ **Line 184**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 36**: Async function "checkDockerCompose" has await calls but no try-catch

```typescript
async checkDockerCompose()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 73**: Async function "checkSetupScript" has await calls but no try-catch

```typescript
async checkSetupScript()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 91**: Async function "checkValidationScript" has await calls but no try-catch

```typescript
async checkValidationScript()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 111**: Async function "checkIntegrationTest" has await calls but no try-catch

```typescript
async checkIntegrationTest()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 126**: Async function "checkCIConfig" has await calls but no try-catch

```typescript
async checkCIConfig()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 143**: Async function "checkPackageScripts" has await calls but no try-catch

```typescript
async checkPackageScripts()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/validate-package-scripts.ts`

⚠️ **Line 303**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/verify-claims.ts`

❌ **Line 304**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 129**: Async function "verifyClaims" has await calls but no try-catch

```typescript
async verifyClaims()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/validate/verify-dev-package-imports.ts`

⚠️ **Line 254**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/verify-endpoints.ts`

⚠️ **Line 172**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/verify-package-exports.ts`

⚠️ **Line 141**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/verify-services-cms-types.ts`

⚠️ **Line 107**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/validate/verify-services-runtime.ts`

⚠️ **Line 191**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/workflows/automation-engine.ts`

ℹ️ **Line 53**: Async function "execute" has await calls but no try-catch

```typescript
async execute()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 136**: Async function "requestApproval" has await calls but no try-catch

```typescript
async requestApproval()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 244**: Async function "resume" has await calls but no try-catch

```typescript
async resume()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/workflows/cancel.ts`

⚠️ **Line 21**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/workflows/continue.ts`

⚠️ **Line 55**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 66**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/workflows/doc-lifecycle-workflow.ts`

❌ **Line 247**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 77**: Async function "validatePrerequisites" has await calls but no try-catch

```typescript
async validatePrerequisites()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 130**: Async function "createMissingDirectories" has await calls but no try-catch

```typescript
async createMissingDirectories()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/workflows/manage-docs.ts`

❌ **Line 598**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 608**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 618**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 631**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 635**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 643**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 327**: Async function "createDocs" has await calls but no try-catch

```typescript
async createDocs()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 415**: Async function "implementDocs" has await calls but no try-catch

```typescript
async implementDocs()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 492**: Async function "resetDocs" has await calls but no try-catch

```typescript
async resetDocs()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/workflows/start.ts`

⚠️ **Line 136**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/workflows/status.ts`

⚠️ **Line 27**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/workflows/test-infrastructure-fixes.ts`

⚠️ **Line 52**: Throwing generic Error without ErrorCode

```typescript
if (!existsSync(scriptPath)) throw new Error('Script not found')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 66**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`${supabaseErrors} Supabase type errors remain`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 85**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Missing command file: ${file}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 100**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Setup script failed: ${error.message}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 111**: Throwing generic Error without ErrorCode

```typescript
if (!existsSync(scriptPath)) throw new Error('Script not found')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 118**: Throwing generic Error without ErrorCode

```typescript
if (!existsSync(cacheDir)) throw new Error('Cache directory not created')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 141**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Validation timeout: ${duration}ms`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 152**: Throwing generic Error without ErrorCode

```typescript
if (!existsSync(docPath)) throw new Error('Documentation not found')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 156**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Documentation incomplete')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 169**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Missing script: ${script}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 26**: Async function "runAllTests" has await calls but no try-catch

```typescript
async runAllTests()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 146**: Async function "testDocumentation" has await calls but no try-catch

```typescript
async testDocumentation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/workflows/workflow-runner.ts`

ℹ️ **Line 28**: Async function "runWorkflow" has await calls but no try-catch

```typescript
async runWorkflow()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 46**: Async function "resumeWorkflow" has await calls but no try-catch

```typescript
async resumeWorkflow()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/analyze/dependencies.ts`

❌ **Line 566**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 277**: Async function "findCircularDependencies" has await calls but no try-catch

```typescript
async findCircularDependencies()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 486**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/database/status.ts`

ℹ️ **Line 19**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/fix/fix-import-extensions.ts`

ℹ️ **Line 188**: Async function "main" has await calls but no try-catch

```typescript
async main()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/info/deps-graph.ts`

⚠️ **Line 341**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unsupported format: ${options.format}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/commands/maintain/audit-exit-codes.ts`

⚠️ **Line 101**: Hardcoded exit code: process.exit(0)

```typescript
// Match: process.exit(0), process.exit(1), etc.
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

❌ **Line 101**: Hardcoded exit code: process.exit(1)

```typescript
// Match: process.exit(0), process.exit(1), etc.
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 482**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/commands/maintain/audit-scripts.ts`

❌ **Line 399**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 405**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 273**: Async function "generateAuditReport" has await calls but no try-catch

```typescript
async generateAuditReport()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/maintain/fix-scripts.ts`

❌ **Line 407**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 413**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/commands/maintain/validate-scripts.ts`

❌ **Line 396**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 398**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

❌ **Line 404**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

ℹ️ **Line 252**: Async function "generateValidationReport" has await calls but no try-catch

```typescript
async generateValidationReport()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/commands/ops/rollback-list.ts`

⚠️ **Line 24**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/commands/validate/validate-dependencies.ts`

❌ **Line 585**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/gates/cohesion/analyze.ts`

ℹ️ **Line 20**: Async function "patternAnalysisToIssue" has await calls but no try-catch

```typescript
async patternAnalysisToIssue()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/gates/cohesion/fix.ts`

⚠️ **Line 70**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/gates/cohesion/ralph.ts`

⚠️ **Line 239**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

⚠️ **Line 292**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

ℹ️ **Line 41**: Async function "runAnalysis" has await calls but no try-catch

```typescript
async runAnalysis()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 84**: Async function "runAssessment" has await calls but no try-catch

```typescript
async runAssessment()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 107**: Async function "runFixes" has await calls but no try-catch

```typescript
async runFixes()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/gates/security/auth-direct-test.ts`

⚠️ **Line 284**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/gates/security/auth-e2e-test.ts`

⚠️ **Line 331**: Hardcoded exit code: process.exit(0)

```typescript
process.exit(0)
```

**Suggestion**: Replace with: process.exit(ErrorCode.SUCCESS) (or appropriate ErrorCode.SUCCESS)

### `scripts/lib/analytics/usage-analytics.ts`

ℹ️ **Line 107**: Async function "getDashboard" has await calls but no try-catch

```typescript
async getDashboard()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 406**: Async function "calculateActivityByHour" has await calls but no try-catch

```typescript
async calculateActivityByHour()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 430**: Async function "calculateActivityByDay" has await calls but no try-catch

```typescript
async calculateActivityByDay()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 512**: Async function "getUsageAnalytics" has await calls but no try-catch

```typescript
async getUsageAnalytics()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/audit/execution-logger.ts`

⚠️ **Line 256**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 293**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 330**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 342**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Execution not found: ${executionId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 376**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 445**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 534**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 549**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 222**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 255**: Async function "createSchema" has await calls but no try-catch

```typescript
async createSchema()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 292**: Async function "startExecution" has await calls but no try-catch

```typescript
async startExecution()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 329**: Async function "endExecution" has await calls but no try-catch

```typescript
async endExecution()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 375**: Async function "getHistory" has await calls but no try-catch

```typescript
async getHistory()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 444**: Async function "getStats" has await calls but no try-catch

```typescript
async getStats()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 533**: Async function "getExecution" has await calls but no try-catch

```typescript
async getExecution()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 548**: Async function "cleanup" has await calls but no try-catch

```typescript
async cleanup()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/cli/dispatch.ts`

❌ **Line 237**: Hardcoded exit code: process.exit(1)

```typescript
*   process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/lib/dry-run/dry-run-engine.ts`

ℹ️ **Line 208**: Async function "anonymous" has await calls but no try-catch

```typescript
async anonymous()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 240**: Async function "anonymous" has await calls but no try-catch

```typescript
async anonymous()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 261**: Async function "anonymous" has await calls but no try-catch

```typescript
async anonymous()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 322**: Async function "anonymous" has await calls but no try-catch

```typescript
async anonymous()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/migration/migration-helper.ts`

⚠️ **Line 115**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Version not found: ${scriptName}@${fromVersion}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 119**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Version not found: ${scriptName}@${toVersion}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 386**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Version not found: ${scriptName}@${fromVersion}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 390**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Version not found: ${scriptName}@${toVersion}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 515**: Async function "getMigrationHelper" has await calls but no try-catch

```typescript
async getMigrationHelper()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/monitoring/script-health.ts`

⚠️ **Line 165**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 270**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 491**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 131**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 164**: Async function "createSchema" has await calls but no try-catch

```typescript
async createSchema()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 189**: Async function "getHealth" has await calls but no try-catch

```typescript
async getHealth()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 316**: Async function "getDashboard" has await calls but no try-catch

```typescript
async getDashboard()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/profiling/performance-profiler.ts`

⚠️ **Line 193**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 221**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 262**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 266**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`No active profile found for execution: ${executionId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 300**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 304**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`No active profile found for execution: ${executionId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 325**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 329**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`No active profile found for execution: ${executionId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 334**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Profile not found: ${executionId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 361**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 381**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 501**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 520**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 159**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 192**: Async function "createSchema" has await calls but no try-catch

```typescript
async createSchema()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 220**: Async function "startProfile" has await calls but no try-catch

```typescript
async startProfile()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 324**: Async function "endProfile" has await calls but no try-catch

```typescript
async endProfile()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 360**: Async function "getProfile" has await calls but no try-catch

```typescript
async getProfile()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 399**: Async function "analyzeBottlenecks" has await calls but no try-catch

```typescript
async analyzeBottlenecks()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 500**: Async function "updatePhases" has await calls but no try-catch

```typescript
async updatePhases()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 519**: Async function "updateIOOperations" has await calls but no try-catch

```typescript
async updateIOOperations()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/registry/script-registry.ts`

⚠️ **Line 155**: Throwing generic Error without ErrorCode

```typescript
throw new Error(
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 166**: Throwing generic Error without ErrorCode

```typescript
throw new Error('No registry to save')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 177**: Throwing generic Error without ErrorCode

```typescript
throw new Error(
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/lib/rollback/manager.ts`

⚠️ **Line 369**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Invalid file checkpoint data')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 375**: Throwing generic Error without ErrorCode

```typescript
throw new Error('File checkpoint missing path or content')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 387**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Invalid configuration checkpoint data')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 393**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Configuration checkpoint missing path or config')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 213**: Async function "getLatestCheckpoint" has await calls but no try-catch

```typescript
async getLatestCheckpoint()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 330**: Async function "executeRollback" has await calls but no try-catch

```typescript
async executeRollback()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/rollback/snapshot-manager.ts`

ℹ️ **Line 175**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 195**: Async function "createSnapshot" has await calls but no try-catch

```typescript
async createSnapshot()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 382**: Async function "getSnapshotFiles" has await calls but no try-catch

```typescript
async getSnapshotFiles()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 426**: Async function "cleanup" has await calls but no try-catch

```typescript
async cleanup()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/rollback/undo-engine.ts`

⚠️ **Line 263**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Snapshot not found: ${snapshotId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 258**: Async function "preview" has await calls but no try-catch

```typescript
async preview()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/state/workflow-state.ts`

⚠️ **Line 141**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Workflow not found: ${id}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 160**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Workflow not found: ${workflowId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 165**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Step not found: ${stepId}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 200**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Approval not found: ${token}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 204**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Approval already processed: ${approval.status}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 209**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Approval has expired')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 281**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Cannot start workflow in status: ${workflow.status}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 288**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Cannot pause workflow in status: ${workflow.status}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 295**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Cannot resume workflow in status: ${workflow.status}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 302**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Cannot cancel workflow in status: ${workflow.status}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 377**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Unknown event type: ${(event as WorkflowEvent).type}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 385**: Throwing generic Error without ErrorCode

```typescript
throw new Error('WorkflowStateMachine not initialized. Call initialize() first.')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 81**: Async function "create" has await calls but no try-catch

```typescript
async create()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 136**: Async function "transition" has await calls but no try-catch

```typescript
async transition()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 155**: Async function "requestApproval" has await calls but no try-catch

```typescript
async requestApproval()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/validation/env.ts`

ℹ️ **Line 227**: Async function "parseEnvFile" has await calls but no try-catch

```typescript
async parseEnvFile()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/validation/pre-execution.ts`

❌ **Line 19**: Hardcoded exit code: process.exit(1)

```typescript
*   process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

### `scripts/lib/validators/documentation-validator.ts`

ℹ️ **Line 676**: Async function "validate" has await calls but no try-catch

```typescript
async validate()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/versioning/deprecation-manager.ts`

⚠️ **Line 114**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 140**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 172**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 186**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 200**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 218**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 238**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 80**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 113**: Async function "createSchema" has await calls but no try-catch

```typescript
async createSchema()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 139**: Async function "addDeprecation" has await calls but no try-catch

```typescript
async addDeprecation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 171**: Async function "getDeprecations" has await calls but no try-catch

```typescript
async getDeprecations()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 185**: Async function "getDeprecationsByVersion" has await calls but no try-catch

```typescript
async getDeprecationsByVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 199**: Async function "getAllDeprecations" has await calls but no try-catch

```typescript
async getAllDeprecations()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 212**: Async function "checkDeprecations" has await calls but no try-catch

```typescript
async checkDeprecations()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 237**: Async function "removeDeprecation" has await calls but no try-catch

```typescript
async removeDeprecation()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/versioning/script-version.ts`

⚠️ **Line 144**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 172**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 209**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 227**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 241**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 262**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 341**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 354**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 110**: Async function "getInstance" has await calls but no try-catch

```typescript
async getInstance()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 143**: Async function "createSchema" has await calls but no try-catch

```typescript
async createSchema()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 171**: Async function "registerVersion" has await calls but no try-catch

```typescript
async registerVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 208**: Async function "getVersion" has await calls but no try-catch

```typescript
async getVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 226**: Async function "getVersions" has await calls but no try-catch

```typescript
async getVersions()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 240**: Async function "getLatestVersion" has await calls but no try-catch

```typescript
async getLatestVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 340**: Async function "getAllVersions" has await calls but no try-catch

```typescript
async getAllVersions()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 353**: Async function "deleteVersion" has await calls but no try-catch

```typescript
async deleteVersion()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/visualization/dependency-analyzer.ts`

⚠️ **Line 379**: Throwing generic Error without ErrorCode

```typescript
throw new Error('No graph available. Run analyze() first.')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 481**: Throwing generic Error without ErrorCode

```typescript
throw new Error('No graph available. Run analyze() first.')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/mcp/adapters/vultr-test.ts`

❌ **Line 13**: Hardcoded exit code: process.exit(1)

```typescript
process.exit(1)
```

**Suggestion**: Replace with: process.exit(ErrorCode.EXECUTION_ERROR) (or appropriate ErrorCode.EXECUTION_ERROR)

⚠️ **Line 36**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Chat request failed: ${res.status} ${err}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 68**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Embeddings request failed: ${res.status} ${err}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 21**: Async function "chat" has await calls but no try-catch

```typescript
async chat()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 54**: Async function "embed" has await calls but no try-catch

```typescript
async embed()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/generators/content/api-docs.ts`

ℹ️ **Line 120**: Async function "extractAPIEndpoints" has await calls but no try-catch

```typescript
async extractAPIEndpoints()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

### `scripts/lib/generators/types/table-discovery.ts`

⚠️ **Line 137**: Throwing generic Error without ErrorCode

```typescript
throw new Error(errorMessage)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/lib/generators/types/type-transformer.ts`

⚠️ **Line 168**: Throwing generic Error without ErrorCode

```typescript
throw new Error(errorMessage)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 184**: Throwing generic Error without ErrorCode

```typescript
throw new Error('Transformation validation failed')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/lib/state/adapters/memory.ts`

⚠️ **Line 98**: Throwing generic Error without ErrorCode

```typescript
throw new Error(`Approval not found: ${token}`)
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

### `scripts/lib/state/adapters/pglite.ts`

⚠️ **Line 48**: Throwing generic Error without ErrorCode

```typescript
throw new Error(
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 98**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 136**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 147**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 171**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 179**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 209**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 219**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

⚠️ **Line 235**: Throwing generic Error without ErrorCode

```typescript
if (!this.db) throw new Error('Database not initialized')
```

**Suggestion**: Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)

ℹ️ **Line 97**: Async function "saveWorkflow" has await calls but no try-catch

```typescript
async saveWorkflow()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 178**: Async function "saveApproval" has await calls but no try-catch

```typescript
async saveApproval()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 208**: Async function "loadApproval" has await calls but no try-catch

```typescript
async loadApproval()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)

ℹ️ **Line 218**: Async function "loadApprovalsByWorkflow" has await calls but no try-catch

```typescript
async loadApprovalsByWorkflow()
```

**Suggestion**: Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)


