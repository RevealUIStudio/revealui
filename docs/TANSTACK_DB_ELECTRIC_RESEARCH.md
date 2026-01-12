# TanStack DB + Electric Integration Research

**Source**: [TanStack DB Web Starter](https://github.com/electric-sql/electric/tree/main/examples/tanstack-db-web-starter)  
**Blog Article**: [Local-first sync with TanStack DB and Electric](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db)  
**Date**: January 2025

## Overview

This document provides a comprehensive analysis of how TanStack DB and Electric SQL integrate to provide a local-first sync stack for React applications. The research is based on the official starter template and the blog article.

## Key Concepts

### TanStack DB

TanStack DB is a reactive client store for building fast applications with synchronized data. It extends TanStack Query by providing:

- **Collections** - Typed sets of objects that mirror backend tables or filtered views
- **Live Queries** - Reactive queries that update incrementally when data changes
- **Optimistic Mutations** - Local writes with automatic sync and lifecycle support
- **Differential Dataflow** - Sub-millisecond query engine based on [d2ts](https://github.com/electric-sql/d2ts)

### Electric SQL

Electric SQL is a local-first sync layer that syncs subsets of Postgres data into local applications. It provides:

- **Real-time sync** via HTTP/2 shapes
- **Partial replication** - only sync the data you need
- **Automatic conflict resolution**
- **Works with existing Postgres databases**

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  TanStack DB │    │   Electric   │    │    tRPC      │  │
│  │  Collection  │───▶│ Shape Client │    │   Client     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
└─────────│───────────────────│────────────────────│──────────┘
          │                   │                    │
          │    Session Cookie │ (automatic)        │
          │                   ▼                    ▼
┌─────────│───────────────────────────────────────────────────┐
│         │           Server (TanStack Start)                  │
│         │                                                    │
│         │    ┌────────────────────────────────────────────┐ │
│         │    │           Shape Proxy Routes               │ │
│         │    │     (/api/todos, /api/projects, etc)       │ │
│         │    │                                            │ │
│         │    │  1. Validate session                       │ │
│         │    │  2. Add WHERE user_id = ?                  │ │
│         │    │  3. Forward to Electric                    │ │
│         │    └────────────────────────────────────────────┘ │
│         │                         │                         │
│         │    ┌────────────────────│───────────────────────┐ │
│         │    │  tRPC Router       ▼                       │ │
│         └───▶│  - Validates session                       │ │
│              │  - Checks ownership before mutations       │ │
│              │  - Returns transaction IDs for sync        │ │
│              └────────────────────────────────────────────┘ │
│                                   │                         │
└───────────────────────────────────│─────────────────────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
            ┌──────────┐                      ┌──────────┐
            │ Electric │                      │ Postgres │
            │  Server  │◀────────────────────▶│ Database │
            └──────────┘                      └──────────┘
```

### Data Flow

1. **Reads (via Electric)**
   - Client requests data via TanStack DB collection
   - Collection uses Electric shape client to request data
   - Request goes through authenticated proxy route
   - Proxy validates session and adds row-level filtering
   - Electric syncs filtered data to client
   - TanStack DB stores data in normalized collections
   - Live queries reactively update UI

2. **Writes (via tRPC)**
   - Client performs optimistic mutation on collection
   - Collection `onInsert`/`onUpdate`/`onDelete` handlers called
   - Handler calls tRPC mutation endpoint
   - Server validates session and ownership
   - Server writes to Postgres and returns transaction ID
   - Client uses transaction ID to match sync updates

## Implementation Details

### 1. Collection Setup

Collections are defined using `electricCollectionOptions` which configures:

- Schema validation (using Zod schemas from Drizzle)
- Electric shape URL (proxied through authenticated route)
- Mutation handlers (onInsert, onUpdate, onDelete)
- Key extraction function

**Example** (`src/lib/collections.ts`):

```typescript
import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { selectTodoSchema } from "@/db/schema"
import { trpc } from "@/lib/trpc-client"

export const todoCollection = createCollection(
  electricCollectionOptions({
    id: `todos`,
    shapeOptions: {
      url: new URL(
        `/api/todos`,
        typeof window !== `undefined`
          ? window.location.origin
          : `http://localhost:5173`
      ).toString(),
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectTodoSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTodo } = transaction.mutations[0]
      const result = await trpc.todos.create.mutate({
        user_id: newTodo.user_id,
        text: newTodo.text,
        completed: newTodo.completed,
        project_id: newTodo.project_id,
        user_ids: newTodo.user_ids,
      })
      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTodo } = transaction.mutations[0]
      const result = await trpc.todos.update.mutate({
        id: updatedTodo.id,
        data: {
          text: updatedTodo.text,
          completed: updatedTodo.completed,
        },
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTodo } = transaction.mutations[0]
      const result = await trpc.todos.delete.mutate({
        id: deletedTodo.id,
      })
      return { txid: result.txid }
    },
  })
)
```

### 2. Shape Proxy Routes

Each table that syncs via Electric has a corresponding API route that acts as an authenticated proxy.

**Key Pattern** (`src/routes/api/todos.ts`):

1. Validate session
2. Build Electric URL with row-level filtering
3. Proxy request to Electric

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

const serve = async ({ request }: { request: Request }) => {
  // 1. Validate the session
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: `Unauthorized` }), {
      status: 401,
      headers: { "content-type": `application/json` },
    })
  }

  // 2. Build the Electric URL with row-level filtering
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `todos`)
  // Only sync rows where the user has access
  const filter = `'${session.user.id}' = ANY(user_ids)`
  originUrl.searchParams.set(`where`, filter)

  // 3. Proxy the request to Electric
  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute(`/api/todos`)({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
```

### 3. Electric Proxy Utility

The proxy utility handles Electric-specific query parameters and authentication:

```typescript
import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client"

export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const electricUrl = getElectricUrl()
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  // Add Electric Cloud authentication if configured
  if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) {
    originUrl.searchParams.set(`source_id`, process.env.ELECTRIC_SOURCE_ID)
    originUrl.searchParams.set(`secret`, process.env.ELECTRIC_SECRET)
  }

  return originUrl
}

export async function proxyElectricRequest(originUrl: URL): Promise<Response> {
  const response = await fetch(originUrl)
  const headers = new Headers(response.headers)
  headers.delete(`content-encoding`)
  headers.delete(`content-length`)
  headers.set(`vary`, `cookie`)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
```

### 4. tRPC Mutations

Mutations go through tRPC with authorization checks and transaction ID generation:

```typescript
import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and, arrayContains } from "drizzle-orm"
import { todosTable, createTodoSchema, updateTodoSchema } from "@/db/schema"

export const todosRouter = router({
  create: authedProcedure
    .input(createTodoSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx.insert(todosTable).values(input).returning()
        return { item: newItem, txid }
      })
      return result
    }),

  update: authedProcedure
    .input(z.object({ id: z.number(), data: updateTodoSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(todosTable)
          .set(input.data)
          .where(
            and(
              eq(todosTable.id, input.id),
              arrayContains(todosTable.user_ids, [ctx.session.user.id])
            )
          )
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Todo not found or you do not have permission to update it`,
          })
        }

        return { item: updatedItem, txid }
      })
      return result
    }),

  delete: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(todosTable)
          .where(
            and(
              eq(todosTable.id, input.id),
              arrayContains(todosTable.user_ids, [ctx.session.user.id])
            )
          )
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Todo not found or you do not have permission to delete it`,
          })
        }

        return { item: deletedItem, txid }
      })
      return result
    }),
})
```

