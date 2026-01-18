# @revealui/contracts - Unified Contracts Package Proposal

## Overview

This document outlines the architecture for the unified `@revealui/contracts` package. ✅ **MIGRATION COMPLETE** - Schema merged into contracts:
- ✅ `@revealui/schema` - **DELETED** - All contract/schema definitions now in `@revealui/contracts`
- `@revealui/db` - Database contract bridges (type-safe DB ↔ Contract conversion)
- `@revealui/core` - CMS config contract validation (integrated)
- `@revealui/ai` - Agent schema contracts for memory/context
- `@revealui/actions` - Action validation against constraints (new validation layer)

## Architecture

```
@revealui/contracts/
├── package.json
├── src/
│   ├── index.ts                    # Main entry point (re-exports everything)
│   │
│   ├── foundation/                 # Core contract system
│   │   ├── index.ts
│   │   ├── contract.ts             # Contract<T> interface & utilities
│   │   ├── validation.ts           # Validation result types & helpers
│   │   ├── metadata.ts             # Contract metadata system
│   │   └── registry.ts             # Contract registry for lookup
│   │
│   ├── representation/             # Dual representation system
│   │   ├── index.ts
│   │   ├── human.ts                # Human representation schema
│   │   ├── agent.ts                # Agent representation schema
│   │   ├── dual-entity.ts          # DualEntity base schema
│   │   ├── embeddings.ts           # Embedding validation
│   │   └── utilities.ts            # Conversion helpers
│   │
│   ├── entities/                   # Domain entity contracts
│   │   ├── index.ts
│   │   ├── user.ts                 # User entity contract
│   │   ├── site.ts                 # Site entity contract
│   │   ├── page.ts                 # Page entity contract
│   │   └── factories.ts            # Entity factory functions
│   │
│   ├── content/                    # Content contracts
│   │   ├── index.ts
│   │   ├── blocks.ts               # Block schemas & types
│   │   ├── block-factories.ts      # Block creation utilities
│   │   └── block-utils.ts          # Block traversal & manipulation
│   │
│   ├── cms/                        # CMS configuration contracts
│   │   ├── index.ts
│   │   ├── config.ts               # Root Config contract
│   │   ├── collection.ts           # Collection config contract
│   │   ├── field.ts                # Field config contract
│   │   ├── global.ts               # Global config contract
│   │   ├── structure.ts            # Structure schemas (Zod)
│   │   ├── functions.ts            # Function contract types (TS only)
│   │   ├── extensibility.ts        # Plugin & custom field extensions
│   │   ├── errors.ts               # Validation errors
│   │   └── compat.ts               # CMS compatibility adapters
│   │
│   ├── agents/                     # Agent contracts
│   │   ├── index.ts
│   │   ├── context.ts              # Agent context schema
│   │   ├── memory.ts               # Agent memory schema
│   │   ├── conversation.ts         # Conversation schema
│   │   ├── definition.ts           # Agent definition schema
│   │   ├── tools.ts                # Tool definition schema
│   │   └── state.ts                # Agent state schema
│   │
│   ├── database/                   # Database contract bridges
│   │   ├── index.ts
│   │   ├── bridge.ts               # Contract ↔ DB type conversion
│   │   ├── registry.ts             # Table-to-contract mapping
│   │   ├── type-bridge.ts          # Type-safe DB type extraction
│   │   └── validation.ts           # DB row validation utilities
│   │
│   ├── actions/                    # Action validation (NEW)
│   │   ├── index.ts
│   │   ├── constraint-checker.ts   # Validate constraints
│   │   ├── permission-checker.ts   # Validate permissions
│   │   ├── capability-checker.ts   # Validate capabilities
│   │   ├── action-validator.ts     # Complete action validation
│   │   └── errors.ts               # Action validation errors
│   │
│   └── utilities/                  # Shared utilities
│       ├── index.ts
│       ├── type-helpers.ts         # TypeScript utility types
│       ├── versioning.ts           # Schema versioning utilities
│       └── migrations.ts           # Migration helpers
│
└── package.json
```

