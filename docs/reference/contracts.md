# @revealui/contracts

Zod schemas, TypeScript types, and runtime contracts — the single source of truth for all data shapes across RevealUI. Used by every package in the monorepo.

```bash
npm install @revealui/contracts
```

## Subpath Exports

| Import path | Purpose |
|-------------|---------|
| `@revealui/contracts` | All contracts + A2A protocol |
| `@revealui/contracts/cms` | CMS config types and helpers |
| `@revealui/contracts/agents` | Agent definitions and memory |
| `@revealui/contracts/database` | DB ↔ contract mapping utilities |
| `@revealui/contracts/generated` | Generated row/insert/update types |
| `@revealui/contracts/blocks` | Content block types |
| `@revealui/contracts/core` | Core entity types (User, Site, Page) |

---

## CMS Configuration

Import from `@revealui/contracts/cms`.

### `defineCollection(name, config): CollectionConfig`

Type-safe helper for defining a CMS collection. Pass the result to `buildConfig({ collections: [...] })`.

```ts
import { defineCollection } from '@revealui/contracts/cms'

export const Posts = defineCollection('posts', {
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'publishedAt', type: 'date' },
  ],
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => req.user?.role === 'admin',
  },
  hooks: {
    beforeChange: [setPublishedAt],
    afterRead: [populateAuthor],
  },
})
```

### `defineGlobal(name, config): GlobalConfig`

Defines a singleton global (e.g. site settings, navigation).

```ts
import { defineGlobal } from '@revealui/contracts/cms'

export const SiteSettings = defineGlobal('site-settings', {
  fields: [
    { name: 'siteName', type: 'text' },
    { name: 'favicon', type: 'upload', relationTo: 'media' },
    { name: 'analytics', type: 'group', fields: [
      { name: 'googleAnalyticsId', type: 'text' },
    ]},
  ],
})
```

### `defineField(name, config): Field`

Type-safe helper for defining a field. Useful when sharing field definitions across collections.

```ts
import { defineField } from '@revealui/contracts/cms'

const statusField = defineField('status', {
  type: 'select',
  options: ['draft', 'published', 'archived'],
  defaultValue: 'draft',
})
```

### `mergeCollectionConfigs(...configs): CollectionConfig`

Merges multiple collection configs. Useful for extending base configs with app-specific overrides.

---

## Validation

### `safeValidate(schema, data): ValidationResult`

Validates data against a Zod schema without throwing. Returns a discriminated union.

```ts
import { safeValidate } from '@revealui/contracts/cms'
import { UserSchema } from '@revealui/contracts'

const result = safeValidate(UserSchema, unknownData)
if (result.success) {
  console.log(result.data) // User
} else {
  console.error(result.errors) // ZodError[]
}
```

### `validateWithErrors(schema, data): { valid: boolean; errors: ValidationError[] }`

Returns a structured error list suitable for displaying in forms.

---

## Core Entities

Import from `@revealui/contracts` or `@revealui/contracts/core`.

### User

```ts
interface User {
  id: string
  name: string
  email: string | null
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'inactive'
  preferences: UserPreferences
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date | null
}
```

- `createUser(input: CreateUserInput): User` — creates a new user entity with defaults
- `UserSchema`, `CreateUserInputSchema`, `UpdateUserInputSchema` — Zod schemas

### Site

```ts
interface Site {
  id: string
  name: string
  domain: string | null
  ownerId: string
  settings: SiteSettings
  seo: SiteSeo
  theme: SiteTheme
}
```

- `createSite(input: CreateSiteInput): Site`
- `canUserPerformAction(user, action, resource): boolean` — RBAC check
- `canAgentEditSite(agent, site): boolean` — AI agent permission check

### Page

```ts
interface Page {
  id: string
  siteId: string
  title: string
  slug: string
  path: string
  content: Block[]
  status: 'draft' | 'published' | 'archived'
  parentId: string | null
  seo: PageSeo
}
```

- `createPage(input: CreatePageInput): Page`
- `computePagePath(page): string` — computes URL path from hierarchy
- `getPageBreadcrumbs(page, pages): Page[]`
- `estimateWordCount(page): number`
- `isPageLocked(page): boolean` — collaborative editing lock
- `createPageLock(page, userId): PageLock`

---

## Content Blocks

Import from `@revealui/contracts/blocks`.

18 block types for building page content. Each block has a unique `type` discriminant.

```ts
type Block =
  | TextBlock | HeadingBlock | ImageBlock | CodeBlock
  | ButtonBlock | VideoBlock | EmbedBlock | DividerBlock
  | SpacerBlock | QuoteBlock | ListBlock | TableBlock
  | ColumnsBlock | GridBlock | FormBlock | AccordionBlock
  | TabsBlock | ComponentBlock
```

### Factory Functions

```ts
import { createTextBlock, createHeadingBlock, createImageBlock } from '@revealui/contracts/blocks'

const blocks: Block[] = [
  createHeadingBlock({ text: 'Getting Started', level: 2 }),
  createTextBlock({ text: 'This is the intro paragraph.' }),
  createImageBlock({ src: '/hero.png', alt: 'Hero image' }),
]
```

