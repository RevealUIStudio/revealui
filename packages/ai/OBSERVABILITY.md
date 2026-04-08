# RevealUI AI Observability

Comprehensive observability system for tracking agent operations, decisions, tool usage, and LLM calls.

## Overview

The observability system provides:

- **Event Logging**: Track all agent operations with structured events
- **Metrics Collection**: Aggregate statistics for monitoring and analysis
- **Storage Backends**: Persist events to memory, localStorage, or filesystem
- **Query Interface**: Filter and retrieve events by various criteria
- **Zero Dependencies**: Lightweight implementation without OpenTelemetry

## Quick Start

```typescript
import {
  AgentEventLogger,
  AgentMetricsCollector,
  MemoryEventStorage,
} from '@revealui/ai/observability'

// Create logger with in-memory storage
const logger = new AgentEventLogger({
  maxEvents: 1000, // Circular buffer size
  storage: new MemoryEventStorage(),
  autoFlush: true,
  flushIntervalMs: 60000, // Flush every minute
})

// Create metrics collector
const metrics = new AgentMetricsCollector(logger)

// Log agent operations
logger.logDecision({
  timestamp: Date.now(),
  agentId: 'researcher-agent',
  sessionId: 'session-123',
  reasoning: 'Need to search for recent papers',
  chosenTool: 'arxiv-search',
  confidence: 0.95,
})

logger.logToolCall({
  timestamp: Date.now(),
  agentId: 'researcher-agent',
  sessionId: 'session-123',
  toolName: 'arxiv-search',
  params: { query: 'transformer architecture' },
  durationMs: 245,
  success: true,
  result: { papers: 15 },
})

logger.logLLMCall({
  timestamp: Date.now(),
  agentId: 'researcher-agent',
  sessionId: 'session-123',
  provider: 'anthropic',
  model: 'claude-3-opus',
  promptTokens: 1250,
  completionTokens: 420,
  durationMs: 1850,
  cost: 0.048,
})

// Get metrics
const agentMetrics = metrics.getMetrics('researcher-agent')
console.log(`Success rate: ${agentMetrics.successRate.toFixed(2)}%`)
console.log(`Total LLM cost: $${agentMetrics.llmMetrics.totalCost}`)
```

## Event Types

### Base Event

All events extend the base `AgentEvent` interface:

```typescript
interface AgentEvent {
  timestamp: number // Unix timestamp in milliseconds
  eventType: 'decision' | 'tool_call' | 'llm_call' | 'error'
  agentId: string // Unique agent identifier
  sessionId: string // Session/conversation ID
  taskId?: string // Optional task ID
}
```

### Decision Event

Tracks agent reasoning and tool selection:

```typescript
interface DecisionEvent extends AgentEvent {
  eventType: 'decision'
  reasoning: string // Why this decision was made
  chosenTool?: string // Tool selected for execution
  confidence?: number // Confidence score (0-1)
  context?: Record<string, unknown> // Additional context
}
```

**Example**:
```typescript
logger.logDecision({
  timestamp: Date.now(),
  agentId: 'coding-agent',
  sessionId: 'session-456',
  reasoning: 'User wants to create a React component',
  chosenTool: 'code-generator',
  confidence: 0.88,
  context: {
    framework: 'react',
    typescript: true,
  },
})
```

### Tool Call Event

Tracks tool invocations and results:

```typescript
interface ToolCallEvent extends AgentEvent {
  eventType: 'tool_call'
  toolName: string // Name of the tool
  params: Record<string, unknown> // Tool parameters
  result?: unknown // Tool result (if successful)
  durationMs: number // Execution time
  success: boolean // Success/failure flag
  errorMessage?: string // Error message if failed
}
```

**Example**:
```typescript
logger.logToolCall({
  timestamp: Date.now(),
  agentId: 'coding-agent',
  sessionId: 'session-456',
  toolName: 'code-generator',
  params: {
    type: 'react-component',
    name: 'UserProfile',
  },
  result: { code: '/* ... */', files: 3 },
  durationMs: 842,
  success: true,
})
```

### LLM Call Event

Tracks language model usage:

```typescript
interface LLMCallEvent extends AgentEvent {
  eventType: 'llm_call'
  provider: string // 'openai', 'anthropic', etc.
  model: string // Model name
  promptTokens: number // Input tokens
  completionTokens: number // Output tokens
  durationMs: number // Request duration
  cost?: number // Cost in USD
  cacheHit?: boolean // Whether cache was used
}
```

