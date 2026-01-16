# Unified Backend Architecture: NeonDB + Supabase + ElectricSQL

**Date:** 2026-01-16  
**Status:** Complete Architecture Design  
**Version:** 1.0

---

## Executive Summary

This document defines the unified backend and database architecture for RevealUI, integrating multiple systems:

1. **NeonDB (POSTGRES_URL)**: Transactional REST API + ElectricSQL sync layer
2. **Supabase (DATABASE_URL)**: Vector database for AI embeddings
3. **ElectricSQL**: Real-time synchronization for agent contexts and conversations
4. **Vercel AI SDK**: Streaming AI completions with React hooks
5. **Vercel Blob Storage**: Media and file storage
6. **Remote Procedure Calls (RPC)**: Type-safe API calls
7. **Vercel Analytics & Speed Insights**: Performance monitoring

**Architecture Type:** Hybrid Multi-Database + Vercel Cloud Platform Integration

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Next.js)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Generated Types (@revealui/core/generated/types)        │  │
│  │  - CMS Config Types    - Supabase Types                  │  │
│  │  - NeonDB Types        - Shared Type Definitions         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Type-Safe APIs  │
                    │   (REST/RPC)      │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│              Type Safety Layer & Contracts                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Contracts (@revealui/schema/core/contracts)             │  │
│  │  - ConfigContract    - CollectionContract                │  │
│  │  - FieldContract     - GlobalContract                    │  │
│  │  - Runtime Validation (Zod) + Compile-time (TypeScript)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Type Adapters & Bridges                                 │  │
│  │  - Type Adapter (DB ↔ RevealUI)                          │  │
│  │  - Type Bridge (Drizzle ↔ Contracts)                     │  │
│  │  - Contract Mappers (DB Rows ↔ Validated Entities)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌───────▼────────┐   ┌───────▼────────┐
│  REST API      │   │  Vercel AI SDK │   │  RPC Services  │
│  (NeonDB)      │   │  (Streaming)   │   │  (Type-safe)   │
└───────┬────────┘   └───────┬────────┘   └───────┬────────┘
        │                     │                     │
┌───────▼────────┐   ┌───────▼────────┐   ┌───────▼────────┐
│   NeonDB       │   │   Supabase     │   │ Vercel Blob    │
│  (Relational)  │   │   (Vectors)    │   │   (Storage)    │
└───────┬────────┘   └────────────────┘   └────────────────┘
        │
┌───────▼────────┐
│  ElectricSQL   │
│  (Real-time)   │
└────────────────┘
        │
┌───────▼────────┐
│  Vercel Tools  │
│ (Analytics,    │
│  Insights)     │
└────────────────┘
```

**Type Safety Flow:**
1. **Frontend** → Uses generated types for compile-time safety
2. **API Routes** → Validates with contracts (runtime + compile-time)
3. **Type Adapters** → Convert DB types ↔ RevealUI types
4. **Database** → Drizzle ORM provides type-safe queries

**Platform Integration:**
- **Vercel AI SDK**: Streaming AI completions with React hooks
- **Vercel Blob Storage**: Media and file storage
- **Vercel Analytics**: Web analytics and tracking
- **Vercel Speed Insights**: Performance monitoring
- **Remote Procedure Calls (RPC)**: Type-safe API calls

---

## Database Roles & Responsibilities

### 1. NeonDB (POSTGRES_URL) - Primary Database

**Role:** Transactional REST API + Real-time Sync Source

**Stores:**
- ✅ **Core Relational Data:**
  - Users, sessions, authentication
  - Sites, pages, CMS content
  - Media, posts, metadata
  
- ✅ **Agent Relational Data:**
  - `agent_contexts` - Working memory, session context
  - `conversations` - Chat threads with messages
  - `agent_actions` - Audit log of agent actions

- ❌ **NOT** Agent memories with embeddings (moves to Supabase)

**Characteristics:**
- High connection count for REST API
- Low-latency transactional queries
- Optimized for relational joins
- Source of truth for ElectricSQL sync

**Connection:** `POSTGRES_URL`

---

### 2. Supabase (DATABASE_URL) - Vector Database

**Role:** AI/Vector Operations + Semantic Search

**Stores:**
- ✅ **Agent Memories with Embeddings:**
  - `agent_memories` - Long-term memory with `vector(1536)` embeddings
  - Vector similarity search optimized
  - HNSW indexes for fast semantic retrieval

**Characteristics:**
- CPU-optimized for vector operations
- Large embedding storage capacity
- Optimized for similarity search
- Isolated from transactional workloads

**Connection:** `DATABASE_URL`

**Why Separate:**
- Vector similarity searches are CPU/memory intensive
- Heavy vector queries don't affect REST API latency
- Independent scaling for vector workloads
- Better cost optimization

---

### 3. ElectricSQL - Real-time Sync Layer

**Role:** Real-time synchronization for client-side data

**Syncs from NeonDB:**
- ✅ `agent_contexts` - Working memory across tabs
- ✅ `conversations` - Chat threads across sessions
- ❌ **NOT** `agent_memories` - Don't need real-time sync

**Characteristics:**
- Reads from NeonDB (POSTGRES_URL)
- Syncs via HTTP shapes to clients
- CRDT-based conflict resolution
- Offline-first with automatic sync

**Connection:** `POSTGRES_URL` (same as NeonDB)

**Why ElectricSQL:**
- Real-time updates across browser tabs
- Offline support with automatic sync
- Optimistic updates with conflict resolution
- Type-safe client-side queries

---

## Vercel Platform Integration

### 4. Vercel AI SDK - Streaming AI Completions

**Role:** Type-safe streaming AI completions with React hooks

**Features:**
- ✅ **Streaming Responses:** Real-time token streaming to clients
- ✅ **React Hooks:** `useChat`, `useCompletion`, `useAssistant`
- ✅ **Type Safety:** Full TypeScript support
- ✅ **Error Handling:** Built-in error boundaries
- ✅ **Multi-Provider:** OpenAI, Anthropic, custom providers

**Integration with Vector Database:**
```typescript
// Server: apps/cms/src/app/api/chat/route.ts
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { getVectorClient } from '@revealui/db/client'

