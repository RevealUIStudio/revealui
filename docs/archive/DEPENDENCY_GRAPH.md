# RevealUI Monorepo Dependency Analysis

## Complete Dependency Graph

This document provides a comprehensive analysis of all workspace dependencies in the RevealUI monorepo, organized by build layers.

---

## Package Dependency Layers

### Layer 0: Foundation (No workspace dependencies)
These packages have zero workspace dependencies and can build in parallel:

1. **dev** (`packages/dev`)
   - **Type**: Shared build tooling and configurations
   - **Workspace Dependencies**: None
   - **Purpose**: Provides TypeScript configs, ESLint, Biome, Tailwind, and Vite configurations
   - **Used by**: All packages as devDependency

2. **@revealui/utils** (`packages/utils`)
   - **Type**: Shared utilities
   - **Workspace Dependencies**: None
   - **Exports**: 
     - Logger utilities
     - Database helpers (SSL config)
     - Validation utilities
   - **Key for**: Low-level utility functions used across packages

3. **@revealui/config** (`packages/config`)
   - **Type**: Configuration management
   - **Workspace Dependencies**: None
   - **Exports**:
     - Environment configuration
     - RevealUI configuration
     - MCP configuration
   - **Key for**: Centralized config management

4. **@revealui/editors** (`packages/editors`)
   - **Type**: Editor integration system
   - **Workspace Dependencies**: None
   - **Exports**:
     - Editor adapters (VS Code, Neovim, Zed)
     - JSON-RPC server
     - Editor daemon
   - **Purpose**: Multi-editor bridge system

5. **@revealui/router** (`packages/router`)
   - **Type**: Routing library
   - **Workspace Dependencies**: None
   - **Exports**: File-based router with SSR support
   - **Purpose**: Lightweight routing for RevealUI apps

6. **@revealui/presentation** (`packages/presentation`)
   - **Type**: UI component library
   - **Workspace Dependencies**: None
   - **Exports**:
     - React components
     - Primitives
     - Client/server components
   - **Purpose**: Shared presentation layer

---

### Layer 1: Core Infrastructure
These packages depend only on Layer 0 packages:

7. **@revealui/db** (`packages/db`)
   - **Type**: Database layer
   - **Workspace Dependencies**:
     - `@revealui/config` (dependency)
     - `@revealui/utils` (dependency)
   - **Exports**:
     - Drizzle schema
     - Database client
     - Type definitions
     - Query utilities
   - **Key for**: Database schema and access layer

8. **@revealui/mcp** (`packages/mcp`)
   - **Type**: Model Context Protocol
   - **Workspace Dependencies**:
     - `@revealui/config` (dependency)
   - **Exports**: MCP server implementation
   - **Purpose**: Claude Desktop integration

---

### Layer 2: Contracts & Core
These packages depend on Layers 0-1:

9. **@revealui/contracts** (`packages/contracts`)
   - **Type**: Schemas and validation
   - **Workspace Dependencies**:
     - `@revealui/db` (devDependency + peerDependency)
   - **Exports**:
     - Unified schemas
     - Zod validation
     - Type-safe contracts
     - Generated database schemas
   - **Key for**: Type safety across the entire stack
   - **Note**: Uses @revealui/db as peer dependency to avoid duplication

10. **@revealui/core** (`packages/core`)
    - **Type**: Core CMS functionality
    - **Workspace Dependencies**:
      - `@revealui/contracts` (dependency)
      - `@revealui/utils` (dependency)
    - **Exports**:
      - Server functions
      - Plugin system
      - Authentication helpers
      - Database utilities
      - Storage layer
      - Rich text editor
      - Admin UI
      - NextJS integration
    - **Key for**: Primary CMS engine
    - **Most Critical Package**: Nearly all apps depend on this

---

### Layer 3: Services & Features
These packages build on the core infrastructure (Layers 0-2):