**Example**:
```typescript
logger.logLLMCall({
  timestamp: Date.now(),
  agentId: 'coding-agent',
  sessionId: 'session-456',
  provider: 'openai',
  model: 'gpt-4-turbo',
  promptTokens: 2340,
  completionTokens: 856,
  durationMs: 2150,
  cost: 0.064,
  cacheHit: false,
})
```

### Error Event

Tracks failures and exceptions:

```typescript
interface ErrorEvent extends AgentEvent {
  eventType: 'error'
  message: string // Error message
  stack?: string // Stack trace
  recoverable: boolean // Can agent continue?
  errorCode?: string // Error code
  context?: Record<string, unknown> // Error context
}
```

**Example**:
```typescript
logger.logError({
  timestamp: Date.now(),
  agentId: 'coding-agent',
  sessionId: 'session-456',
  message: 'API rate limit exceeded',
  recoverable: true,
  errorCode: 'RATE_LIMIT_ERROR',
  context: {
    retryAfter: 60,
    endpoint: '/v1/chat/completions',
  },
})
```

## Storage Backends

### Memory Storage (Default)

In-memory storage with no persistence:

```typescript
import { MemoryEventStorage } from '@revealui/ai/observability'

const storage = new MemoryEventStorage()
const logger = new AgentEventLogger({ storage })
```

**Use case**: Development, testing, short-lived processes

### LocalStorage (Browser)

Persist events to browser localStorage:

```typescript
import { LocalStorageEventStorage } from '@revealui/ai/observability'

const storage = new LocalStorageEventStorage('my-app:agent:events')
const logger = new AgentEventLogger({ storage })
```

**Use case**: Browser applications, cross-page persistence

### FileSystem Storage (Node.js)

Persist events to JSON files:

```typescript
import { FileSystemEventStorage } from '@revealui/ai/observability'

const storage = new FileSystemEventStorage('./logs/agent-events.json')
const logger = new AgentEventLogger({ storage })
```

**Use case**: Server applications, long-term logging

## Querying Events

### Filter by Criteria

```typescript
// Get all events for a specific agent
const agentEvents = logger.getEvents({
  agentId: 'researcher-agent',
})

// Get events in a time range
const recentEvents = logger.getEvents({
  startTime: Date.now() - 3600000, // Last hour
  endTime: Date.now(),
})

// Get specific event types
const decisions = logger.getEvents({
  eventType: 'decision',
  sessionId: 'session-123',
})

// Combine filters
const errorEvents = logger.getEvents({
  agentId: 'researcher-agent',
  eventType: 'error',
  startTime: Date.now() - 86400000, // Last 24 hours
})
```

### Get Recent Events

```typescript
// Get last 10 events
const recent = logger.getRecentEvents(10)
```

### Get by Type

```typescript
const decisions = logger.getDecisions()
const toolCalls = logger.getToolCalls()
const llmCalls = logger.getLLMCalls()
const errors = logger.getErrors()
```

## Metrics Collection

### Agent Metrics

```typescript
const metrics = collector.getMetrics('researcher-agent')

console.log('Performance Metrics:')
console.log(`- Total decisions: ${metrics.totalDecisions}`)
console.log(`- Total tool calls: ${metrics.totalToolCalls}`)
console.log(`- Total LLM calls: ${metrics.totalLLMCalls}`)
console.log(`- Total errors: ${metrics.totalErrors}`)
console.log(`- Success rate: ${metrics.successRate.toFixed(2)}%`)
console.log(`- Error rate: ${metrics.errorRate.toFixed(2)}%`)
console.log(`- Avg decision time: ${metrics.averageDecisionTime}ms`)
console.log(`- Uptime: ${metrics.uptime}ms`)
```

### Tool Metrics

```typescript
const metrics = collector.getMetrics('researcher-agent')

metrics.toolMetrics.forEach((tool, name) => {
  console.log(`Tool: ${name}`)
  console.log(`  - Total calls: ${tool.totalCalls}`)
  console.log(`  - Success: ${tool.successCount}`)
  console.log(`  - Failures: ${tool.failureCount}`)
  console.log(`  - Avg duration: ${tool.averageDurationMs}ms`)
  console.log(`  - Last used: ${new Date(tool.lastUsed).toISOString()}`)
})
```

### LLM Metrics