### 5. Transaction ID Generation

Transaction IDs are used to match optimistic writes with sync updates:

```typescript
export async function generateTxId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<number> {
  // The ::xid cast strips off the epoch, giving you the raw 32-bit value
  // that matches what PostgreSQL sends in logical replication streams
  const result = await tx.execute(
    sql`SELECT pg_current_xact_id()::xid::text as txid`
  )
  const txid = result.rows[0]?.txid

  if (txid === undefined) {
    throw new Error(`Failed to get transaction ID`)
  }

  return parseInt(txid as string, 10)
}
```

### 6. Using Collections in Components

Collections are preloaded in route loaders and used with live queries:

```typescript
import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { todoCollection, projectCollection } from "@/lib/collections"

export const Route = createFileRoute(`/_authenticated/project/$projectId`)({
  loader: async () => {
    // Preload collections to ensure data is available
    await Promise.all([
      projectCollection.preload(),
      todoCollection.preload(),
    ])
    return null
  },
  component: ProjectPage,
})

function ProjectPage() {
  const { projectId } = Route.useParams()

  // Live queries automatically update when data changes
  const { data: todos } = useLiveQuery(
    (q) =>
      q
        .from({ todoCollection })
        .where(({ todoCollection }) =>
          eq(todoCollection.project_id, parseInt(projectId, 10))
        )
        .orderBy(({ todoCollection }) => todoCollection.created_at),
    [projectId]
  )

  // Optimistic mutations update UI immediately
  const addTodo = () => {
    todoCollection.insert({
      id: Math.floor(Math.random() * 100000),
      text: newTodoText.trim(),
      completed: false,
      project_id: parseInt(projectId),
      user_ids: [],
      created_at: new Date(),
    })
  }

  const toggleTodo = (todo: Todo) => {
    todoCollection.update(todo.id, (draft) => {
      draft.completed = !draft.completed
    })
  }

  const deleteTodo = (id: number) => {
    todoCollection.delete(id)
  }

  // ... render UI
}
```

