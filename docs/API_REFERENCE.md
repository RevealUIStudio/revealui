# Script Management System - API Reference

Complete API reference for programmatic usage of the Script Management System.

## Table of Contents

- [Overview](#overview)
- [TypeScript Configuration](#typescript-configuration)
- [Script Registry API](#script-registry-api)
- [Execution Logger API](#execution-logger-api)
- [Performance Profiler API](#performance-profiler-api)
- [Health Monitor API](#health-monitor-api)
- [Version Manager API](#version-manager-api)
- [Snapshot Manager API](#snapshot-manager-api)
- [Dependency Analyzer API](#dependency-analyzer-api)
- [Usage Analytics API](#usage-analytics-api)
- [EnhancedCLI Base Class](#enhancedcli-base-class)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Complete Examples](#complete-examples)

## Overview

All APIs are designed for programmatic usage in scripts, automation, and integrations. They provide:

- **Type Safety**: Full TypeScript definitions
- **Async/Await**: Modern promise-based APIs
- **Error Handling**: Structured error types with context
- **Non-Blocking**: Failures don't crash the application
- **Database-Backed**: Persistent storage using PGlite

## TypeScript Configuration

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

Import with `.js` extension (TypeScript requirement):

```typescript
import { ScriptRegistry } from './scripts/lib/registry/script-registry.js'
```

## Script Registry API

Discover, search, and retrieve script metadata.

### Class: `ScriptRegistry`

#### Constructor

```typescript
constructor()
```

No configuration required. Automatically scans `scripts/` directory.

#### Methods

##### `getAllScripts()`

Get all discovered scripts with metadata.

```typescript
async getAllScripts(): Promise<ScriptMetadata[]>
```

**Returns**: Array of script metadata objects

**Example**:
```typescript
import { ScriptRegistry } from './scripts/lib/registry/script-registry.js'

const registry = new ScriptRegistry()
const scripts = await registry.getAllScripts()

scripts.forEach(script => {
  console.log(`${script.name} - ${script.description}`)
  console.log(`  Category: ${script.category}`)
  console.log(`  Path: ${script.path}`)
})
```

##### `getScript(path)`

Get metadata for a specific script.

```typescript
async getScript(path: string): Promise<ScriptMetadata | null>
```

**Parameters**:
- `path`: Absolute or relative path to script

**Returns**: Script metadata or null if not found

**Example**:
```typescript
const script = await registry.getScript('scripts/cli/db/migrate.ts')
if (script) {
  console.log('Description:', script.description)
  console.log('Author:', script.author)
  console.log('Version:', script.version)
}
```

##### `searchScripts(query)`

Search scripts by name, description, category, or tags.

```typescript
async searchScripts(query: string): Promise<ScriptMetadata[]>
```

**Parameters**:
- `query`: Search term (case-insensitive)

**Returns**: Array of matching scripts

**Example**:
```typescript
const results = await registry.searchScripts('database')
console.log(`Found ${results.length} scripts matching "database"`)

results.forEach(script => {
  console.log(`- ${script.name}: ${script.description}`)
})
```

##### `getScriptsByCategory(category)`

Get all scripts in a specific category.

```typescript
async getScriptsByCategory(category: string): Promise<ScriptMetadata[]>
```

**Parameters**:
- `category`: Category name (e.g., 'database', 'api', 'cli')

**Returns**: Array of scripts in category

**Example**:
```typescript
const dbScripts = await registry.getScriptsByCategory('database')
console.log(`Database scripts: ${dbScripts.length}`)
```

##### `getScriptTree()`

Get scripts organized in tree structure by category.

```typescript
async getScriptTree(): Promise<ScriptTree>
```

**Returns**: Nested object of categories and scripts

**Example**:
```typescript
const tree = await registry.getScriptTree()

for (const [category, scripts] of Object.entries(tree)) {
  console.log(`\n${category}:`)
  scripts.forEach(script => {
    console.log(`  - ${script.name}`)
  })
}
```

### Types

```typescript
interface ScriptMetadata {
  name: string                    // Script identifier
  path: string                    // Absolute file path
  description: string             // Script description
  category: string                // Category (from directory)
  tags: string[]                  // Search keywords
  author?: string                 // Author from JSDoc
  version?: string                // Version from JSDoc
  dependencies: string[]          // Imported modules
  isAsync: boolean                // Has async operations
  estimatedDuration?: number      // Estimated runtime (ms)
  lastModified: Date              // File modification time
}

interface ScriptTree {
  [category: string]: ScriptMetadata[]
}
```

## Execution Logger API

Track script executions with complete audit trail.

### Class: `ExecutionLogger`

#### Constructor

```typescript
constructor()
```

Automatically connects to PGlite database.

#### Methods

##### `startExecution(params)`

Log the start of a script execution.

```typescript
async startExecution(params: StartExecutionParams): Promise<string>
```

**Parameters**:
```typescript
interface StartExecutionParams {
  scriptId: string                // Script identifier
  args?: string[]                 // Command-line arguments
  metadata?: Record<string, any>  // Additional metadata
}
```

**Returns**: Execution ID (UUID)

**Example**:
```typescript
import { ExecutionLogger } from './scripts/lib/audit/execution-logger.js'

const logger = new ExecutionLogger()

const executionId = await logger.startExecution({
  scriptId: 'my-script',
  args: process.argv.slice(2),
  metadata: { user: process.env.USER }
})
```

##### `endExecution(executionId, result)`

Log the end of a script execution.

```typescript
async endExecution(
  executionId: string,
  result: ExecutionResult
): Promise<void>
```

**Parameters**:
```typescript
interface ExecutionResult {
  success: boolean                // Execution succeeded
  error?: string                  // Error message if failed
  exitCode?: number               // Process exit code
  metadata?: Record<string, any>  // Additional metadata
}
```

**Example**:
```typescript
try {
  // Your script logic
  await logger.endExecution(executionId, {
    success: true,
    exitCode: 0
  })
} catch (error) {
  await logger.endExecution(executionId, {
    success: false,
    error: error.message,
    exitCode: 1
  })
}
```

##### `getExecutionHistory(scriptId, limit)`

Get execution history for a script.

```typescript
async getExecutionHistory(
  scriptId?: string,
  limit?: number
): Promise<ExecutionRecord[]>
```

**Parameters**:
- `scriptId`: Optional script ID to filter (omit for all scripts)
- `limit`: Maximum number of records (default: 50)

**Returns**: Array of execution records

**Example**:
```typescript
const history = await logger.getExecutionHistory('my-script', 10)

history.forEach(record => {
  const duration = record.endTime - record.startTime
  console.log(`${record.startTime}: ${record.success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`)
})
```

##### `getExecutionStats(scriptId, days)`

Get execution statistics for a script.

```typescript
async getExecutionStats(
  scriptId: string,
  days?: number
): Promise<ExecutionStats>
```

**Parameters**:
- `scriptId`: Script identifier
- `days`: Number of days to analyze (default: 30)

**Returns**: Execution statistics

**Example**:
```typescript
const stats = await logger.getExecutionStats('my-script', 7)

console.log('Last 7 days:')
console.log(`  Total: ${stats.totalExecutions}`)
console.log(`  Success: ${stats.successfulExecutions}`)
console.log(`  Failed: ${stats.failedExecutions}`)
console.log(`  Success Rate: ${stats.successRate}%`)
console.log(`  Avg Duration: ${stats.averageDuration}ms`)
```

### Types

```typescript
interface ExecutionRecord {
  id: string                      // Execution ID
  scriptId: string                // Script identifier
  startTime: Date                 // Execution start
  endTime?: Date                  // Execution end
  success?: boolean               // Success status
  error?: string                  // Error message
  exitCode?: number               // Exit code
  args?: string[]                 // Command-line args
  metadata?: Record<string, any>  // Additional metadata
}

interface ExecutionStats {
  scriptId: string                // Script identifier
  totalExecutions: number         // Total runs
  successfulExecutions: number    // Successful runs
  failedExecutions: number        // Failed runs
  successRate: number             // Success percentage (0-100)
  averageDuration: number         // Mean duration (ms)
  minDuration: number             // Fastest run (ms)
  maxDuration: number             // Slowest run (ms)
  lastExecution?: Date            // Most recent run
}
```

## Performance Profiler API

Track performance metrics with phase-level granularity.

### Class: `PerformanceProfiler`

#### Constructor

```typescript
constructor(executionId: string)
```

**Parameters**:
- `executionId`: Execution ID from ExecutionLogger

#### Methods

##### `startProfile()`

Start performance profiling.

```typescript
startProfile(): void
```

**Example**:
```typescript
import { PerformanceProfiler } from './scripts/lib/profiling/performance-profiler.js'

const profiler = new PerformanceProfiler(executionId)
profiler.startProfile()
```

##### `markPhase(name, options?)`

Mark the start of a new phase.

```typescript
markPhase(name: string, options?: PhaseOptions): void
```

**Parameters**:
```typescript
interface PhaseOptions {
  durationThreshold?: number    // Duration threshold (ms)
  memoryThreshold?: number      // Memory threshold (MB)
  cpuThreshold?: number         // CPU threshold (%)
}
```

**Example**:
```typescript
profiler.markPhase('database-query')
await runDatabaseQuery()

profiler.markPhase('data-processing', {
  durationThreshold: 5000,  // Warn if > 5 seconds
  memoryThreshold: 512      // Warn if > 512 MB
})
await processData()
```

##### `endProfile()`

End profiling and get results.

```typescript
endProfile(): PerformanceProfile
```

**Returns**: Performance profile with metrics

**Example**:
```typescript
profiler.markPhase('finalization')
await finalize()

const profile = profiler.endProfile()

console.log(`Total Duration: ${profile.totalDuration}ms`)
console.log(`Phases: ${profile.phases.length}`)
console.log(`Bottlenecks: ${profile.bottlenecks.length}`)

profile.bottlenecks.forEach(bottleneck => {
  console.log(`⚠️  ${bottleneck.phase}: ${bottleneck.reason}`)
})
```

##### `getBottlenecks()`

Analyze performance data for bottlenecks.

```typescript
async getBottlenecks(executionId: string): Promise<Bottleneck[]>
```

**Parameters**:
- `executionId`: Execution ID to analyze

**Returns**: Array of detected bottlenecks

**Example**:
```typescript
const bottlenecks = await profiler.getBottlenecks(executionId)

bottlenecks.forEach(b => {
  console.log(`${b.phase}:`)
  console.log(`  Type: ${b.type}`)
  console.log(`  Reason: ${b.reason}`)
  console.log(`  Suggestion: ${b.suggestion}`)
})
```

### Types

```typescript
interface PerformanceProfile {
  executionId: string             // Execution ID
  totalDuration: number           // Total time (ms)
  phases: PhaseMetrics[]          // Per-phase metrics
  bottlenecks: Bottleneck[]       // Detected bottlenecks
}

interface PhaseMetrics {
  name: string                    // Phase name
  duration: number                // Duration (ms)
  memoryUsed: number              // Memory delta (MB)
  cpuPercent?: number             // CPU utilization (%)
  ioOperations?: number           // I/O operations
  startTime: Date                 // Phase start
  endTime: Date                   // Phase end
}

interface Bottleneck {
  phase: string                   // Phase name
  type: 'duration' | 'memory' | 'cpu' | 'io'
  reason: string                  // Why it's a bottleneck
  suggestion: string              // How to fix it
  severity: 'low' | 'medium' | 'high'
}
```

## Health Monitor API

Monitor script health with automated alerts.

### Class: `ScriptHealthMonitor`

#### Constructor

```typescript
constructor()
```

#### Methods

##### `getScriptHealth(scriptId)`

Get current health status for a script.

```typescript
async getScriptHealth(scriptId: string): Promise<HealthStatus>
```

**Parameters**:
- `scriptId`: Script identifier

**Returns**: Health status

**Example**:
```typescript
import { ScriptHealthMonitor } from './scripts/lib/monitoring/script-health.js'

const monitor = new ScriptHealthMonitor()
const health = await monitor.getScriptHealth('my-script')

console.log(`Success Rate: ${health.successRate}%`)
console.log(`Trend: ${health.trend}`)
console.log(`Status: ${health.status}`)

if (health.status === 'unhealthy') {
  console.log('⚠️  Script is unhealthy!')
  health.alerts.forEach(alert => {
    console.log(`  - ${alert.message}`)
  })
}
```

##### `getHealthDashboard()`

Get health dashboard for all scripts.

```typescript
async getHealthDashboard(): Promise<HealthDashboard>
```

**Returns**: Dashboard with aggregate health metrics

**Example**:
```typescript
const dashboard = await monitor.getHealthDashboard()

console.log(`Total Scripts: ${dashboard.totalScripts}`)
console.log(`Healthy: ${dashboard.healthyScripts}`)
console.log(`Warning: ${dashboard.warningScripts}`)
console.log(`Unhealthy: ${dashboard.unhealthyScripts}`)

console.log('\nTop Scripts:')
dashboard.topScripts.forEach(script => {
  console.log(`  ${script.name}: ${script.successRate}%`)
})
```

##### `getAlerts(options?)`

Get health alerts.

```typescript
async getAlerts(options?: AlertOptions): Promise<Alert[]>
```

**Parameters**:
```typescript
interface AlertOptions {
  scriptId?: string               // Filter by script
  acknowledged?: boolean          // Filter by ack status
  severity?: 'low' | 'medium' | 'high'
}
```

**Returns**: Array of alerts

**Example**:
```typescript
const alerts = await monitor.getAlerts({
  acknowledged: false,
  severity: 'high'
})

console.log(`${alerts.length} unacknowledged high-severity alerts`)

alerts.forEach(alert => {
  console.log(`${alert.scriptId}: ${alert.message}`)
  console.log(`  Triggered: ${alert.triggeredAt}`)
  console.log(`  Condition: ${alert.condition}`)
})
```

##### `acknowledgeAlert(alertId)`

Acknowledge an alert.

```typescript
async acknowledgeAlert(alertId: string): Promise<void>
```

**Parameters**:
- `alertId`: Alert identifier

**Example**:
```typescript
await monitor.acknowledgeAlert(alert.id)
console.log('Alert acknowledged')
```

### Types

```typescript
interface HealthStatus {
  scriptId: string                // Script identifier
  status: 'healthy' | 'warning' | 'unhealthy'
  successRate: number             // Success percentage (0-100)
  averageDuration: number         // Mean duration (ms)
  trend: 'improving' | 'stable' | 'degrading'
  lastExecution?: Date            // Most recent run
  alerts: Alert[]                 // Active alerts
}

interface HealthDashboard {
  totalScripts: number            // Total scripts
  healthyScripts: number          // Healthy count
  warningScripts: number          // Warning count
  unhealthyScripts: number        // Unhealthy count
  overallSuccessRate: number      // Overall success %
  topScripts: ScriptHealth[]      // Best performing
  bottomScripts: ScriptHealth[]   // Worst performing
  recentAlerts: Alert[]           // Recent alerts
}

interface Alert {
  id: string                      // Alert ID
  scriptId: string                // Script identifier
  message: string                 // Alert message
  condition: string               // Trigger condition
  severity: 'low' | 'medium' | 'high'
  triggeredAt: Date               // When triggered
  acknowledged: boolean           // Acknowledged status
  acknowledgedAt?: Date           // When acknowledged
}
```

## Version Manager API

Manage script versions with deprecation tracking.

### Class: `ScriptVersionManager`

#### Constructor

```typescript
constructor()
```

#### Methods

##### `registerVersion(params)`

Register a new version of a script.

```typescript
async registerVersion(params: VersionParams): Promise<void>
```

**Parameters**:
```typescript
interface VersionParams {
  scriptId: string                // Script identifier
  version: string                 // Semantic version
  breakingChanges?: string[]      // Breaking changes
  migrationNotes?: string         // Migration guide
}
```

**Example**:
```typescript
import { ScriptVersionManager } from './scripts/lib/versioning/script-version.js'

const versionManager = new ScriptVersionManager()

await versionManager.registerVersion({
  scriptId: 'my-script',
  version: '2.0.0',
  breakingChanges: [
    'Changed parameter order in run() method',
    'Removed --legacy flag'
  ],
  migrationNotes: 'Run migration script: npm run migrate:v2'
})
```

##### `getVersions(scriptId)`

Get all versions of a script.

```typescript
async getVersions(scriptId: string): Promise<Version[]>
```

**Parameters**:
- `scriptId`: Script identifier

**Returns**: Array of versions

**Example**:
```typescript
const versions = await versionManager.getVersions('my-script')

versions.forEach(v => {
  console.log(`${v.version} - ${v.createdAt}`)
  if (v.breakingChanges) {
    console.log('  Breaking changes:')
    v.breakingChanges.forEach(change => {
      console.log(`    - ${change}`)
    })
  }
})
```

##### `getLatestVersion(scriptId)`

Get the latest version of a script.

```typescript
async getLatestVersion(scriptId: string): Promise<Version | null>
```

**Parameters**:
- `scriptId`: Script identifier

**Returns**: Latest version or null

**Example**:
```typescript
const latest = await versionManager.getLatestVersion('my-script')
if (latest) {
  console.log(`Latest version: ${latest.version}`)
}
```

##### `isDeprecated(scriptId, version)`

Check if a version is deprecated.

```typescript
async isDeprecated(
  scriptId: string,
  version: string
): Promise<boolean>
```

**Parameters**:
- `scriptId`: Script identifier
- `version`: Version to check

**Returns**: True if deprecated

**Example**:
```typescript
const deprecated = await versionManager.isDeprecated('my-script', '1.0.0')
if (deprecated) {
  console.log('⚠️  This version is deprecated')
}
```

### Types

```typescript
interface Version {
  scriptId: string                // Script identifier
  version: string                 // Semantic version
  createdAt: Date                 // Registration date
  breakingChanges?: string[]      // Breaking changes
  migrationNotes?: string         // Migration guide
  deprecated: boolean             // Deprecation status
}

interface Deprecation {
  scriptId: string                // Script identifier
  version: string                 // Deprecated version
  deprecatedAt: Date              // Deprecation date
  reason: string                  // Why deprecated
  alternative?: string            // Recommended version
  removalDate?: Date              // Scheduled removal
}
```

## Snapshot Manager API

Create and restore snapshots for rollback.

### Class: `SnapshotManager`

#### Constructor

```typescript
constructor()
```

#### Methods

##### `createSnapshot(params)`

Create a snapshot of current state.

```typescript
async createSnapshot(params: SnapshotParams): Promise<string>
```

**Parameters**:
```typescript
interface SnapshotParams {
  name: string                    // Snapshot name
  metadata?: Record<string, any>  // Additional metadata
}
```

**Returns**: Snapshot ID

**Example**:
```typescript
import { SnapshotManager } from './scripts/lib/rollback/snapshot-manager.js'

const manager = new SnapshotManager()

const snapshotId = await manager.createSnapshot({
  name: 'Before migration',
  metadata: {
    scriptId: 'migrate-db',
    reason: 'safety checkpoint'
  }
})

console.log(`Snapshot created: ${snapshotId}`)
```

##### `listSnapshots()`

List all snapshots.

```typescript
async listSnapshots(): Promise<Snapshot[]>
```

**Returns**: Array of snapshots

**Example**:
```typescript
const snapshots = await manager.listSnapshots()

snapshots.forEach(s => {
  console.log(`${s.name} (${s.id})`)
  console.log(`  Created: ${s.createdAt}`)
  console.log(`  Files: ${s.fileCount}`)
  console.log(`  Size: ${s.size} bytes`)
})
```

##### `restoreSnapshot(snapshotId)`

Restore from a snapshot.

```typescript
async restoreSnapshot(snapshotId: string): Promise<void>
```

**Parameters**:
- `snapshotId`: Snapshot identifier

**Example**:
```typescript
try {
  await manager.restoreSnapshot(snapshotId)
  console.log('✅ Snapshot restored successfully')
} catch (error) {
  console.error('❌ Restore failed:', error.message)
}
```

##### `deleteSnapshot(snapshotId)`

Delete a snapshot.

```typescript
async deleteSnapshot(snapshotId: string): Promise<void>
```

**Parameters**:
- `snapshotId`: Snapshot identifier

**Example**:
```typescript
await manager.deleteSnapshot(snapshotId)
console.log('Snapshot deleted')
```

### Types

```typescript
interface Snapshot {
  id: string                      // Snapshot ID
  name: string                    // Snapshot name
  createdAt: Date                 // Creation timestamp
  fileCount: number               // Number of files
  size: number                    // Total size (bytes)
  metadata?: Record<string, any>  // Additional metadata
}
```

## Dependency Analyzer API

Analyze script dependencies and detect cycles.

### Class: `DependencyAnalyzer`

#### Constructor

```typescript
constructor()
```

#### Methods

##### `analyze()`

Analyze all script dependencies.

```typescript
async analyze(): Promise<DependencyGraph>
```

**Returns**: Dependency graph

**Example**:
```typescript
import { DependencyAnalyzer } from './scripts/lib/visualization/dependency-analyzer.js'

const analyzer = new DependencyAnalyzer()
const graph = await analyzer.analyze()

console.log(`Scripts: ${graph.nodes.length}`)
console.log(`Dependencies: ${graph.edges.length}`)
```

##### `findCircularDependencies()`

Find circular dependencies.

```typescript
async findCircularDependencies(): Promise<string[][]>
```

**Returns**: Array of circular dependency chains

**Example**:
```typescript
const cycles = await analyzer.findCircularDependencies()

if (cycles.length > 0) {
  console.log('⚠️  Circular dependencies found:')
  cycles.forEach(cycle => {
    console.log(`  ${cycle.join(' → ')}`)
  })
} else {
  console.log('✅ No circular dependencies')
}
```

##### `generateMermaidDiagram()`

Generate Mermaid diagram of dependencies.

```typescript
async generateMermaidDiagram(): Promise<string>
```

**Returns**: Mermaid diagram syntax

**Example**:
```typescript
const diagram = await analyzer.generateMermaidDiagram()
console.log(diagram)

// Save to file
await fs.writeFile('dependencies.mmd', diagram)
```

### Types

```typescript
interface DependencyGraph {
  nodes: GraphNode[]              // All scripts
  edges: GraphEdge[]              // Dependencies
}

interface GraphNode {
  id: string                      // Script ID
  label: string                   // Display name
  category: string                // Script category
}

interface GraphEdge {
  from: string                    // Source script
  to: string                      // Target script
  type: 'import' | 'require'      // Import type
}
```

## Usage Analytics API

Track and analyze script usage patterns.

### Class: `UsageAnalytics`

#### Constructor

```typescript
constructor()
```

#### Methods

##### `getDashboard(options?)`

Get analytics dashboard.

```typescript
async getDashboard(options?: DashboardOptions): Promise<Dashboard>
```

**Parameters**:
```typescript
interface DashboardOptions {
  startDate?: Date                // Start of date range
  endDate?: Date                  // End of date range
  groupBy?: 'hour' | 'day' | 'week' | 'month'
}
```

**Returns**: Analytics dashboard

**Example**:
```typescript
import { UsageAnalytics } from './scripts/lib/analytics/usage-analytics.js'

const analytics = new UsageAnalytics()

const dashboard = await analytics.getDashboard({
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  groupBy: 'day'
})

console.log(`Total Executions: ${dashboard.totalExecutions}`)
console.log(`Success Rate: ${dashboard.overallSuccessRate}%`)
console.log(`Most Used: ${dashboard.mostUsedScript}`)

console.log('\nTop Scripts:')
dashboard.topScripts.forEach((s, i) => {
  console.log(`${i + 1}. ${s.name}: ${s.executions} executions`)
})
```

##### `getScriptStats(scriptId, options?)`

Get statistics for a specific script.

```typescript
async getScriptStats(
  scriptId: string,
  options?: StatsOptions
): Promise<ScriptStats>
```

**Parameters**:
```typescript
interface StatsOptions {
  days?: number                   // Number of days (default: 30)
  groupBy?: 'hour' | 'day' | 'week'
}
```

**Returns**: Script statistics

**Example**:
```typescript
const stats = await analytics.getScriptStats('my-script', {
  days: 7,
  groupBy: 'day'
})

console.log(`Executions: ${stats.totalExecutions}`)
console.log(`Success Rate: ${stats.successRate}%`)
console.log(`Trend: ${stats.trend}`)

stats.executionsByDay.forEach(day => {
  console.log(`${day.date}: ${day.count} executions`)
})
```

### Types

```typescript
interface Dashboard {
  totalExecutions: number         // Total executions
  overallSuccessRate: number      // Overall success %
  mostUsedScript: string          // Most executed
  topScripts: ScriptUsage[]       // Top scripts
  executionsByPeriod: TimeSeriesData[]
  failurePatterns: FailurePattern[]
}

interface ScriptStats {
  scriptId: string                // Script identifier
  totalExecutions: number         // Total runs
  successRate: number             // Success %
  averageDuration: number         // Mean duration
  trend: 'up' | 'stable' | 'down' // Usage trend
  executionsByDay: DailyStats[]   // Daily breakdown
  commonErrors: ErrorFrequency[]  // Error patterns
}
```

## EnhancedCLI Base Class

Base class for all enhanced scripts.

### Class: `EnhancedCLI`

#### Constructor

```typescript
constructor()
```

#### Protected Properties

```typescript
protected scriptId: string              // Auto-set from filename
protected dryRun: boolean               // Dry-run mode flag
protected enableValidation: boolean     // Enable validation
protected enableSnapshots: boolean      // Enable snapshots
protected enableProfiling: boolean      // Enable profiling
protected supportsDryRun: boolean       // Supports dry-run
protected autoRollbackOnError: boolean  // Auto-restore on error
```

#### Protected Methods

```typescript
// Profiling
protected markPhase(name: string, options?: PhaseOptions): void

// Logging
protected log(message: string): void
protected logWarning(message: string): void
protected logError(message: string): void

// Validation
protected async customValidation(): Promise<void>

// Lifecycle hooks
protected async preValidate(): Promise<void>
protected async postValidate(): Promise<void>
protected async preSnapshot(): Promise<void>
protected async postSnapshot(): Promise<void>
protected async preExecute(): Promise<void>
protected async postExecute(): Promise<void>
protected async onError(error: Error): Promise<void>
protected async onSuccess(): Promise<void>
protected async cleanup(): Promise<void>

// Main execution (must override)
protected abstract execute(): Promise<void>
```

#### Usage Example

```typescript
import { EnhancedCLI, runEnhancedCLI } from './scripts/cli/_base-enhanced.js'

class MyScript extends EnhancedCLI {
  // Configure features
  protected enableValidation = true
  protected enableSnapshots = true
  protected enableProfiling = true
  protected supportsDryRun = true

  // Custom validation
  protected async customValidation() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL required')
    }
  }

  // Lifecycle hooks
  protected async preExecute() {
    this.log('Starting execution...')
  }

  protected async onError(error: Error) {
    this.logError(`Execution failed: ${error.message}`)
  }

  // Main execution
  async execute() {
    this.markPhase('initialization')
    await this.initialize()

    this.markPhase('processing')
    if (this.dryRun) {
      this.log('[DRY-RUN] Would process data')
      return
    }
    await this.processData()

    this.markPhase('finalization')
    await this.finalize()
  }
}

runEnhancedCLI(MyScript)
```

## Type Definitions

### Common Types

```typescript
// Result types
interface Result<T> {
  success: boolean
  data?: T
  error?: string
}

// Metadata
interface Metadata {
  [key: string]: any
}

// Date range
interface DateRange {
  startDate: Date
  endDate: Date
}

// Pagination
interface PaginationOptions {
  limit?: number
  offset?: number
}
```

## Error Handling

### ScriptError

Structured error with context and suggestions.

```typescript
import { ScriptError } from './scripts/lib/errors/script-error.js'

class ScriptError extends Error {
  constructor(
    message: string,
    options?: {
      code?: string
      suggestion?: string
      fix?: string
      context?: Record<string, any>
    }
  )
}

// Usage
throw new ScriptError(
  'Database connection failed',
  {
    code: 'DB_CONNECTION_ERROR',
    suggestion: 'Check DATABASE_URL environment variable',
    fix: 'npm run db:start',
    context: { url: process.env.DATABASE_URL }
  }
)
```

### Error Types

```typescript
// Common error codes
type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'SNAPSHOT_FAILED'
  | 'EXECUTION_FAILED'
  | 'ROLLBACK_FAILED'
  | 'DATABASE_ERROR'
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
```

## Complete Examples

### Example 1: Script with Full Features

```typescript
import { EnhancedCLI, runEnhancedCLI } from './scripts/cli/_base-enhanced.js'
import { ScriptError } from './scripts/lib/errors/script-error.js'

class DatabaseMigration extends EnhancedCLI {
  // Enable all features
  protected enableValidation = true
  protected enableSnapshots = true
  protected enableProfiling = true
  protected supportsDryRun = true
  protected autoRollbackOnError = true

  // Custom validation
  protected async customValidation() {
    if (!process.env.DATABASE_URL) {
      throw new ScriptError(
        'DATABASE_URL is required',
        {
          code: 'MISSING_ENV_VAR',
          suggestion: 'Set DATABASE_URL in .env file',
          fix: 'cp .env.example .env'
        }
      )
    }
  }

  // Main execution
  async execute() {
    this.markPhase('connect')
    const db = await this.connectDatabase()

    this.markPhase('migrate-schema')
    if (this.dryRun) {
      this.log('[DRY-RUN] Would run schema migrations')
    } else {
      await db.migrate()
    }

    this.markPhase('seed-data')
    if (this.dryRun) {
      this.log('[DRY-RUN] Would seed test data')
    } else {
      await db.seed()
    }

    this.markPhase('verify')
    await db.verify()

    this.log('Migration completed successfully')
  }
}

runEnhancedCLI(DatabaseMigration)
```

### Example 2: Using Multiple APIs

```typescript
import { ScriptRegistry } from './scripts/lib/registry/script-registry.js'
import { ExecutionLogger } from './scripts/lib/audit/execution-logger.js'
import { ScriptHealthMonitor } from './scripts/lib/monitoring/script-health.js'

async function analyzeScriptHealth() {
  const registry = new ScriptRegistry()
  const logger = new ExecutionLogger()
  const monitor = new ScriptHealthMonitor()

  // Get all scripts
  const scripts = await registry.getAllScripts()
  console.log(`Analyzing ${scripts.length} scripts...`)

  // Check health for each
  for (const script of scripts) {
    const health = await monitor.getScriptHealth(script.name)
    const stats = await logger.getExecutionStats(script.name, 7)

    console.log(`\n${script.name}:`)
    console.log(`  Status: ${health.status}`)
    console.log(`  Success Rate: ${health.successRate}%`)
    console.log(`  Executions (7d): ${stats.totalExecutions}`)
    console.log(`  Avg Duration: ${stats.averageDuration}ms`)

    if (health.alerts.length > 0) {
      console.log(`  ⚠️  ${health.alerts.length} active alerts`)
    }
  }
}

analyzeScriptHealth()
```

---

For usage guides and CLI reference, see [SCRIPT_MANAGEMENT.md](./SCRIPT_MANAGEMENT.md).

For version history, see [CHANGELOG_SCRIPT_MANAGEMENT.md](./CHANGELOG_SCRIPT_MANAGEMENT.md).