```typescript
const metrics = collector.getMetrics('researcher-agent')
const llm = metrics.llmMetrics

console.log('LLM Usage:')
console.log(`- Total calls: ${llm.totalCalls}`)
console.log(`- Prompt tokens: ${llm.totalPromptTokens}`)
console.log(`- Completion tokens: ${llm.totalCompletionTokens}`)
console.log(`- Total cost: $${llm.totalCost.toFixed(4)}`)
console.log(`- Avg duration: ${llm.averageDurationMs}ms`)
console.log(`- Cache hit rate: ${llm.cacheHitRate.toFixed(2)}%`)

console.log('\nModel Usage:')
Object.entries(llm.modelUsage).forEach(([model, count]) => {
  console.log(`  - ${model}: ${count} calls`)
})
```

### Summary Metrics

```typescript
const summary = collector.getMetricsSummary()

console.log('System Summary:')
console.log(`- Total events: ${summary.totalEvents}`)
console.log(`- Active agents: ${summary.activeAgents}`)
console.log(`- Active sessions: ${summary.activeSessions}`)
console.log(`- Total tokens: ${summary.totalTokensUsed}`)
console.log(`- Total cost: $${summary.totalCost.toFixed(4)}`)
console.log(`- Avg success rate: ${summary.averageSuccessRate.toFixed(2)}%`)
console.log(`- Time range: ${new Date(summary.timeRange.start).toISOString()} to ${new Date(summary.timeRange.end).toISOString()}`)

console.log('\nEvents by Type:')
Object.entries(summary.eventsByType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`)
})
```

## Advanced Usage

### Auto-Flush to Storage

```typescript
const logger = new AgentEventLogger({
  maxEvents: 5000,
  storage: new FileSystemEventStorage('./logs/events.json'),
  autoFlush: true,
  flushIntervalMs: 300000, // Flush every 5 minutes
})

// Events are automatically persisted every 5 minutes
```

### Manual Flush

```typescript
// Flush events to storage on-demand
await logger.flush()
```

### Load from Storage

```typescript
// Load persisted events on startup
await logger.load()

// Load with filter
await logger.load({
  agentId: 'researcher-agent',
  startTime: Date.now() - 86400000,
})
```

### Clear Events

```typescript
// Clear in-memory buffer
logger.clear()

// Clear storage
if (logger.storage) {
  await logger.storage.clear()
}
```

### Cleanup

```typescript
// Stop auto-flush interval and cleanup resources
logger.destroy()
```

## Integration Patterns

### With Agent Orchestrator

```typescript
import { AgentOrchestrator } from '@revealui/ai/orchestration'
import { AgentEventLogger, AgentMetricsCollector } from '@revealui/ai/observability'

const logger = new AgentEventLogger()
const metrics = new AgentMetricsCollector(logger)

class ObservableOrchestrator extends AgentOrchestrator {
  constructor() {
    super()
    this.logger = logger
    this.metrics = metrics
  }

  async delegateTask(task: Task): Promise<AgentResult> {
    const startTime = Date.now()

    // Log decision
    this.logger.logDecision({
      timestamp: startTime,
      agentId: this.selectedAgent.id,
      sessionId: task.sessionId,
      taskId: task.id,
      reasoning: 'Selected based on tool availability',
      confidence: 0.9,
    })

    // Execute task
    const result = await super.delegateTask(task)

    // Log tool call
    this.logger.logToolCall({
      timestamp: Date.now(),
      agentId: this.selectedAgent.id,
      sessionId: task.sessionId,
      taskId: task.id,
      toolName: this.selectedAgent.name,
      params: task.input,
      result: result.output,
      durationMs: Date.now() - startTime,
      success: result.success,
    })

    return result
  }
}
```

### With LLM Client

```typescript
import { LLMClient } from '@revealui/ai/llm'
import { AgentEventLogger } from '@revealui/ai/observability'

class ObservableLLMClient extends LLMClient {
  constructor(private logger: AgentEventLogger) {
    super()
  }

  async chat(messages: Message[]): Promise<ChatResult> {
    const startTime = Date.now()

    try {
      const result = await super.chat(messages)

      this.logger.logLLMCall({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        provider: this.provider,
        model: this.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        durationMs: Date.now() - startTime,
        cost: this.calculateCost(result.usage),
        cacheHit: result.cacheHit,
      })

      return result
    } catch (error) {
      this.logger.logError({
        timestamp: Date.now(),
        agentId: this.agentId,
        sessionId: this.sessionId,
        message: error.message,
        stack: error.stack,
        recoverable: false,
        errorCode: 'LLM_ERROR',
      })
      throw error
    }
  }
}
```

## Environment Configuration

Control observability behavior via environment variables:

```bash
# Enable/disable logging
REVEALUI_AGENT_LOGGING=true