## Key Patterns

### 1. Shape Proxy Pattern

**Why**: Electric maintains persistent sync connections, unlike REST APIs where each request is authenticated individually.

**How**: 
- Each synced table has a proxy route (`/api/todos`, `/api/projects`, etc.)
- Proxy validates session before forwarding to Electric
- Row-level filtering added at the proxy layer
- Session cookies work automatically

**Benefits**:
- Electric never receives unauthenticated requests
- Users only see their own data (database-level filtering)
- No special client configuration needed

### 2. Transaction ID Matching

**Why**: Match optimistic local writes with sync updates from the server.

**How**:
- Server generates Postgres transaction ID (`pg_current_xact_id()`)
- Transaction ID returned in mutation response
- Client uses transaction ID to match sync updates
- Allows rebasing optimistic state over concurrent writes

**Benefits**:
- Simple merge semantics (no complex conflict resolution)
- Supports rollbacks for rejected writes
- Handles concurrent writes from other users

### 3. Collection Preloading

**Why**: Ensure data is available before components render.

**How**:
- Preload collections in route loaders
- Collections fetch data via Electric shapes
- Data available synchronously in components

**Benefits**:
- Prevents loading flicker
- Ensures data availability
- Better user experience

### 4. Optimistic Mutations

**Why**: Instant UI updates while sync happens in background.

**How**:
- Client performs local write immediately
- `onInsert`/`onUpdate`/`onDelete` handlers called
- Handlers call tRPC mutations
- Server validates and persists
- Sync updates match via transaction ID

**Benefits**:
- Instant UI feedback
- Works offline (with sync when online)
- Automatic rollback on validation failure

## Dependencies

### Core Dependencies

```json
{
  "@electric-sql/client": "^1.2.0",
  "@tanstack/electric-db-collection": "^0.2.8",
  "@tanstack/react-db": "^0.1.52",
  "@tanstack/react-router": "^1.139.7",
  "@tanstack/react-start": "^1.139.9",
  "@trpc/client": "^11.7.2",
  "@trpc/server": "^11.7.2",
  "better-auth": "^1.4.3",
  "drizzle-kit": "^0.30.0",
  "drizzle-orm": "^0.39.0",
  "drizzle-zod": "^0.7.1",
  "pg": "^8.16.3",
  "zod": "^4.0.14"
}
```

### Key Package Roles

- `@tanstack/react-db` - Core reactive query engine
- `@tanstack/electric-db-collection` - Electric integration adapter
- `@electric-sql/client` - Electric shape client
- `@trpc/server` - Type-safe mutation endpoints
- `better-auth` - Authentication (session management)
- `drizzle-orm` + `drizzle-zod` - Schema definition and validation

## Authentication Architecture