export async function POST(request: NextRequest) {
  const { messages } = await request.json()
  
  // 1. Search relevant memories from Supabase
  const vectorDb = getVectorClient()
  const queryEmbedding = await generateEmbedding(messages[messages.length - 1].content)
  const relevantMemories = await vectorDb
    .select()
    .from(agentMemories)
    .orderBy(sql`embedding <-> ${queryEmbedding}::vector`)
    .limit(5)
  
  // 2. Use memories as context in AI SDK
  const result = await streamText({
    model: openai('gpt-4'),
    messages,
    system: `Relevant memories: ${relevantMemories.map(m => m.content).join('\n')}`,
  })
  
  return result.toDataStreamResponse()
}

// Client: apps/cms/src/lib/components/Agent/index.tsx
import { useChat } from 'ai/react'

export function AgentChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    // Optional: RPC endpoint for type-safe calls
  })
  
  return <Chat messages={messages} input={input} handleSubmit={handleSubmit} />
}
```

**Benefits:**
- Real-time streaming responses
- Type-safe client/server communication
- Automatic error handling and retries
- Optimistic UI updates
- Built-in loading states

---

### 5. Remote Procedure Calls (RPC) - Type-Safe API Calls

**Role:** Type-safe API calls with shared types between client and server

**Implementation Pattern:**
```typescript
// Shared RPC Types (packages/core/src/rpc/types.ts)
export type RPCProcedure<TInput, TOutput> = {
  input: TInput
  output: TOutput
}

export type RPCRouter = {
  // AI/Agent Procedures
  'ai.chat': RPCProcedure<{ messages: Message[] }, { response: string }>
  'ai.searchMemories': RPCProcedure<{ query: string }, { memories: AgentMemory[] }>
  
  // Memory Procedures
  'memory.create': RPCProcedure<{ memory: AgentMemory }, { id: string }>
  'memory.search': RPCProcedure<{ queryEmbedding: number[] }, { memories: AgentMemory[] }>
  
  // Context Procedures (via ElectricSQL)
  'context.get': RPCProcedure<{ agentId: string }, { context: AgentContext }>
  'context.update': RPCProcedure<{ agentId: string; context: Record<string, unknown> }, { context: AgentContext }>
}
```

**Server-Side RPC Handler:**
```typescript
// apps/cms/src/app/api/rpc/route.ts
import type { RPCRouter } from '@revealui/core/rpc/types'

export async function POST(request: NextRequest) {
  const { procedure, input } = await request.json()
  
  switch (procedure) {
    case 'memory.search': {
      // Use Supabase vector search
      const vectorDb = getVectorClient()
      const memories = await vectorDb
        .select()
        .from(agentMemories)
        .orderBy(sql`embedding <-> ${input.queryEmbedding}::vector`)
        .limit(10)
      return NextResponse.json({ memories })
    }
    
    case 'context.get': {
      // Use NeonDB + ElectricSQL
      const restDb = getRestClient()
      const context = await restDb.query.agentContexts.findFirst({
        where: eq(agentContexts.agentId, input.agentId),
      })
      return NextResponse.json({ context })
    }
  }
}
```

**Client-Side RPC Client:**
```typescript
// packages/core/src/rpc/client.ts
export class RPCClient {
  async call<T extends keyof RPCRouter>(
    procedure: T,
    input: RPCRouter[T]['input']
  ): Promise<RPCRouter[T]['output']> {
    const response = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedure, input }),
    })
    return response.json()
  }
}