## Package Structure

### 1. Foundation (`/foundation`)

Core contract system that everything builds on.

```typescript
// foundation/contract.ts
export interface Contract<T> {
  readonly metadata: ContractMetadata
  readonly schema: z.ZodSchema<T>
  validate(data: unknown): ContractValidationResult<T>
  isType(data: unknown): data is T
  parse(data: unknown): T
  safeParse(data: unknown): ContractValidationResult<T>
}

export function createContract<T>(options: CreateContractOptions<T>): Contract<T>
```

### 2. Representation (`/representation`)

Dual representation system for human/agent views.

```typescript
// representation/index.ts
export { HumanRepresentationSchema, type HumanRepresentation } from './human'
export { AgentRepresentationSchema, type AgentRepresentation } from './agent'
export { DualEntitySchema, type DualEntity } from './dual-entity'
export { createEmbedding, validateEmbedding } from './embeddings'
export { toHumanRepresentation, toAgentRepresentation } from './utilities'
```

### 3. Entities (`/entities`)

Domain entity contracts (User, Site, Page).

```typescript
// entities/index.ts
export { UserSchema, type User, createUser } from './user'
export { SiteSchema, type Site, createSite } from './site'
export { PageSchema, type Page, createPage } from './page'
```

### 4. Content (`/content`)

Content block contracts.

```typescript
// content/index.ts
export { BlockSchema, type Block, BLOCK_SCHEMA_VERSION } from './blocks'
export { createTextBlock, createImageBlock } from './block-factories'
export { walkBlocks, findBlockById } from './block-utils'
```

### 5. CMS (`/cms`)

CMS configuration contracts (consolidated from schema/core/contracts).

```typescript
// cms/index.ts
export { ConfigContract, validateConfigStructure } from './config'
export { CollectionContract, validateCollection } from './collection'
export { FieldContract, validateField } from './field'
export { GlobalContract, validateGlobal } from './global'
export { ConfigValidationError } from './errors'
export { registerCustomFieldType } from './extensibility'
```

### 6. Agents (`/agents`)

Agent contracts for memory, context, conversations.

```typescript
// agents/index.ts
export { AgentContextSchema, type AgentContext } from './context'
export { AgentMemorySchema, type AgentMemory } from './memory'
export { ConversationSchema, type Conversation } from './conversation'
export { AgentDefinitionSchema, type AgentDefinition } from './definition'
export { ToolDefinitionSchema, type ToolDefinition } from './tools'
```

### 7. Database (`/database`)

Database contract bridges (consolidated from schema/core/contracts/database-contract).

```typescript
// database/index.ts
export { dbRowToContract, contractToDbInsert } from './bridge'
export { DatabaseContractRegistry } from './registry'
export type { 
  TableRowType, 
  TableInsertType, 
  TableUpdateType 
} from './type-bridge'

// Usage:
import { UserSchema } from '@revealui/contracts/entities'
import { dbRowToContract } from '@revealui/contracts/database'

const dbUser = await db.query.users.findFirst()
const validatedUser = dbRowToContract(UserSchema, dbUser)
```

### 8. Actions (`/actions`) - NEW

Action validation layer that validates against schema constraints.

```typescript
// actions/index.ts
export { validateAction, checkConstraints } from './action-validator'
export { checkPermissions } from './permission-checker'
export { checkCapabilities } from './capability-checker'
export { ActionValidationError } from './errors'

// Usage:
import { PageSchema } from '@revealui/contracts/entities'
import { validateAction } from '@revealui/contracts/actions'

const result = validateAction({
  entity: page,
  action: 'update',
  agent: agentDefinition,
  changes: { title: 'New Title' }
})

if (!result.success) {
  throw new ActionValidationError(result.errors)
}
```

## Package Exports

