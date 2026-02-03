# @revealui/sync

**Status:** 🟡 Active Development | ⚠️ NOT Production Ready

See [Project Status](../../docs/PROJECT_STATUS.md) for framework readiness.

ElectricSQL sync utilities for RevealUI - real-time data synchronization with local-first architecture.

## Features

- **ElectricSQL Integration**: Real-time sync with ElectricSQL
- **React Hooks**: Use sync data in React components
- **Type-safe**: Full TypeScript support with database types
- **Local-first**: Works offline, syncs when online
- **React Provider**: Easy setup with `ElectricProvider`
- **Optimistic Updates**: Instant UI updates with server reconciliation

## Installation

```bash
pnpm add @revealui/sync
```

## Usage

### Setup Provider

Wrap your app with `ElectricProvider`:

```typescript
import { ElectricProvider } from '@revealui/sync/provider'

export default function App() {
  return (
    <ElectricProvider>
      <YourComponents />
    </ElectricProvider>
  )
}
```

### Use Synced Data

```typescript
import { useAgentContexts } from '@revealui/sync'

function MyComponent() {
  const { data: contexts, isLoading } = useAgentContexts()

  if (isLoading) return <div>Loading...</div>

  return (
    <ul>
      {contexts.map(context => (
        <li key={context.id}>{context.name}</li>
      ))}
    </ul>
  )
}
```

### Mutations

```typescript
import { useAgentContexts } from '@revealui/sync'

function CreateContext() {
  const { create } = useAgentContexts()

  const handleCreate = async () => {
    await create({
      name: 'New Context',
      agent_id: 'agent-123',
      // ... other fields
    })
  }

  return <button onClick={handleCreate}>Create</button>
}
```

## Available Hooks

### `useAgentContexts()`

Sync agent contexts (task context, working memory, etc.)

```typescript
const {
  data,        // Agent contexts array
  isLoading,   // Loading state
  error,       // Error state
  create,      // Create function
  update,      // Update function
  remove       // Delete function
} = useAgentContexts()
```

### `useAgentMemory()`

Sync agent memory (episodic, semantic, working)

```typescript
const {
  data,        // Memory entries array
  isLoading,
  error,
  create,
  update,
  remove
} = useAgentMemory()
```

### `useConversations()`

Sync conversation history

```typescript
const {
  data,        // Conversations array
  isLoading,
  error,
  create,
  update,
  remove
} = useConversations()
```

## How It Works

1. **ElectricSQL Service**: Runs as a sync service between Postgres and clients
2. **Shape Subscriptions**: Subscribe to "shapes" of data (queries)
3. **Local Cache**: Data cached locally in browser
4. **Real-time Updates**: Changes propagate instantly to all connected clients
5. **Conflict Resolution**: CRDT-based conflict resolution for offline edits

## Environment Variables

```env
# ElectricSQL service URL
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# Optional: Server-side Electric URL (if different)
ELECTRIC_SERVICE_URL=http://localhost:5133
```

## Development

```bash
# Build package
pnpm --filter @revealui/sync build

# Watch mode
pnpm --filter @revealui/sync dev

# Run tests
pnpm --filter @revealui/sync test

# Type check
pnpm --filter @revealui/sync typecheck
```

## Testing

```bash
# Run all tests
pnpm --filter @revealui/sync test

# Watch mode
pnpm --filter @revealui/sync test:watch

# Coverage
pnpm --filter @revealui/sync test:coverage
```

## Architecture

```
┌─────────────────┐
│  React Component │
│  (useAgentContexts) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ElectricSQL    │
│  Shape Hook     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Electric Sync  │
│  Service        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  Database       │
└─────────────────┘
```

## Limitations

⚠️ **CRITICAL**: ElectricSQL API endpoints need independent verification before production use.

**Status:** ⚠️ NEEDS VERIFICATION
- ElectricSQL integration exists but requires testing
- API endpoints based on assumptions
- No integration tests performed yet
- Not recommended for production until verified

See [Project Roadmap](../../docs/PROJECT_ROADMAP.md) and [Production Readiness](../../docs/PRODUCTION_READINESS.md) for details.

## Related Documentation

- [ElectricSQL Documentation](https://electric-sql.com/docs) - Official ElectricSQL docs
- [Architecture](../../docs/ARCHITECTURE.md) - System architecture overview
- [Database Guide](../../docs/DATABASE.md) - Database setup

## License

MIT