// Usage: Type-safe calls with automatic type inference
const rpc = new RPCClient()
const memories = await rpc.call('memory.search', { queryEmbedding })
// TypeScript knows memories is AgentMemory[]
```

**Benefits:**
- ✅ Type-safe API calls (shared types)
- ✅ Single endpoint for all procedures
- ✅ Automatic type inference
- ✅ Better IDE autocomplete
- ✅ Compile-time error checking

---

### 6. Vercel Blob Storage - Media & File Storage

**Role:** Scalable media and file storage for CMS content

**Current Implementation:**
```typescript
// packages/revealui/src/core/storage/vercel-blob.ts
import { put, del } from '@vercel/blob'

export function vercelBlobStorage(config: VercelBlobStorageConfig): Plugin {
  // Configure upload adapters for media collections
  collection.upload = {
    adapters: [{
      upload: async (file) => {
        const blob = await put(filePath, file.data, {
          access: 'public',
          token: config.token, // BLOB_READ_WRITE_TOKEN
        })
        return { url: blob.url, filename: file.name }
      },
      delete: async (blobUrl) => await del(blobUrl),
    }],
  }
}
```

**Data Flow:**
```
Media Upload → Next.js API → Vercel Blob Storage → Store URL in NeonDB
```

**Benefits:**
- ✅ Scalable storage (no database bloat)
- ✅ Global CDN delivery
- ✅ Automatic optimization
- ✅ Direct uploads (no server bandwidth)

---

### 7. Vercel Analytics & Speed Insights - Performance Monitoring

**Role:** Web analytics and performance monitoring

**Setup:**
```typescript
// apps/cms/src/app/(frontend)/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />      {/* Pageview tracking */}
        <SpeedInsights />  {/* Core Web Vitals */}
      </body>
    </html>
  )
}
```

**Metrics Tracked:**
- **Analytics:** Page views, sessions, bounce rate
- **Speed Insights:** LCP, FID, CLS, TTFB

**Benefits:**
- ✅ Automatic performance tracking
- ✅ Real-time Core Web Vitals
- ✅ Zero configuration on Vercel
- ✅ Privacy-focused analytics

---

## Type Safety & Contracts Layer

### Overview

The type safety layer sits between the frontend and backend, providing:

1. **Contracts** - Unified validation (TypeScript + Zod)
2. **Type Adapters** - Database ↔ RevealUI type conversion
3. **Type Bridges** - Drizzle ORM ↔ Contracts conversion
4. **Generated Types** - Auto-generated from configs/databases for frontend

**Location:** 
- Contracts: `packages/schema/src/core/contracts/`
- Type Adapters: `packages/revealui/src/core/database/type-adapter.ts`
- Type Bridges: `packages/schema/src/core/contracts/type-bridge.ts`
- Generated Types: `packages/revealui/src/core/generated/types/`

---

### 8. Contracts System - Unified Validation

**Role:** Single source of truth for validation (TypeScript + Zod)

**What Contracts Provide:**
- **TypeScript Types** (compile-time safety)
- **Zod Schemas** (runtime validation)
- **Validation Functions** (runtime validation)
- **Type Guards** (runtime type checking)
- **Metadata** (documentation, versioning)

**Contract Types:**
- **ConfigContract** - Root CMS configuration validation
- **CollectionContract** - Collection configuration validation
- **FieldContract** - Field configuration validation
- **GlobalContract** - Global configuration validation

**Example Usage:**
```typescript
// Server: API Route validation
import { UserSchema } from '@revealui/schema'
import { getRestClient } from '@revealui/db/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // 1. Validate with contract (runtime + compile-time)
  const validatedUser = UserSchema.parse(body)  // Throws if invalid
  
  // 2. Type is now known: User
  const db = getRestClient()
  await db.insert(users).values(validatedUser)
  
  return NextResponse.json(validatedUser)
}
```

**Benefits:**
- ✅ Compile-time type safety (TypeScript)
- ✅ Runtime validation (Zod)
- ✅ Single source of truth (no type drift)
- ✅ Detailed error messages (Zod errors)
- ✅ Type guards for narrowing

---

### 9. Type Adapters - Database ↔ RevealUI Conversion

**Role:** Convert between database types and RevealUI internal types

**Location:** `packages/revealui/src/core/database/type-adapter.ts`

**Key Functions:**
```typescript
// Convert DB row to RevealUI document
function dbRowToRevealUIDoc<TDoc, TDbRow>(dbRow: TDbRow): TDoc

// Convert RevealUI document to DB insert
function revealUIDocToDbInsert<TDoc, TInsert>(doc: TDoc): TInsert