```json
{
  "name": "@revealui/contracts",
  "exports": {
    ".": "./dist/index.js",
    "./foundation": "./dist/foundation/index.js",
    "./representation": "./dist/representation/index.js",
    "./entities": "./dist/entities/index.js",
    "./content": "./dist/content/index.js",
    "./cms": "./dist/cms/index.js",
    "./agents": "./dist/agents/index.js",
    "./database": "./dist/database/index.js",
    "./actions": "./dist/actions/index.js",
    "./utilities": "./dist/utilities/index.js"
  }
}
```

## Implementation Details

### Contract System Unification

All schemas become contracts using the unified `Contract<T>` interface:

```typescript
// Before (in @revealui/schema - DELETED):
export const UserSchema = z.object({ ... })
export type User = z.infer<typeof UserSchema>

// After (in @revealui/contracts):
export const UserContract = createContract({
  name: 'User',
  version: '1.0.0',
  schema: z.object({ ... }),
  description: 'User entity contract'
})

export type User = ContractType<typeof UserContract>
// Also export schema for backward compatibility:
export const UserSchema = UserContract.schema
```

### Database Integration

Database contract bridges allow type-safe conversion:

```typescript
// database/bridge.ts
export function dbRowToContract<T>(
  contract: Contract<T>,
  dbRow: unknown
): T {
  return contract.parse(dbRow)
}

export function contractToDbInsert<TContract, TInsert>(
  contractData: TContract
): TInsert {
  // Type-safe conversion with validation
  return contractData as unknown as TInsert
}

// Usage in @revealui/db (which becomes a thin wrapper):
import { UserContract, dbRowToContract } from '@revealui/contracts'

export async function findUser(id: string) {
  const dbRow = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!dbRow) return null
  return dbRowToContract(UserContract, dbRow)
}
```

### CMS Config Validation

CMS config validation becomes part of contracts:

```typescript
// cms/config.ts
export const ConfigContract = createContract({
  name: 'Config',
  version: '1.0.0',
  schema: ConfigStructureSchema,
  description: 'RevealUI CMS configuration contract'
})

export function validateConfigStructure(config: unknown) {
  return ConfigContract.validate(config)
}

// Usage in @revealui/core:
import { validateConfigStructure, ConfigValidationError } 
  from '@revealui/contracts/cms'

export function buildConfig(config: Config) {
  const result = validateConfigStructure(config)
  if (!result.success) {
    throw new ConfigValidationError(result.errors, 'config')
  }
  // ... rest of config building
}
```

### Action Validation

New action validation layer validates against entity constraints:

```typescript
// actions/action-validator.ts
export interface ActionValidationContext {
  entity: DualEntity
  action: string
  agent: AgentDefinition
  changes?: Record<string, unknown>
  permissions?: string[]
}

export function validateAction(
  context: ActionValidationContext
): ActionValidationResult {
  const { entity, action, agent, changes } = context
  
  // 1. Check if action exists in agent.agent.actions
  const actionDef = entity.agent.actions?.find(a => a.name === action)
  if (!actionDef) {
    return { success: false, errors: ['Action not available'] }
  }
  
  // 2. Check constraints
  const constraintResult = checkConstraints(entity, changes)
  if (!constraintResult.success) {
    return constraintResult
  }
  
  // 3. Check capabilities
  if (actionDef.requiredCapabilities) {
    const capabilityResult = checkCapabilities(agent, actionDef.requiredCapabilities)
    if (!capabilityResult.success) {
      return capabilityResult
    }
  }
  
  // 4. Check permissions
  const permissionResult = checkPermissions(context.permissions, actionDef)
  if (!permissionResult.success) {
    return permissionResult
  }
  
  return { success: true }
}

// Usage in @revealui/actions:
import { validateAction } from '@revealui/contracts/actions'

export async function updatePage(params: UpdatePageParams) {
  const page = await getPage(params.id)
  const agent = await getAgent(params.agentId)
  
  const validation = validateAction({
    entity: page,
    action: 'update',
    agent,
    changes: params.changes,
    permissions: params.userPermissions
  })
  
  if (!validation.success) {
    throw new ActionValidationError(validation.errors)
  }
  
  // Proceed with update...
}
```

## Migration Strategy

