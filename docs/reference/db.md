# @revealui/db

Drizzle ORM schema, database clients, migrations, and encryption utilities. Supports two databases: NeonDB (REST content) and Supabase (vectors/auth).

```bash
npm install @revealui/db
```

## Subpath Exports

| Import path | Purpose |
|-------------|---------|
| `@revealui/db` | Client creation + schema |
| `@revealui/db/client` | Database client factory |
| `@revealui/db/schema` | All table definitions |
| `@revealui/db/schema/users` | Users, sessions, password reset |
| `@revealui/db/schema/sites` | Sites and collaborators |
| `@revealui/db/schema/pages` | Pages and revisions |
| `@revealui/db/schema/cms` | Posts and media |
| `@revealui/db/schema/agents` | Agent memories, contexts, conversations |
| `@revealui/db/schema/licenses` | License records |
| `@revealui/db/schema/api-keys` | BYOK user API keys |
| `@revealui/db/crypto` | AES-256-GCM encryption |
| `@revealui/db/types` | TypeScript types |

---

## Client API

### `createClient(config: DatabaseConfig, schema?)`

Creates a Drizzle ORM client. Auto-selects the right driver based on connection string.

```ts
import { createClient } from '@revealui/db/client'

const db = createClient({
  connectionString: process.env.POSTGRES_URL,
})
```

**Driver selection:**
- Neon HTTP driver (`@neondatabase/serverless`) — for `neon.tech` connection strings
- node-postgres (`pg`) — for Supabase, localhost, and other Postgres hosts

Returns `NeonHttpDatabase | NodePgDatabase` depending on the connection string.

---

### `getRestClient(): Database`

Returns (or lazily creates) the global NeonDB client. Reads `POSTGRES_URL` from env.

```ts
import { getRestClient } from '@revealui/db/client'

const db = getRestClient()
const posts = await db.select().from(schema.posts)
```

### `getVectorClient(): Database`

Returns (or lazily creates) the global Supabase client. Reads `SUPABASE_URL` and `SUPABASE_KEY` from env.

> Only use the vector client in designated modules (`packages/db/src/vector/`, `packages/ai/src/`). See database conventions for boundary rules.

### `getClient(type?: 'rest' | 'vector' | string): Database`

Unified client getter. Pass `'rest'` or `'vector'`, or a raw connection string for ad-hoc connections.

### `resetClient(): void`

Clears cached client singletons. Used in tests to get a clean state between test runs.

---

## Transactions

### `withTransaction<T>(db, fn): Promise<T>`

Executes a function inside a database transaction with automatic `BEGIN`/`COMMIT`/`ROLLBACK`.

```ts
import { withTransaction } from '@revealui/db'
import { getRestClient } from '@revealui/db/client'

const db = getRestClient()

const result = await withTransaction(db, async (tx) => {
  await tx.insert(schema.users).values({ ... })
  await tx.insert(schema.sites).values({ ... })
  return 'done'
})
```

> **Important:** Transactions only work with node-postgres (Supabase/localhost). The Neon HTTP driver does not support multi-statement transactions.

---

## Pool Management

### `getPoolMetrics(): PoolMetrics[]`

Returns connection pool stats for all active pools.

```ts
interface PoolMetrics {
  name: string
  totalCount: number
  idleCount: number
  waitingCount: number
}
```

### `closeAllPools(): Promise<void>`

Gracefully closes all connection pools. Call this in your shutdown handler.

---

## Schema Tables

All tables are defined with Drizzle ORM and exported from subpath modules.

### Users & Auth

```ts
import { users, sessions, passwordResetTokens } from '@revealui/db/schema/users'
```

| Table | Key columns |
|-------|-------------|
| `users` | `id`, `email`, `name`, `password`, `role`, `status`, `createdAt` |
| `sessions` | `id`, `userId`, `tokenHash`, `expiresAt`, `persistent`, `ipAddress` |
| `passwordResetTokens` | `id`, `userId`, `tokenHash`, `salt`, `usedAt`, `expiresAt` |

### Content

```ts
import { sites, siteCollaborators } from '@revealui/db/schema/sites'
import { pages, pageRevisions } from '@revealui/db/schema/pages'
import { posts, media } from '@revealui/db/schema/cms'
```

### Agents & AI

```ts
import { agentMemories, agentContexts, agentActions, conversations } from '@revealui/db/schema/agents'
```

### Billing

```ts
import { licenses } from '@revealui/db/schema/licenses'
import { userApiKeys, tenantProviderConfigs } from '@revealui/db/schema/api-keys'
```

### Audit & Monitoring

```ts
import { auditLog, appLogs, errorEvents } from '@revealui/db/schema/rest'
```

---

## Querying (Drizzle ORM)

Use standard Drizzle ORM query syntax:

```ts
import { getRestClient } from '@revealui/db/client'
import { users, sessions } from '@revealui/db/schema/users'
import { eq, and, gt } from 'drizzle-orm'

const db = getRestClient()

// Select
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.status, 'active'))

// Insert
const [newUser] = await db
  .insert(users)
  .values({ id: crypto.randomUUID(), email, name, role: 'editor' })
  .returning()

// Update
await db
  .update(users)
  .set({ lastActiveAt: new Date() })
  .where(eq(users.id, userId))

// Delete
await db.delete(sessions).where(eq(sessions.userId, userId))
```

---

## Encryption

Import from `@revealui/db/crypto`.

Requires `REVEALUI_KEK` env var — a 64-character hex string (32 bytes), used as the key-encryption key.

```bash
# Generate a KEK:
openssl rand -hex 32
```

### `encryptApiKey(plaintext: string): string`

Encrypts a string with AES-256-GCM. Returns a dot-separated base64url string:
`<iv>.<authTag>.<ciphertext>`

```ts
import { encryptApiKey } from '@revealui/db/crypto'

const encrypted = encryptApiKey('sk-live-...')
// Store encrypted value in database
```

### `decryptApiKey(encrypted: string): string`

Decrypts an encrypted API key. Throws if the ciphertext has been tampered with (GCM authentication tag mismatch).

```ts
import { decryptApiKey } from '@revealui/db/crypto'

const plaintext = decryptApiKey(row.encryptedKey)
```

### `redactApiKey(plaintext: string): string`

Returns a safe display hint showing only the last 4 characters: `...xxxx`.

```ts
const hint = redactApiKey('sk-live-abc123xyz')
// '...xyz'
```

---

## TypeScript Types

Import from `@revealui/db/types` or directly from schema subpaths:

```ts
import type { User, Session, Site, Page, Post } from '@revealui/db'
```

Each table has three associated types:

| Pattern | Description |
|---------|-------------|
| `User` | Read type (full row from `SELECT`) |
| `NewUser` | Insert type (for `INSERT INTO`) |
| `UserUpdate` | Update type (partial, for `UPDATE SET`) |

---

## Migrations

Migrations are versioned SQL files in `packages/db/migrations/`.

```bash
# Apply all pending migrations
pnpm db:migrate

# Reset and re-apply all migrations
pnpm db:reset
```

Migration files follow the pattern `NNNN_description.sql`. Run them in order against your NeonDB instance.

---

## Related

- [`@revealui/auth`](/reference/auth) — Uses `users`, `sessions`, `passwordResetTokens`
- [`@revealui/contracts`](/reference/contracts) — Zod schemas mapping to DB rows
- [Database architecture](/docs/DATABASE) — Dual-DB design, schema overview
