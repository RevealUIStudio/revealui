# @revealui/sync

ElectricSQL sync utilities for RevealUI  -  real-time data synchronization with local-first architecture.

## Features

- **ElectricSQL Integration**: Real-time sync via shape subscriptions
- **React Hooks**: Subscribe to synced data in React components
- **Mutations**: Create, update, and delete records via authenticated REST endpoints
- **Type-safe**: Full TypeScript support with database types
- **React Provider**: Easy setup with `ElectricProvider`
- **Yjs Collaboration**: CRDT-based real-time collaborative editing

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
    <ElectricProvider proxyBaseUrl="https://admin.revealui.com">
      <YourComponents />
    </ElectricProvider>
  )
}
```

### Read Synced Data

Hooks subscribe to ElectricSQL shapes via authenticated proxy routes. Data updates in real-time as the database changes.

```typescript
import { useAgentContexts } from '@revealui/sync'

function MyComponent() {
  const { contexts, isLoading } = useAgentContexts()

  if (isLoading) return <div>Loading...</div>

  return (
    <ul>
      {contexts.map(context => (
        <li key={context.id}>{JSON.stringify(context.context)}</li>
      ))}
    </ul>
  )
}
```

### Mutations

Each hook returns `create`, `update`, and `remove` functions. Mutations go through authenticated REST endpoints at `/api/sync/*`. ElectricSQL picks up the database changes and pushes updates to all subscribers automatically.

```typescript
import { useAgentContexts } from '@revealui/sync'

function CreateContext() {
  const { contexts, create, update, remove } = useAgentContexts()

  const handleCreate = async () => {
    const result = await create({
      agent_id: 'assistant',
      context: { theme: 'dark', language: 'en' },
      priority: 0.8,
    })
    if (!result.success) console.error(result.error)
  }

  const handleUpdate = async (id: string) => {
    await update(id, { context: { theme: 'light' } })
  }

  const handleDelete = async (id: string) => {
    await remove(id)
  }

  return <button onClick={handleCreate}>Create</button>
}
```

## Available Hooks

### `useAgentContexts()`

Subscribe to agent contexts (task context, working memory).

```typescript
const {
  contexts,    // AgentContextRecord[]
  isLoading,   // boolean
  error,       // Error | null
  create,      // (data: CreateAgentContextInput) => Promise<MutationResult>
  update,      // (id: string, data: UpdateAgentContextInput) => Promise<MutationResult>
  remove,      // (id: string) => Promise<MutationResult>
} = useAgentContexts()
```

### `useAgentMemory(agentId)`

Subscribe to agent memory (episodic, semantic, working) filtered by agent ID.

```typescript
const {
  memories,    // AgentMemoryRecord[]
  isLoading,   // boolean
  error,       // Error | null
  create,      // (data: CreateAgentMemoryInput) => Promise<MutationResult>
  update,      // (id: string, data: UpdateAgentMemoryInput) => Promise<MutationResult>
  remove,      // (id: string) => Promise<MutationResult>
} = useAgentMemory('assistant')
```

### `useConversations(userId)`

Subscribe to conversation history. Server-side proxy enforces row-level filtering by session  -  the `userId` parameter is for API compatibility but filtering is handled server-side.

```typescript
const {
  conversations,  // ConversationRecord[]
  isLoading,      // boolean
  error,          // Error | null
  create,         // (data: CreateConversationInput) => Promise<MutationResult>
  update,         // (id: string, data: UpdateConversationInput) => Promise<MutationResult>
  remove,         // (id: string) => Promise<MutationResult>
} = useConversations(userId)
```

## How It Works

1. **Reads**: ElectricSQL shape subscriptions via authenticated CMS proxy (`/api/shapes/*`)
2. **Writes**: REST mutations via CMS API (`/api/sync/*`) → Postgres → ElectricSQL replication
3. **Real-time**: Database changes propagate to all shape subscribers automatically
4. **Auth**: All endpoints require a valid session cookie

## Collaboration (Yjs)

The collab layer provides CRDT-based collaborative editing:

```typescript
import { useCollaboration } from '@revealui/sync'

function Editor() {
  const { doc, synced, connectedUsers } = useCollaboration({
    documentId: 'doc-uuid',
    serverUrl: 'ws://localhost:4000',
  })
  // ...
}
```

Server-side agents can use `AgentCollabClient` from `@revealui/sync/collab/server`.

## Environment Variables

```env
# ElectricSQL service URL (used by CMS proxy)
ELECTRIC_SERVICE_URL=http://localhost:5133

# Optional: Electric auth secret
ELECTRIC_SECRET=your-secret

# Client-side (stored in provider context)
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133
```

## Development

```bash
pnpm --filter @revealui/sync build      # Build
pnpm --filter @revealui/sync dev        # Watch mode
pnpm --filter @revealui/sync test       # Run tests
pnpm --filter @revealui/sync typecheck  # Type check
```

## When to Use This

- You need real-time data sync between your database and React UI via ElectricSQL
- You want CRDT-based collaborative editing (Yjs) for multi-user document workflows
- You need React hooks that subscribe to live database changes with automatic mutation support
- **Not** for batch data loading or static pages  -  use server components with `@revealui/db` directly
- **Not** for offline-first mobile apps  -  ElectricSQL targets web clients with persistent connections

## JOSHUA Alignment

- **Adaptive**: Shape subscriptions dynamically sync only the data your component needs  -  scales from one user to many
- **Sovereign**: Sync runs through your own CMS proxy and PostgreSQL  -  no third-party real-time service required
- **Hermetic**: All mutations go through authenticated REST endpoints; ElectricSQL replication is read-only on the client

## License

MIT