### Phase 1: Create New Package Structure
1. Create `packages/contracts` directory
2. Set up package.json with all exports
3. Create foundation contract system
4. Migrate representation layer

### Phase 2: Migrate Existing Contracts ✅ **COMPLETED**
1. ✅ Migrated entity contracts from `@revealui/schema` → `@revealui/contracts/entities`
2. ✅ Migrated CMS contracts from `@revealui/schema/core/contracts` → `@revealui/contracts/cms`
3. ✅ Migrated agent contracts from `@revealui/schema/agents` → `@revealui/contracts/agents`
4. ✅ Migrated content contracts from `@revealui/schema/blocks` → `@revealui/contracts/content`

### Phase 3: Add New Functionality
1. Implement database contract bridges
2. Implement action validation layer
3. Add migration utilities

### Phase 4: Update Dependencies
1. Update `@revealui/db` to use `@revealui/contracts/database`
2. Update `@revealui/core` to use `@revealui/contracts/cms`
3. Update `@revealui/ai` to use `@revealui/contracts/agents`
4. Update `@revealui/actions` to use `@revealui/contracts/actions`

### Phase 5: Deprecate Old Package ✅ **COMPLETED**
1. ✅ `@revealui/schema` package deleted
2. ✅ All internal imports updated to `@revealui/contracts`
3. ✅ Schema package fully removed
4. ✅ Migration complete - no backward compatibility needed

## Benefits

1. **Single Source of Truth**: All contracts in one place
2. **Type Safety**: End-to-end type safety from DB to UI
3. **Validation**: Runtime validation at every layer
4. **Action Validation**: New capability to validate actions against constraints
5. **Better Organization**: Clear module boundaries
6. **Easier Maintenance**: Changes to contracts in one place
7. **Better DX**: ✅ Clearer import paths (`@revealui/contracts/cms` vs deprecated `@revealui/schema/core/contracts`)

## Example Usage

```typescript
// Complete example: Create, validate, persist, and validate actions

import { 
  PageContract, 
  createPage 
} from '@revealui/contracts/entities'

import { 
  dbRowToContract, 
  contractToDbInsert 
} from '@revealui/contracts/database'

import { 
  validateAction 
} from '@revealui/contracts/actions'

// 1. Create entity using contract
const newPage = createPage('page-123', {
  siteId: 'site-456',
  title: 'Hello World',
  slug: 'hello-world'
})

// 2. Validate structure
const validation = PageContract.validate(newPage)
if (!validation.success) {
  throw new Error('Invalid page structure')
}

// 3. Convert to DB insert format
const dbInsert = contractToDbInsert(newPage, pageInsertType)
await db.insert(pages).values(dbInsert)

// 4. Load from DB with validation
const dbRow = await db.query.pages.findFirst()
const validatedPage = dbRowToContract(PageContract, dbRow)

// 5. Validate action before applying
const actionResult = validateAction({
  entity: validatedPage,
  action: 'update',
  agent: agentDefinition,
  changes: { title: 'New Title' },
  permissions: userPermissions
})

if (!actionResult.success) {
  throw new ActionValidationError(actionResult.errors)
}

// 6. Apply changes...
```

## API Summary

### Main Exports

```typescript
// Everything
import { ... } from '@revealui/contracts'

// Foundation
import { Contract, createContract } from '@revealui/contracts/foundation'

// Representation
import { DualEntitySchema, createEmbedding } from '@revealui/contracts/representation'

// Entities
import { UserContract, PageContract, SiteContract } from '@revealui/contracts/entities'

// Content
import { BlockSchema, createTextBlock } from '@revealui/contracts/content'

// CMS
import { ConfigContract, CollectionContract } from '@revealui/contracts/cms'

// Agents
import { AgentMemorySchema, AgentContextSchema } from '@revealui/contracts/agents'

// Database
import { dbRowToContract, contractToDbInsert } from '@revealui/contracts/database'

// Actions (NEW)
import { validateAction, checkConstraints } from '@revealui/contracts/actions'
```

This unified package provides a complete contract system that ensures type safety and validation across the entire RevealUI stack.