11. **@revealui/auth** (`packages/auth`)
    - **Type**: Authentication system
    - **Workspace Dependencies**:
      - `@revealui/config` (dependency)
      - `@revealui/contracts` (dependency)
      - `@revealui/core` (dependency)
      - `@revealui/db` (dependency)
    - **Exports**:
      - Server-side auth
      - Client-side auth
      - React hooks
    - **Purpose**: Database-backed session authentication

12. **@revealui/services** (`packages/services`)
    - **Type**: External service integrations
    - **Workspace Dependencies**:
      - `@revealui/config` (dependency)
      - `@revealui/core` (dependency)
    - **Exports**:
      - Supabase client
      - Stripe integration
      - Payment handlers
    - **Purpose**: Third-party service wrappers

13. **@revealui/sync** (`packages/sync`)
    - **Type**: Real-time synchronization
    - **Workspace Dependencies**:
      - `@revealui/contracts` (dependency)
      - `@revealui/db` (dependency)
    - **Exports**:
      - ElectricSQL sync utilities
      - React providers
    - **Purpose**: Real-time data sync with Electric

14. **@revealui/ai** (`packages/ai`)
    - **Type**: AI system
    - **Workspace Dependencies**:
      - `@revealui/contracts` (dependency)
      - `@revealui/core` (dependency)
      - `@revealui/db` (dependency)
    - **Exports**:
      - Memory system (episodic, vector)
      - LLM client/server
      - AI tools
      - Skills system
    - **Purpose**: AI memory, orchestration, and tool execution

---

### Layer 4: Developer Tools
These packages provide CLI and setup utilities:

15. **@revealui/setup** (`packages/setup`)
    - **Type**: Project setup utilities
    - **Workspace Dependencies**:
      - `@revealui/config` (dependency)
    - **Exports**:
      - Environment setup
      - Database setup
      - Configuration management
    - **Purpose**: Setup wizard for new projects

16. **@revealui/cli** (`packages/cli`)
    - **Type**: Command-line interface
    - **Workspace Dependencies**:
      - `@revealui/config` (dependency)
      - `@revealui/setup` (dependency)
    - **Exports**: `create-revealui` binary
    - **Purpose**: Project scaffolding CLI

---

### Layer 5: Testing Infrastructure
Depends on multiple layers for comprehensive testing:

17. **test** (`packages/test`)
    - **Type**: Testing utilities and fixtures
    - **Workspace Dependencies**:
      - `@revealui/ai` (dependency)
      - `@revealui/contracts` (dependency)
      - `@revealui/core` (dependency)
      - `@revealui/db` (dependency)
      - `@revealui/services` (dependency)
    - **Exports**:
      - Test setup utilities
      - Integration test helpers
      - Database fixtures
    - **Purpose**: Shared testing infrastructure

---

## Application Layer

Applications consume packages from various layers:

### 1. **api** (`apps/api`)
- **Type**: REST API server
- **Workspace Dependencies**:
  - `@revealui/config`
  - `@revealui/core`
  - `@revealui/db`
- **Build After**: Layer 2
- **Tech**: Hono + Node.js

### 2. **docs** (`apps/docs`)
- **Type**: Documentation site
- **Workspace Dependencies**:
  - `@revealui/core`
- **Build After**: Layer 2
- **Tech**: Vite + React Router

### 3. **landing** (`apps/landing`)
- **Type**: Marketing landing page
- **Workspace Dependencies**:
  - `@revealui/core`
  - `@revealui/db`
- **Build After**: Layer 2
- **Tech**: Next.js

### 4. **web** (`apps/mainframe`)
- **Type**: Main web application
- **Workspace Dependencies**:
  - `@revealui/presentation`
  - `@revealui/router`
  - `@revealui/core` (devDependency)
  - `@revealui/db` (devDependency)
- **Build After**: Layer 2
- **Tech**: Hono + React + Vite