// Convert DB row to contract-validated entity
function dbRowToContract<TContract, TDbRow>(
  contract: Contract<TContract>,
  dbRow: TDbRow
): TContract
```

**Usage in API Routes:**
```typescript
// apps/cms/src/app/api/users/route.ts
import { getRestClient } from '@revealui/db/client'
import { UserSchema } from '@revealui/schema'
import { dbRowToContract } from '@revealui/core/database/type-adapter'

export async function GET() {
  const db = getRestClient()
  const dbUser = await db.query.users.findFirst()
  
  // Convert DB type to validated contract type
  const validatedUser = dbRowToContract(UserSchema, dbUser)
  
  // Return to frontend (types match generated types)
  return NextResponse.json(validatedUser)
}
```

---

### 10. Type Bridges - Drizzle ORM ↔ Contracts

**Role:** Convert between Drizzle ORM types and Contract types

**Location:** `packages/schema/src/core/contracts/type-bridge.ts`

**Key Functions:**
```typescript
// Convert DB row to contract type with mapper
function createDbRowMapper<TContract, TDbRow>(
  contract: Contract<TContract>,
  mapper?: (row: TDbRow) => unknown
): (row: TDbRow) => TContract

// Convert contract type to DB insert with mapper
function createContractToDbMapper<TContract, TInsert>(
  mapper?: (data: TContract) => TInsert
): (data: TContract) => TInsert
```

---

### 11. Generated Types - Frontend Type Safety

**Role:** Auto-generated TypeScript types for frontend consumption

**Location:** `packages/revealui/src/core/generated/types/`

**Sources:**
1. **CMS Config Types** (`cms.ts`) - Generated from `revealui.config.ts`
2. **Supabase Types** (`supabase.ts`) - Generated from Supabase schema
3. **NeonDB Types** (`neon.ts`) - Generated from Drizzle schema

**Frontend Usage:**
```typescript
// apps/web/src/components/Page.tsx
import type { Page, Site, User } from '@revealui/core/generated/types'

export function PageComponent({ page }: { page: Page }) {
  // Full type safety from generated types
  return (
    <div>
      <h1>{page.title}</h1>  {/* TypeScript knows this exists */}
      <p>{page.content}</p>
    </div>
  )
}
```

**Type Safety Flow:**
```
Frontend → Generated Types → API Route → Contract Validation → Type Adapter → Database
```

---

## Data Flow Architecture

### REST API Flow

```
Client Request
    │
    ▼
Next.js API Route (apps/cms/src/app/api/...)
    │
    ├─→ NeonDB (POSTGRES_URL) ──┐
    │                            │
    │   ┌────────────────────────┘
    │   │
    │   ├─→ Query users/sites/pages
    │   ├─→ Query agent_contexts
    │   ├─→ Query conversations
    │   └─→ Write to NeonDB
    │
    └─→ Response to Client
```

**Pattern:**
- All REST endpoints use NeonDB
- Standard Drizzle ORM queries
- Type-safe with schema validation

---

### Vector Search Flow

```
AI Agent Request
    │
    ▼
Vector Memory Service (packages/ai/src/memory/...)
    │
    ├─→ Generate Embedding (OpenAI/Cohere)
    │
    ▼
Supabase (DATABASE_URL)
    │
    ├─→ Semantic Search (pgvector)
    │   └─→ SELECT * FROM agent_memories 
    │       ORDER BY embedding <-> query_embedding
    │
    └─→ Return Similar Memories
```

**Pattern:**
- Vector operations use Supabase
- Embedding generation → Vector storage → Similarity search
- Isolated from REST API performance

---

### ElectricSQL Sync Flow

```
Client (Browser)
    │
    ├─→ Shape Request (/api/shapes/agent-contexts)
    │       │
    │       ▼
    │   CMS API Route (apps/cms/src/app/api/shapes/...)
    │       │
    │       ▼
    │   ElectricSQL Service (localhost:5133)
    │       │
    │       ▼
    │   NeonDB (POSTGRES_URL) ──┐
    │                           │
    │   ┌───────────────────────┘
    │   │
    │   └─→ Sync agent_contexts/conversations
    │
    ▼
Local SQLite (IndexedDB)
    │
    └─→ React Hooks (useAgentContext, useConversations)
```

**Pattern:**
- ElectricSQL reads from NeonDB
- CMS API proxies shape requests with auth
- Clients sync via HTTP shapes
- Local-first with automatic sync

---

## Table Distribution

### NeonDB Tables

```sql
-- Core relational data
users, sessions, sites, pages, site_collaborators
page_revisions, media, posts

-- Agent relational data (ElectricSQL sync)
agent_contexts      -- Working memory, session context
conversations       -- Chat threads with messages
agent_actions       -- Audit log of actions