# Set max events
REVEALUI_AGENT_MAX_EVENTS=5000

# Set flush interval (ms)
REVEALUI_AGENT_FLUSH_INTERVAL=300000

# Set storage path (Node.js)
REVEALUI_AGENT_LOG_PATH=./logs/agent-events.json
```

```typescript
const logger = new AgentEventLogger({
  maxEvents: parseInt(process.env.REVEALUI_AGENT_MAX_EVENTS || '1000'),
  storage: process.env.REVEALUI_AGENT_LOG_PATH
    ? new FileSystemEventStorage(process.env.REVEALUI_AGENT_LOG_PATH)
    : new MemoryEventStorage(),
  autoFlush: process.env.REVEALUI_AGENT_LOGGING === 'true',
  flushIntervalMs: parseInt(process.env.REVEALUI_AGENT_FLUSH_INTERVAL || '60000'),
})
```

## Best Practices

### 1. Use Appropriate Storage

- **Development**: `MemoryEventStorage` for fast iteration
- **Browser Apps**: `LocalStorageEventStorage` for persistence
- **Server Apps**: `FileSystemEventStorage` for audit trails

### 2. Set Reasonable Buffer Sizes

```typescript
// Low memory environments
const logger = new AgentEventLogger({ maxEvents: 500 })

// High-traffic production
const logger = new AgentEventLogger({ maxEvents: 10000 })
```

### 3. Enable Auto-Flush for Long-Running Processes

```typescript
const logger = new AgentEventLogger({
  storage: new FileSystemEventStorage('./logs/events.json'),
  autoFlush: true,
  flushIntervalMs: 300000, // 5 minutes
})
```

### 4. Clean Up Resources

```typescript
// In your shutdown handler
process.on('SIGTERM', async () => {
  await logger.flush() // Save pending events
  logger.destroy() // Stop intervals
  process.exit(0)
})
```

### 5. Monitor Key Metrics

```typescript
setInterval(() => {
  const summary = metrics.getMetricsSummary()

  // Alert on high error rate
  if (summary.averageSuccessRate < 90) {
    console.warn(`Low success rate: ${summary.averageSuccessRate}%`)
  }

  // Alert on high LLM costs
  if (summary.totalCost > 100) {
    console.warn(`High LLM costs: $${summary.totalCost}`)
  }
}, 60000) // Check every minute
```

## Performance Considerations

### Circular Buffer

The logger uses a circular buffer to maintain a fixed memory footprint:

```typescript
// Only last 1000 events kept in memory
const logger = new AgentEventLogger({ maxEvents: 1000 })
```

### Async Storage

All storage operations are asynchronous and non-blocking:

```typescript
// Flush doesn't block event logging
await logger.flush() // Runs in background
```

### Minimal Overhead

- Event logging: ~0.1ms per event
- Metrics calculation: ~1ms for 1000 events
- No external dependencies

## Troubleshooting

### Events Not Persisting

```typescript
// Ensure storage is configured
const storage = new FileSystemEventStorage('./logs/events.json')
const logger = new AgentEventLogger({ storage })

// Manually flush
await logger.flush()
```

### Buffer Overflow

```typescript
// Increase buffer size
const logger = new AgentEventLogger({ maxEvents: 10000 })

// Or enable auto-flush
const logger = new AgentEventLogger({
  maxEvents: 1000,
  storage: new FileSystemEventStorage('./logs/events.json'),
  autoFlush: true,
  flushIntervalMs: 60000,
})
```

### High Memory Usage

```typescript
// Reduce buffer size
const logger = new AgentEventLogger({ maxEvents: 500 })

// Clear periodically
setInterval(() => {
  logger.clear()
}, 3600000) // Clear every hour
```

## Next Steps

- See [Task 2.2: Instrument Agent Operations](../docs/TASK_2_2.md) for integration examples
- See [Task 2.3: Query Interface](../docs/TASK_2_3.md) for visualization tools
- Check [examples/observability](../examples/observability/) for complete examples

## API Reference

See [type definitions](./src/observability/types.ts) for complete API documentation.