### 5. **dashboard** (`apps/dashboard`)
- **Type**: Admin dashboard
- **Workspace Dependencies**:
  - `@revealui/ai`
  - `@revealui/core`
  - `@revealui/db`
- **Build After**: Layer 3
- **Tech**: Next.js

### 6. **cms** (`apps/cms`)
- **Type**: Full-featured CMS application
- **Workspace Dependencies**:
  - `@revealui/ai`
  - `@revealui/auth`
  - `@revealui/config`
  - `@revealui/contracts`
  - `@revealui/core`
  - `@revealui/db`
  - `@revealui/presentation`
  - `@revealui/services` (devDependency)
  - `@revealui/sync`
- **Build After**: Layer 3
- **Tech**: Next.js
- **Note**: Most complex app with 9 workspace dependencies

---

## Build Order with Turbo

### Current Configuration: `"dependsOn": ["^build"]`

The `^` prefix in Turbo tells it to build all workspace dependencies before building the current package.

### Parallel Build Execution

```
┌─────────────────────────────────────────────────────────┐
│ Layer 0: Foundation (builds in parallel)               │
├─────────────────────────────────────────────────────────┤
│ • dev                                                   │
│ • @revealui/utils                                       │
│ • @revealui/config                                      │
│ • @revealui/editors                                     │
│ • @revealui/router                                      │
│ • @revealui/presentation                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Core Infrastructure (builds in parallel)      │
├─────────────────────────────────────────────────────────┤
│ • @revealui/db         (needs: config, utils)          │
│ • @revealui/mcp        (needs: config)                 │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Contracts & Core (builds in parallel)         │
├─────────────────────────────────────────────────────────┤
│ • @revealui/contracts  (needs: db as peer)             │
│ • @revealui/core       (needs: contracts, utils)       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Services & Features (builds in parallel)      │
├─────────────────────────────────────────────────────────┤
│ • @revealui/auth       (needs: config, contracts,      │
│                                core, db)                │
│ • @revealui/services   (needs: config, core)           │
│ • @revealui/sync       (needs: contracts, db)          │
│ • @revealui/ai         (needs: contracts, core, db)    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Developer Tools (builds in parallel)          │
├─────────────────────────────────────────────────────────┤
│ • @revealui/setup      (needs: config)                 │
│ • @revealui/cli        (needs: config, setup)          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Testing                                        │
├─────────────────────────────────────────────────────────┤
│ • test                 (needs: ai, contracts, core,    │
│                                db, services)            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Applications (build based on dependencies)              │
├─────────────────────────────────────────────────────────┤
│ • api, docs, landing, web  (need Layer 2)              │
│ • dashboard, cms           (need Layer 3)              │
└─────────────────────────────────────────────────────────┘
```

---

## Critical Package Analysis

### 1. @revealui/core - The Foundation
**Why it's critical**: 9 out of 10 consumer packages depend on it

**Direct dependents**:
- Packages: @revealui/auth, @revealui/services, @revealui/ai, test
- Apps: api, docs, landing, web, dashboard, cms

**Risk**: If @revealui/core fails to build, nearly the entire monorepo is blocked.

**Mitigation**: 
- Strong test coverage
- Careful API design
- Minimal external dependencies

---

### 2. @revealui/db - The Data Layer
**Why it's critical**: Database schema affects all data-dependent packages

**Direct dependents**:
- Packages: @revealui/contracts (peer), @revealui/auth, @revealui/sync, @revealui/ai, test
- Apps: api, landing, dashboard, cms

**Risk**: Schema changes ripple through the entire stack.

**Mitigation**:
- Database migrations
- Peer dependency pattern (used by @revealui/contracts)
- Type generation from schema

---

### 3. @revealui/contracts - Type Safety
**Why it's critical**: Provides type-safe contracts across client/server

**Direct dependents**:
- Packages: @revealui/core, @revealui/auth, @revealui/sync, @revealui/ai, test
- Apps: cms