-- NOT agent_memories (moved to Supabase)
```

### Supabase Tables

```sql
-- Vector data only
agent_memories      -- Long-term memory with embeddings
  - id
  - content
  - embedding vector(1536)  -- For similarity search
  - embedding_metadata jsonb
  - metadata jsonb
  - userId (reference, no FK)
  - siteId (reference, no FK)
```

### ElectricSQL Shapes

**Synced Tables:**
- `agent_contexts` - Real-time working memory
- `conversations` - Real-time chat threads

**NOT Synced:**
- `agent_memories` - Don't need real-time sync (historical data)
- `users`, `sites`, `pages` - Sync via REST API

---

## Implementation Details

### 1. Database Client Factory

```typescript
// packages/db/src/client/index.ts

export type DatabaseType = 'rest' | 'vector' | 'electric'

let restClient: Database | null = null
let vectorClient: Database | null = null

export function getClient(type: DatabaseType = 'rest'): Database {
  if (type === 'vector') {
    if (!vectorClient) {
      const url = process.env.DATABASE_URL
      if (!url) throw new Error('DATABASE_URL required for vector database')
      vectorClient = createClient({ connectionString: url })
    }
    return vectorClient
  }

  // Default: REST/NeonDB (also used by ElectricSQL)
  if (!restClient) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (!url) throw new Error('POSTGRES_URL required for REST database')
    restClient = createClient({ connectionString: url })
  }
  return restClient
}

// Explicit helpers
export function getRestClient(): Database {
  return getClient('rest')
}

export function getVectorClient(): Database {
  return getClient('vector')
}
```

**Usage:**
```typescript
// REST operations
const db = getRestClient()
const users = await db.query.users.findMany()

// Vector operations
const vectorDb = getVectorClient()
const memories = await vectorDb
  .select()
  .from(agentMemories)
  .orderBy(sql`embedding <-> ${queryEmbedding}::vector`)
```

---

### 2. Schema Organization

```typescript
// packages/db/src/core/rest.ts (NeonDB schema)
export * from './users'
export * from './sites'
export * from './pages'
export * from './sessions'
export * from './agents/contexts'    // ElectricSQL sync
export * from './agents/conversations'  // ElectricSQL sync
export * from './agents/actions'

// packages/db/src/core/vector.ts (Supabase schema)
export * from './agents/vector-memories'  // Vector data only

// packages/db/src/core/index.ts
export * from './rest'   // Default (NeonDB)
export * from './vector' // Explicit import needed
```

---

### 3. Vector Memory Service

```typescript
// packages/ai/src/memory/vector-memory.ts
import { getVectorClient } from '@revealui/db/client'
import { agentMemories } from '@revealui/db/core/vector'

export class VectorMemoryService {
  private db = getVectorClient()  // Supabase

  async searchSimilar(
    queryEmbedding: number[],
    options: {
      userId?: string
      siteId?: string
      limit?: number
    } = {}
  ) {
    let query = this.db
      .select()
      .from(agentMemories)
      .orderBy(sql`embedding <-> ${queryEmbedding}::vector`)
      .limit(options.limit ?? 10)

    // Filter by user/site (reference IDs, not FKs)
    if (options.userId) {
      query = query.where(eq(agentMemories.userId, options.userId))
    }
    if (options.siteId) {
      query = query.where(eq(agentMemories.siteId, options.siteId))
    }

    return await query
  }

  async create(memory: AgentMemory) {
    // Only writes to Supabase
    return await this.db.insert(agentMemories).values({
      ...memory,
      embedding: `[${memory.embedding.vector.join(',')}]`,
      // Reference IDs (not foreign keys)
      userId: memory.metadata?.custom?.userId,
      siteId: memory.metadata?.siteId,
    })
  }
}
```

---

### 4. ElectricSQL Configuration

```yaml
# docker-compose.electric.yml
services:
  electric-sql:
    environment:
      # Connect to NeonDB (not Supabase)
      - DATABASE_URL=${POSTGRES_URL}  # Source of truth
      
      # Sync configuration
      - ELECTRIC_WRITE_TO_PG_MODE=direct_writes
      - ELECTRIC_REPLICATION_MODE=pglite
```

**Synced Tables:**
- `agent_contexts` - Working memory sync
- `conversations` - Chat sync

**NOT Synced:**
- `agent_memories` - Historical data, no real-time sync needed
- Vector searches use Supabase directly via API

---

### 5. API Routes

```typescript
// apps/cms/src/app/api/memory/episodic/[userId]/route.ts
// Uses Supabase for vector operations

export async function GET(...) {
  const vectorDb = getVectorClient()  // Supabase
  const memories = await vectorDb
    .select()
    .from(agentMemories)
    .where(eq(agentMemories.userId, userId))
}