### Better Auth Setup

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { db } from "@/db/connection"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: `pg`,
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.NODE_ENV === `production`,
    minPasswordLength: process.env.NODE_ENV === `production` ? 8 : 1,
  },
  trustedOrigins: [
    `https://tanstack-start-db-electric-starter.localhost`,
    `http://localhost:5173`,
  ],
  plugins: [tanstackStartCookies()],
})
```

### Authentication Flow

1. **Client Authentication**: Users authenticate via Better Auth (email/password or OAuth)
2. **Session Cookies**: Better Auth sets session cookies automatically
3. **Shape Proxy**: Proxy routes validate session before forwarding to Electric
4. **tRPC Context**: tRPC mutations validate session in context
5. **Row-Level Filtering**: Database queries filtered by user ID

## Database Schema

### Schema Definition (Drizzle)

```typescript
import { pgTable, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({ zodInstance: z })

export const todosTable = pgTable(`todos`, {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: varchar({ length: 500 }).notNull(),
  completed: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  user_id: text(`user_id`)
    .notNull()
    .references(() => users.id, { onDelete: `cascade` }),
  project_id: integer(`project_id`)
    .notNull()
    .references(() => projectsTable.id, { onDelete: `cascade` }),
  user_ids: text(`user_ids`).array().notNull().default([]),
})

// Generate Zod schemas
export const selectTodoSchema = createSelectSchema(todosTable)
export const createTodoSchema = createInsertSchema(todosTable).omit({
  created_at: true,
})
export const updateTodoSchema = createUpdateSchema(todosTable)

export type Todo = z.infer<typeof selectTodoSchema>
```

## Performance Characteristics

### TanStack DB Query Engine

- **Sub-millisecond queries** - Even for complex queries with joins and aggregates
- **Differential dataflow** - Only updates changed parts of result sets
- **Fine-grained reactivity** - Minimizes component re-rendering
- **Normalized data** - Efficient cross-collection queries

### Electric Sync

- **HTTP/2 multiplexing** - Multiple shapes over single connection
- **CDN delivery** - Scales to millions of concurrent users
- **Partial replication** - Only sync needed data
- **Write throughput** - Faster than Postgres (you'll max out Postgres first)

## Development Setup

### Prerequisites

- Docker (for Postgres + Electric)
- Caddy (for HTTPS/HTTP/2 in development)
- Node.js >= 20.19.0
- pnpm

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:54321/electric

# Authentication
BETTER_AUTH_SECRET=<generate-strong-secret>

# Electric (optional - uses local Docker if not set)
ELECTRIC_URL=https://api.electric-sql.cloud
ELECTRIC_SOURCE_ID=your-source-id
ELECTRIC_SECRET=your-source-secret
```

### Quick Start

```bash
# Start backend services
pnpm backend:up

# Apply migrations
pnpm migrate

# Start dev server
pnpm dev
```

## Best Practices

### 1. Use Electric for Reads, tRPC for Writes

- ✅ Use `useLiveQuery` with collections for reads
- ✅ Use collection mutations (`insert`, `update`, `delete`) for writes
- ❌ Don't use tRPC queries for reads (bypasses real-time sync)
- ❌ Don't call `trpc.create.mutate()` directly (bypasses optimistic updates)

### 2. Preload Collections in Route Loaders

- ✅ Preload collections before components render
- ✅ Prevents loading flicker
- ✅ Ensures data availability

### 3. Validate and Filter at Multiple Layers

- ✅ Session validation in proxy routes
- ✅ Row-level filtering in database queries
- ✅ Ownership checks in tRPC mutations
- ✅ Client-side schema validation

### 4. Use Transaction IDs for Sync Matching

- ✅ Generate transaction IDs on server
- ✅ Return transaction IDs in mutation responses
- ✅ Use transaction IDs to match sync updates

### 5. Handle Offline Scenarios

- ✅ Optimistic mutations work offline
- ✅ Sync happens automatically when online
- ✅ Validation failures trigger rollbacks

## Migration Path

### From TanStack Query to TanStack DB

1. Take existing route / loader
2. Adjust to load data into query collection (using same `queryFn`)
3. Adjust components to read from collection using live queries
4. Adjust writes to use TanStack DB mutations (using same `mutationFn`)
5. Adjust collection config from query to sync using Electric

Each step makes the app faster and more resilient, providing a practical migration pathway.

## References

- [TanStack DB Documentation](https://tanstack.com/db/latest/docs/overview)
- [Electric SQL Documentation](https://electric-sql.com/docs)
- [TanStack DB Blog Post](https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query)
- [Local-first sync with TanStack DB and Electric](https://electric-sql.com/blog/2025/07/29/local-first-sync-with-tanstack-db)
- [Electric Starter Repository](https://github.com/electric-sql/electric/tree/main/examples/tanstack-db-web-starter)
- [d2ts - Differential Dataflow in TypeScript](https://github.com/electric-sql/d2ts)

## Key Takeaways

1. **TanStack DB** provides a reactive query engine with sub-millisecond performance
2. **Electric SQL** handles real-time sync of Postgres data
3. **Shape Proxy Pattern** enables authenticated sync with row-level filtering
4. **Transaction IDs** match optimistic writes with sync updates
5. **Incremental adoption** - migrate from TanStack Query one route at a time
6. **Local-first** - instant UI updates with background sync
7. **Type-safe** - full end-to-end type safety with Zod + Drizzle + tRPC