**Risk**: Breaking changes affect type safety everywhere.

**Mitigation**:
- Zod schemas for runtime validation
- Generated types from database
- Strict TypeScript configuration

---

## Turbo Configuration Analysis

### Current Configuration (turbo.json)

```json
{
  "tasks": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [...],
      "outputs": [...]
    }
  }
}
```

### Verification Results

#### ✅ 1. Dependency Resolution
**Status**: CORRECT

Turbo automatically reads workspace dependencies from each package.json and builds them in topological order. The `^build` syntax correctly ensures all upstream dependencies build first.

#### ✅ 2. Parallel Execution
**Status**: OPTIMAL

Packages at the same layer (with no inter-dependencies) build in parallel:
- Layer 0: 6 packages build simultaneously
- Layer 1: 2 packages build simultaneously
- Layer 3: 4 packages build simultaneously

**Result**: Significant build time savings compared to sequential builds.

#### ✅ 3. No Circular Dependencies
**Status**: VERIFIED

Analysis shows a proper directed acyclic graph (DAG):
- All dependencies flow in one direction
- No package depends on itself transitively
- Build order is deterministic

#### ✅ 4. Cache Efficiency
**Status**: WELL-CONFIGURED

Each package caches based on:
- Source files (`src/**`)
- Configuration (`package.json`, `tsconfig.json`)
- Build configs (`tsup.config.ts`, `vite.config.ts`)

**Result**: Only changed packages and their dependents rebuild.

---

## Recommendations

### 1. Current Setup is Excellent ✅
The monorepo has:
- Clear architectural layers
- Proper dependency direction
- No circular dependencies
- Optimal Turbo configuration

**Action**: No changes needed to turbo.json

---

### 2. Monitor Build Times ⏱️
**Observation**: CMS app depends on 9 packages

**Current situation**: This is expected for a full-featured CMS
**Action**: Monitor build performance over time
**Tools**: Use `turbo run build --profile` to identify bottlenecks

---

### 3. Consider Package Splitting (Future) 🔮
**Current**: @revealui/core is large with many exports

**Future consideration**: If build times grow, consider splitting into:
- `@revealui/core-server`
- `@revealui/core-client`
- `@revealui/core-richtext`

**Status**: Not urgent - only if build performance degrades

---

### 4. Peer Dependencies Pattern Works Well ✅
**Observation**: @revealui/contracts uses @revealui/db as peer dependency

**Benefit**: Prevents duplicate database instances
**Result**: Type safety without bundling issues

**Action**: Continue this pattern for shared infrastructure

---

### 5. Dev Package is Well-Designed ✅
**Observation**: `dev` package provides shared tooling without creating cycles

**Benefit**: Centralized configs reduce duplication
**Result**: Consistent linting, formatting, and TypeScript across packages

**Action**: Continue using for shared development tools

---

## Summary

### Build Order Verification: ✅ CORRECT

The current `turbo.json` configuration with `"dependsOn": ["^build"]` will correctly build all packages in the proper order based on their workspace dependencies.

### Key Strengths

1. **Well-structured layers**: Clear progression from infrastructure → core → features → apps
2. **No circular dependencies**: Clean directed acyclic graph
3. **Parallel execution**: Packages at each layer build simultaneously
4. **Efficient caching**: Only changed packages and dependents rebuild
5. **Type safety**: Contracts and schemas provide end-to-end type safety

### Architecture Quality: Excellent

The RevealUI monorepo demonstrates professional monorepo architecture with:
- Proper separation of concerns
- Reusable shared packages
- Clear dependency boundaries
- Scalable structure for future growth

### Conclusion

**Your turbo.json configuration is optimal and will build packages in the correct order. No changes are required.**

The dependency graph is well-designed, with clear layers and no circular dependencies. Turbo's `dependsOn: ["^build"]` configuration will automatically handle the correct build order based on the workspace dependencies declared in each package.json.