// apps/cms/src/app/api/shapes/agent-contexts/route.ts
// ElectricSQL proxy for NeonDB

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  // ElectricSQL reads from NeonDB (POSTGRES_URL)
  return proxyElectricRequest(originUrl)
}
```

---

## Data Synchronization Strategy

### NeonDB ↔ ElectricSQL

**Pattern:** ElectricSQL reads from NeonDB, syncs to clients

**Tables:**
- `agent_contexts` - Real-time sync
- `conversations` - Real-time sync

**How it works:**
1. ElectricSQL connects to NeonDB (POSTGRES_URL)
2. ElectricSQL monitors changes via logical replication
3. Clients request shapes via CMS API proxy
4. ElectricSQL streams updates to clients
5. Clients store in local SQLite (IndexedDB)

**Benefits:**
- Real-time updates across tabs
- Offline support with sync
- Conflict resolution via CRDTs

---

### NeonDB ↔ Supabase (Reference IDs)

**Pattern:** Reference IDs only, no foreign keys

**Data:**
- NeonDB: Users, sites (relational)
- Supabase: Agent memories (vectors, reference user/site IDs)

**How it works:**
```typescript
// Creating memory in Supabase
await vectorDb.insert(agentMemories).values({
  id: 'memory-123',
  content: 'User prefers dark mode',
  embedding: queryEmbedding,
  // Reference IDs (not foreign keys)
  userId: neonUser.id,  // From NeonDB
  siteId: neonSite.id,  // From NeonDB
  // ... other fields
})

// Retrieving with user info
const memory = await vectorDb.query.agentMemories.findById(memoryId)
const user = await restDb.query.users.findById(memory.userId)  // Join in app
```

**Benefits:**
- No cross-database foreign keys
- Independent databases
- Application-level joins when needed

---

## Benefits of Unified Architecture

### 1. Performance Optimization ✅

**NeonDB:**
- Optimized for transactional REST queries
- Fast relational joins
- Low-latency reads/writes

**Supabase:**
- Optimized for vector similarity search
- HNSW indexes for fast semantic retrieval
- Isolated CPU-intensive operations

**ElectricSQL:**
- Real-time sync without blocking REST API
- Local-first with optimistic updates
- Efficient incremental sync

---

### 2. Independent Scaling ✅

**NeonDB:**
- Scale for REST API connection count
- Serverless/scale-to-zero for variable workload
- Optimize for transactional throughput

**Supabase:**
- Scale for vector storage/compute
- Dedicated instances for CPU-heavy operations
- Optimize for embedding query patterns

**ElectricSQL:**
- Lightweight sync service
- Minimal resource usage
- Scales with client connections

---

### 3. Clear Separation of Concerns ✅

**REST Operations:**
- Users, sites, pages → NeonDB
- Agent contexts, conversations → NeonDB
- Standard Drizzle ORM queries

**Vector Operations:**
- Agent memories → Supabase
- Semantic search → Supabase
- Vector similarity queries

**Real-time Sync:**
- Agent contexts → ElectricSQL (from NeonDB)
- Conversations → ElectricSQL (from NeonDB)
- Client-side local-first storage

---

### 4. Security & Access Control ✅

**NeonDB:**
- Contains user PII, auth data
- REST API access only
- Row-level security via ElectricSQL proxy

**Supabase:**
- Contains embeddings (less sensitive)
- Vector service access only
- Reference IDs only (no direct user data)

**ElectricSQL:**
- Syncs filtered data only
- Authenticated via CMS API proxy
- Row-level filtering in shape routes

---

## Migration Strategy

### Phase 1: Setup (Week 1)
- [ ] Enable pgvector in Supabase
- [ ] Create `agent_memories` table in Supabase
- [ ] Implement `getClient(type)` factory
- [ ] Update ElectricSQL to connect to NeonDB

### Phase 2: Dual Write (Week 2)
- [ ] Write new memories to both databases
- [ ] Validate data consistency
- [ ] Monitor performance

### Phase 3: Vector Migration (Week 3)
- [ ] Migrate embeddings from NeonDB to Supabase
- [ ] Update vector search to use Supabase
- [ ] Remove vector columns from NeonDB `agent_memories`

### Phase 4: ElectricSQL Integration (Week 4)
- [ ] Verify ElectricSQL sync works with NeonDB
- [ ] Test real-time updates for agent_contexts
- [ ] Test real-time updates for conversations
- [ ] Remove old sync infrastructure

### Phase 5: Cleanup (Week 5)
- [ ] Stop writing vectors to NeonDB
- [ ] Remove old vector infrastructure
- [ ] Update documentation

---

## ElectricSQL Integration Details

### Connection Configuration

```yaml
# ElectricSQL connects to NeonDB
environment:
  DATABASE_URL=${POSTGRES_URL}  # NeonDB connection