### Query Utilities

```ts
import { findBlockById, walkBlocks, countBlocks } from '@revealui/contracts/blocks'

// Walk all blocks recursively (including nested containers)
walkBlocks(blocks, (block) => {
  if (block.type === 'text') console.log(block.text)
})

// Count total blocks
const total = countBlocks(blocks) // includes nested

// Find by ID
const block = findBlockById(blocks, 'block-123')
```

### Type Guards

```ts
isTextBlock(block)        // block is TextBlock
isHeadingBlock(block)     // block is HeadingBlock
isImageBlock(block)       // block is ImageBlock
isContainerBlock(block)   // block is ColumnsBlock | GridBlock
isGroupField(field)       // field is GroupField
isLayoutField(field)      // field has sub-fields
isRelationshipField(field)
isArrayField(field)
```

---

## A2A Protocol (Agent-to-Agent)

Import from `@revealui/contracts` — these types implement the [Google A2A specification](https://github.com/google/A2A).

### Agent Cards

Agent cards are JSON discovery documents published at `/.well-known/agent.json`.

```ts
import { agentDefinitionToCard, toolDefinitionToSkill } from '@revealui/contracts'
import type { A2AAgentCard, A2ASkill } from '@revealui/contracts'

// Convert a RevealUI agent definition to a public discovery card
const card: A2AAgentCard = agentDefinitionToCard(agentDef, 'https://api.yourapp.com')
```

**`A2AAgentCard`:**
```ts
interface A2AAgentCard {
  name: string
  description: string
  url: string                         // JSON-RPC endpoint
  capabilities: A2ACapabilities
  skills: A2ASkill[]
  provider?: A2AProvider
  auth?: A2AAuth
}
```

### Tasks

Agents communicate via tasks sent to the JSON-RPC endpoint.

```ts
interface A2ATask {
  id: string
  sessionId: string
  status: A2ATaskStatus
  artifacts: A2AArtifact[]
  history: A2AMessage[]
  metadata?: Record<string, unknown>
}

type A2ATaskState =
  | 'submitted' | 'working' | 'input-required'
  | 'completed' | 'canceled' | 'failed' | 'unknown'
```

### Messages & Parts

```ts
interface A2AMessage {
  role: 'user' | 'agent'
  parts: A2APart[]
}

type A2APart =
  | { type: 'text'; text: string }
  | { type: 'data'; data: Record<string, unknown>; mimeType?: string }
  | { type: 'file'; mimeType: string; data?: string; uri?: string }
```

### JSON-RPC Envelope

```ts
interface A2AJsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: 'tasks/send' | 'tasks/sendSubscribe' | 'tasks/get' | 'tasks/cancel'
  params: A2ASendTaskParams | { id: string }
}
```

---

## Agents

Import from `@revealui/contracts/agents`.

```ts
interface AgentDefinition {
  agentId: string
  name: string
  description: string
  systemPrompt: string
  tools: ToolDefinition[]
  capabilities: string[]
}

interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
}
```

Factory functions:
- `createAgentMemory(input): AgentMemory`
- `createAgentContext(input): AgentContext`
- `createConversation(userId: string): Conversation`
- `createMessage(role, content): ConversationMessage`

---

## Database Bridge

Import from `@revealui/contracts/database`.

### `contractToDbInsert(contract, table): InsertObject`

Converts a contract entity to a Drizzle ORM insert shape.

### `dbRowToContract(row, contract): T`

Converts a raw database row to a contract type.

### `safeDbRowToContract(row, contract): T | ValidationError`

Validated conversion — returns a `ValidationError` instead of throwing if the row doesn't match.

---

## Generated Types

Import from `@revealui/contracts/generated`. These are auto-generated from the database schema — do not edit manually.

```ts
import type {
  UsersRow,   UsersInsert,   UsersUpdate,
  SitesRow,   SitesInsert,   SitesUpdate,
  PagesRow,   PagesInsert,   PagesUpdate,
  PostsRow,   PostsInsert,   PostsUpdate,
} from '@revealui/contracts/generated'
```

| Suffix | Use for |
|--------|---------|
| `Row` | Reading from the database (`SELECT`) |
| `Insert` | Writing new records (`INSERT INTO`) |
| `Update` | Partial updates (`UPDATE SET`) |

---

## Extensibility

### `registerCustomFieldType(name, config): void`

Registers a custom CMS field type that can be used in collection definitions.

### `registerPluginExtension(name, ext): void`

Registers a plugin field extension — adds new fields to existing collections at config-build time.

### `registerValidationRule(name, rule): void`

Registers a named validation rule that can be referenced in field definitions.

---

## Related

- [`@revealui/core`](/reference/core) — Uses contracts for config validation
- [`@revealui/db`](/reference/db) — Database schema that contracts map to
- [`@revealui/auth`](/reference/auth) — Uses `User`, `Session` contracts
