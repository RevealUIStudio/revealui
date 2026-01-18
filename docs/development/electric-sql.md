# ElectricSQL Integration

**Last Updated**: January 2025  
**Status**: ⚠️ **In Development** - Service integration validation in progress

## Overview

ElectricSQL is integrated into RevealUI to enable **real-time synchronization of agent-related data** across browser tabs, sessions, and windows. This provides seamless cross-tab/cross-session agent memory sharing.

**Important**: ElectricSQL is **NOT used for core RevealUI collections**. It is only used for agent-related tables:
- `agent_contexts`
- `agent_memories`
- `agent_conversations`

Core RevealUI collections (users, posts, pages, etc.) use standard Drizzle ORM with PostgreSQL and do NOT sync via ElectricSQL.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RevealUI Architecture                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Core Collections │         │ Agent Tables     │     │
│  │  (Posts, Pages,   │         │ (Contexts,       │     │
│  │   Users, etc.)    │         │  Memories)       │     │
│  └──────────────────┘         └──────────────────┘     │
│         │                               │                │
│         │                               │                │
│         ▼                               ▼                │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Drizzle ORM +   │         │  ElectricSQL +   │     │
│  │  PostgreSQL      │         │  PostgreSQL      │     │
│  │  (Direct)        │         │  (Synced)        │     │
│  └──────────────────┘         └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Points

1. **Separate Systems**: Core collections and agent tables use different sync mechanisms
2. **No Conflicts**: ElectricSQL doesn't affect core collection operations
3. **Hybrid Approach**: Agent data uses ElectricSQL for real-time sync; core collections use standard REST APIs

## Package: `@revealui/sync`

The ElectricSQL integration is provided by the `@revealui/sync` package.

**Location**: `packages/sync/`