```

**Why NeonDB (not Supabase):**
- Agent contexts and conversations need relational joins with users
- ElectricSQL syncs relational data (not vectors)
- NeonDB is source of truth for user/session data

---

### Shape Proxy Routes

```typescript
// apps/cms/src/app/api/shapes/agent-contexts/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)
  
  // Build ElectricSQL shape URL
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  originUrl.searchParams.set('where', 'agent_id = $1')
  originUrl.searchParams.set('params', JSON.stringify([session.user.id]))
  
  // ElectricSQL reads from NeonDB (POSTGRES_URL)
  return proxyElectricRequest(originUrl)
}
```

**Pattern:**
- CMS API validates session
- Adds row-level filtering
- Proxies to ElectricSQL service
- ElectricSQL reads from NeonDB

---

### Client-Side Usage

```typescript
// packages/sync/src/hooks/useAgentContext.ts
export function useAgentContext(agentId: string, sessionId: string) {
  // Shape request goes to CMS API proxy
  const shape = useShape({
    source: 'http://localhost:3000/api/shapes/agent-contexts',
    table: 'agent_contexts',
    where: { agent_id: agentId, session_id: sessionId },
  })
  
  // ElectricSQL syncs from NeonDB
  // Local storage in IndexedDB
  return shape.data
}
```

---

## Monitoring & Observability

### Key Metrics

**NeonDB (REST):**
- Query latency (p50, p95, p99)
- Connection pool usage
- Transaction throughput
- ElectricSQL replication lag

**Supabase (Vector):**
- Vector search latency
- Embedding write throughput
- Storage growth
- HNSW index performance

**ElectricSQL:**
- Shape subscription count
- Sync latency
- Client connection count
- Replication lag from NeonDB

---

### Alerts

```
NeonDB:
- P95 latency > 200ms
- Connection pool > 80%
- ElectricSQL lag > 5s

Supabase:
- Vector search latency > 500ms
- Storage growth > 10GB/day

ElectricSQL:
- Sync latency > 2s
- Replication lag > 5s
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test REST operations use NeonDB
test('user service uses NeonDB', async () => {
  const db = getRestClient()
  // Mock NeonDB, verify POSTGRES_URL used
})

// Test vector operations use Supabase
test('vector memory service uses Supabase', async () => {
  const db = getVectorClient()
  // Mock Supabase, verify DATABASE_URL used
})
```

### Integration Tests

```typescript
// Test ElectricSQL sync
test('agent context syncs via ElectricSQL', async () => {
  // Create context in NeonDB
  await restDb.insert(agentContexts).values(...)
  
  // Request shape via CMS API
  const response = await fetch('/api/shapes/agent-contexts')
  
  // Verify ElectricSQL syncs from NeonDB
  expect(response.ok).toBe(true)
})

// Test cross-database references
test('memory references user from NeonDB', async () => {
  // Create user in NeonDB
  const user = await createUserInNeonDB()
  
  // Create memory in Supabase with user ID
  const memory = await createMemoryInSupabase({ userId: user.id })
  
  // Verify reference works
  const retrieved = await getMemoryWithUser(memory.id)
  expect(retrieved.userId).toBe(user.id)
})
```

---

## Configuration Summary

### Environment Variables

```env
# NeonDB (REST + ElectricSQL source)
POSTGRES_URL=postgresql://...@neon.tech/...

# Supabase (Vector database)
DATABASE_URL=postgresql://...@db.supabase.co/...

# ElectricSQL Service
ELECTRIC_SERVICE_URL=http://localhost:5133
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133
```

### Database Connections

```
REST API Routes → NeonDB (POSTGRES_URL)
Vector Services → Supabase (DATABASE_URL)
ElectricSQL → NeonDB (POSTGRES_URL)
```

---

## Decision Matrix

| Operation | Database | Why |
|-----------|----------|-----|
| **User Auth** | NeonDB | Relational, transactional |
| **CMS Content** | NeonDB | Relational, transactional |
| **Agent Contexts** | NeonDB | ElectricSQL sync, relational |
| **Conversations** | NeonDB | ElectricSQL sync, relational |
| **Agent Memories (Vectors)** | Supabase | Vector similarity search |
| **Semantic Search** | Supabase | CPU-intensive, isolated |

---

## Benefits Summary

### Performance
- ✅ REST API unaffected by vector queries
- ✅ Vector operations isolated and optimized
- ✅ Real-time sync doesn't block transactions

### Scalability
- ✅ Independent scaling per database
- ✅ Cost optimization per workload
- ✅ Elastic scaling for variable loads

### Security
- ✅ Clear access boundaries
- ✅ Row-level security via ElectricSQL proxy
- ✅ Reduced blast radius

### Development
- ✅ Clear separation of concerns
- ✅ Type-safe with Drizzle ORM
- ✅ Independent schema evolution

---

## What This Means for the Frontend

### Type Safety End-to-End

The frontend benefits from **full type safety** from the database to React components:

**1. Generated Types (Compile-Time Safety)**
```typescript
// Frontend automatically gets types from backend
import type { Page, User, Site } from '@revealui/core/generated/types'

// TypeScript knows exact shape of data
function PageView({ page }: { page: Page }) {
  return <h1>{page.title}</h1>  // ✅ Type-safe, autocomplete works
}
```

**2. Runtime Validation (API Boundaries)**
```typescript
// API routes validate with contracts before returning
// Frontend receives validated, typed data
const page = await fetch('/api/pages/123').then(r => r.json())
// TypeScript knows page is Page type
```

**3. RPC Type Safety**
```typescript
// Type-safe RPC calls with shared types
const rpc = new RPCClient()
const memories = await rpc.call('memory.search', { queryEmbedding })
// memories is typed as AgentMemory[]
```

**4. Vercel AI SDK Types**
```typescript
// Streaming AI responses with type safety
const { messages } = useChat({ api: '/api/chat' })
// messages is typed as Message[]
```

### Frontend Development Benefits

✅ **No Manual Type Definitions:** Types auto-generated from backend  
✅ **IDE Autocomplete:** Full autocomplete for all backend types  
✅ **Compile-Time Errors:** Catch type mismatches before runtime  
✅ **Runtime Validation:** Invalid data caught at API boundaries  
✅ **Type Inference:** TypeScript infers types automatically  
✅ **Shared Types:** Frontend and backend use same type definitions  

### Type Safety Flow for Frontend

```
1. Backend: Generate types from configs/databases
   ↓
2. Frontend: Import generated types
   ↓
3. API Call: TypeScript validates request shape
   ↓
4. API Route: Contract validates input (runtime)
   ↓
5. Database: Drizzle validates query types
   ↓
6. Type Adapter: Converts DB type → Contract type
   ↓
7. Response: Contract-validated, typed data
   ↓
8. Frontend: Receives typed data, TypeScript validates
```

### Example: Full Type Safety Stack

**Frontend Component:**
```typescript
// apps/web/src/components/UserProfile.tsx
import type { User } from '@revealui/core/generated/types'
import { RPCClient } from '@revealui/core/rpc/client'

export async function UserProfile({ userId }: { userId: string }) {
  // Type-safe RPC call
  const rpc = new RPCClient()
  const user = await rpc.call('user.get', { id: userId })
  
  // user is typed as User
  // TypeScript knows all properties
  return (
    <div>
      <h1>{user.name}</h1>         {/* ✅ Type-safe */}
      <p>{user.email}</p>          {/* ✅ Type-safe */}
      {/* user.invalidProp  ❌ TypeScript error */}
    </div>
  )
}
```

**Backend RPC Handler:**
```typescript
// apps/cms/src/app/api/rpc/route.ts
case 'user.get': {
  // Contract validates input
  const { id } = UserGetInputSchema.parse(input)
  
  // Drizzle query (type-safe)
  const dbUser = await db.query.users.findById(id)
  
  // Type adapter converts to contract type
  const user = dbRowToContract(UserSchema, dbUser)
  
  // Return typed data (matches frontend generated types)
  return NextResponse.json({ user })
}
```

**Result:** Full type safety from database to React component.

---

## Next Steps

1. **Review & Approve:** Evaluate architecture approach
2. **Implement Client Factory:** Add `getClient(type)` to `@revealui/db`
3. **Migrate Schemas:** Split schemas (rest.ts, vector.ts)
4. **Update Services:** Vector services use Supabase
5. **Configure ElectricSQL:** Connect to NeonDB, sync agent tables
6. **Test Integration:** Verify all three systems work together
7. **Document:** Update all documentation with new architecture
8. **Type Generation:** Verify all types are generated correctly
9. **Contract Validation:** Ensure all API routes use contracts
10. **Frontend Types:** Verify frontend uses generated types

---

## References

- [Dual Database Architecture](./DUAL_DATABASE_ARCHITECTURE.md) - Initial analysis
- [ElectricSQL README](../../packages/sync/README.md) - Sync package docs
- [Supabase Vector Guide](https://supabase.com/modules/vector)
- [ElectricSQL Documentation](https://electric-sql.com/docs)

## Related Documentation

- [Dual Database Architecture](./DUAL_DATABASE_ARCHITECTURE.md) - Database architecture details
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure
- [Database Types Reference](../reference/database/DATABASE_TYPES_REFERENCE.md) - Type definitions
- [Fresh Database Setup](../reference/database/FRESH-DATABASE-SETUP.md) - Database setup guide
- [Drizzle Guide](../development/DRIZZLE-GUIDE.md) - Drizzle ORM usage
- [ElectricSQL Integration](../development/electric-integration.md) - ElectricSQL setup
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task

---

**Document Status:** ✅ Ready for Implementation