**Status**: ⚠️ **33/73 tests passing** (tests that don't require services). **40 tests pending** (require CMS/ElectricSQL services running).

### Features

- ✅ Cross-tab synchronization
- ✅ Cross-session persistence
- ✅ Real-time updates via subscriptions
- ✅ Offline-first support
- ✅ TypeScript type safety
- ⚠️ Service integration validation in progress

## Setup

### 1. Prerequisites

1. **PostgreSQL Database**: ElectricSQL syncs from PostgreSQL
2. **ElectricSQL Service**: Running ElectricSQL service (via Docker)
3. **Schema Generation**: ElectricSQL schema must be generated from migrations

### 2. Environment Variables

Add to your `.env` file:

```env
# PostgreSQL connection (shared with ElectricSQL)
POSTGRES_URL=postgresql://user:password@host:5432/database

# ElectricSQL Service URL (server-side)
ELECTRIC_SERVICE_URL=http://localhost:5133

# ElectricSQL Service URL (client-side, Next.js)
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# Optional: ElectricSQL configuration
ELECTRIC_VERSION=latest
ELECTRIC_SERVICE_PORT=5133
ELECTRIC_PROXY_PORT=65432
ELECTRIC_WRITE_TO_PG_MODE=direct_writes
ELECTRIC_LOG_LEVEL=info
```

### 3. Start ElectricSQL Service

```bash
# Start ElectricSQL service using Docker Compose
pnpm electric:service:start

# Or manually
docker compose -f docker-compose.electric.yml up -d

# Check service status
pnpm electric:service:logs

# Stop service
pnpm electric:service:stop
```

The ElectricSQL service is configured in `docker-compose.electric.yml`:

- **Port**: `5133` (HTTP API)
- **Proxy Port**: `65432` (WebSocket proxy)
- **Image**: `electricsql/electric:latest` (configurable via `ELECTRIC_VERSION`)
- **Health Check**: `http://localhost:5133/health`

### 4. Generate ElectricSQL Schema

After setting up your PostgreSQL database and running migrations:

```bash
# Generate ElectricSQL schema from PostgreSQL migrations
pnpm electric:generate
```

This runs `pnpm dlx electric-sql generate` which:
- Connects to your PostgreSQL database
- Reads the agent table schemas
- Generates TypeScript types for ElectricSQL
- Updates the sync package with generated types

**Note**: The schema must be regenerated whenever agent table migrations change.

### 5. Enable ElectricSQL in App

Wrap your app with `ElectricProvider`:

```tsx
// apps/cms/app/layout.tsx or apps/web/src/app/layout.tsx
import { ElectricProvider } from '@revealui/sync/provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ElectricProvider serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}>
          {children}
        </ElectricProvider>
      </body>
    </html>
  )
}
```

## Usage

### Hooks

#### `useAgentContext(agentId, options?)`

Access agent context in real-time:

```tsx
import { useAgentContext } from '@revealui/sync/hooks'

function AgentComponent({ agentId }) {
  const { context, updateContext, refresh } = useAgentContext(agentId, {
    sessionId: 'session-123',
    enabled: true
  })

  return (
    <div>
      <h2>Agent Context</h2>
      <pre>{JSON.stringify(context, null, 2)}</pre>
      <button onClick={() => updateContext({ key: 'value' })}>
        Update Context
      </button>
    </div>
  )
}
```

#### `useAgentMemory(agentId, options?)`

Access agent memories in real-time:

```tsx
import { useAgentMemory } from '@revealui/sync/hooks'

function MemoryComponent({ agentId }) {
  const { memories, addMemory, refresh } = useAgentMemory(agentId, {
    siteId: 'site-456'
  })

  return (
    <div>
      <h2>Agent Memories</h2>
      <ul>
        {memories?.map((memory) => (
          <li key={memory.id}>{memory.content}</li>
        ))}
      </ul>
      <button onClick={() => addMemory({ content: 'New memory' })}>
        Add Memory
      </button>
    </div>
  )
}
```

### API Routes

ElectricSQL shapes are proxied through authenticated API routes:

#### `/api/shapes/agent-contexts`

Authenticated proxy for `agent_contexts` shape:

```typescript
// Server-side usage
const response = await fetch('/api/shapes/agent-contexts?agent_id=agent-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

#### `/api/shapes/conversations`

Authenticated proxy for `agent_conversations` shape:

```typescript
const response = await fetch('/api/shapes/conversations?agent_id=agent-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**Note**: These routes validate sessions and add row-level filtering before forwarding to ElectricSQL.

## Database Tables

ElectricSQL is enabled for these agent-related tables:

```sql
-- Enable ElectricSQL for agent tables
ALTER TABLE agent_contexts ENABLE ELECTRIC;
ALTER TABLE agent_memories ENABLE ELECTRIC;
ALTER TABLE agent_conversations ENABLE ELECTRIC;
```

See `docs/reference/database/electric.migrations.sql` for full migration scripts.

### Table Schemas

**agent_contexts**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `session_id` - Session identifier
- `context_data` - JSONB context data
- `created_at`, `updated_at` - Timestamps

**agent_memories**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `site_id` - Site identifier
- `memory_type` - Memory type (episodic, semantic, etc.)
- `content` - Text content
- `embedding_metadata` - JSONB embedding metadata
- `created_at`, `updated_at` - Timestamps

**agent_conversations**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `user_id` - User identifier
- `messages` - JSONB conversation messages
- `created_at`, `updated_at` - Timestamps

## How It Works

1. **PostgreSQL**: Agent tables stored in PostgreSQL
2. **ElectricSQL Service**: Monitors PostgreSQL for changes via replication
3. **Client Sync**: ElectricSQL client subscribes to shapes (query results)
4. **Real-time Updates**: Changes sync automatically to all connected clients
5. **Offline Support**: Data cached locally, syncs when online

### Shape Subscriptions

ElectricSQL uses "shapes" for efficient data synchronization:

```typescript
// Shape defines what data to sync
const shape = {
  selects: [
    { tablename: 'agent_contexts' },
    { tablename: 'agent_memories' }
  ],
  where: {
    agent_id: 'agent-123'
  }
}

// Subscribe to shape - automatically syncs changes
const { data } = useShape(shape)
```

## Configuration

### Docker Compose

The ElectricSQL service is configured in `docker-compose.electric.yml`:

```yaml
services:
  electric-sql:
    image: electricsql/electric:${ELECTRIC_VERSION:-latest}
    ports:
      - "${ELECTRIC_SERVICE_PORT:-5133}:5133"
      - "${ELECTRIC_PROXY_PORT:-65432}:65432"
    environment:
      - DATABASE_URL=${POSTGRES_URL}
      - ELECTRIC_WRITE_TO_PG_MODE=direct_writes
      - ELECTRIC_LOG_LEVEL=info
      - ELECTRIC_INSECURE=true  # Development only
```

**Important**: Set `ELECTRIC_INSECURE=false` and configure `ELECTRIC_SECRET` for production.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ELECTRIC_SERVICE_URL` | Server-side service URL | `http://localhost:5133` |
| `NEXT_PUBLIC_ELECTRIC_SERVICE_URL` | Client-side service URL | `http://localhost:5133` |
| `ELECTRIC_VERSION` | Docker image version | `latest` |
| `ELECTRIC_SERVICE_PORT` | HTTP API port | `5133` |
| `ELECTRIC_PROXY_PORT` | WebSocket proxy port | `65432` |
| `ELECTRIC_WRITE_TO_PG_MODE` | Write mode | `direct_writes` |
| `ELECTRIC_LOG_LEVEL` | Logging level | `info` |
| `ELECTRIC_INSECURE` | Development mode | `true` |

## Development

### Local Development

1. **Start PostgreSQL**: Ensure PostgreSQL is running
2. **Start ElectricSQL**: `pnpm electric:service:start`
3. **Generate Schema**: `pnpm electric:generate`
4. **Start App**: `pnpm dev`

### Testing

```bash
# Run ElectricSQL tests (requires service)
pnpm --filter @revealui/sync test

# Test service health
curl http://localhost:5133/health
```

**Note**: Many tests require the ElectricSQL service to be running. See `packages/sync/README.md` for test status.

### Debugging

```bash
# View ElectricSQL logs
pnpm electric:service:logs

# Check service health
curl http://localhost:5133/health

# View database tables
psql $POSTGRES_URL -c "SELECT * FROM agent_contexts LIMIT 10;"
```

## Production Considerations

### Security

1. **Authentication**: Configure JWT auth for ElectricSQL service
2. **Secrets**: Set `ELECTRIC_SECRET` for production (disable `ELECTRIC_INSECURE`)
3. **TLS**: Use HTTPS for `ELECTRIC_SERVICE_URL` in production
4. **Row-Level Security**: API routes add row-level filtering before ElectricSQL

### Performance

1. **Shape Optimization**: Only sync data that's needed (use where clauses)
2. **Caching**: ElectricSQL caches data locally for offline support
3. **Connection Pooling**: ElectricSQL manages connections to PostgreSQL
4. **Resource Limits**: Configure resource limits in Docker (see `docker-compose.electric.yml`)

### Monitoring

- **Health Endpoint**: `http://localhost:5133/health`
- **Logs**: Use `pnpm electric:service:logs` or Docker logs
- **Metrics**: Monitor ElectricSQL service resource usage

## Troubleshooting

### Service Not Starting

```bash
# Check Docker is running
docker ps

# Check service logs
pnpm electric:service:logs

# Verify PostgreSQL connection
echo $POSTGRES_URL
```

### Schema Not Syncing

```bash
# Regenerate schema
pnpm electric:generate

# Check agent tables are enabled
psql $POSTGRES_URL -c "SELECT tablename FROM electric.primed_tables;"
```

### Client Not Connecting

```bash
# Verify service URL
echo $NEXT_PUBLIC_ELECTRIC_SERVICE_URL

# Check service health
curl http://localhost:5133/health

# Verify provider is configured
# Check app layout has <ElectricProvider>
```

## References

- **Package**: `packages/sync/` - ElectricSQL integration package
- **Docker Compose**: `docker-compose.electric.yml` - Service configuration
- **Migrations**: `docs/reference/database/electric.migrations.sql` - Database setup
- **API Routes**: `apps/cms/src/app/api/shapes/` - Authenticated proxy routes
- **ElectricSQL Docs**: https://electric-sql.com/docs

## Related Documentation

- [Dual Database Architecture](../architecture/DUAL_DATABASE_ARCHITECTURE.md) - Database architecture overview
- [Database Setup](../setup/DATABASE_SETUP.md) - PostgreSQL setup guide
- [Agent Memory System](../architecture/AGENT_MEMORY_SYSTEM.md) - Agent memory architecture

---

**Status**: ⚠️ **In Development** - Service integration validation in progress. See `packages/sync/README.md` for current test status.
