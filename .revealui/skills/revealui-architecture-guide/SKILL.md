---
name: revealui-architecture-guide
description: RevealUI monorepo architecture and package organization guide
version: "1.0.0"
author: RevealUI Team
tags:
  - architecture
  - monorepo
  - packages
compatibility:
  - claude-code
  - universal
allowedTools:
  - Read
  - Glob
  - Grep
---

# RevealUI Architecture Guide

Understanding RevealUI's monorepo structure and architectural decisions.

## Monorepo Structure

RevealUI uses **pnpm workspaces** for monorepo management with **Turborepo** for build orchestration.

```
RevealUI/
├── apps/                    # Applications
│   ├── cms/                # CMS application (Next.js 16)
│   └── dashboard/          # Dashboard application
├── packages/               # Shared packages
│   ├── ai/                 # AI/LLM integration
│   ├── auth/               # Authentication
│   ├── config/             # Configuration management
│   ├── contracts/          # API contracts
│   ├── core/               # Core CMS (Payload)
│   ├── db/                 # Database schemas (Drizzle)
│   ├── dev/                # Development tooling
│   ├── security/           # Security utilities
│   └── ui/                 # UI components
├── scripts/                # Build & maintenance scripts
└── docs/                   # Documentation
```

## Package Roles

### Core Packages

**@revealui/core** - RevealUI CMS Core
- RevealUI singleton instance
- Collection definitions (Users, Posts, Pages, etc.)
- Global configurations (Header, Footer, etc.)
- Database integration
- **Status**: Critical path, stable

**@revealui/db** - Database layer
- Drizzle ORM schemas
- PostgreSQL/PGlite adapters
- Migration management
- **Status**: Stable

**@revealui/auth** - Authentication & Authorization
- JWT management
- Role-based access control (RBAC)
- Session handling
- **Status**: Stable

### Feature Packages

**@revealui/ai** - AI Integration
- Memory subsystem (vector stores, CRDT-based state)
- Skills system (GitHub, local, Vercel integration)
- LLM client abstractions
- Embeddings generation
- **Status**: Active development

**@revealui/security** - Security utilities
- Input sanitization
- CSRF protection
- Rate limiting
- **Status**: Stable

### Infrastructure Packages

**@revealui/config** - Configuration
- Environment variable management
- Type-safe config with Zod validation
- Multi-environment support
- **Status**: Stable

**@revealui/contracts** - Type contracts
- Shared TypeScript interfaces
- API response types
- Domain models
- **Status**: Stable

**@revealui/ui** - UI Components
- Tailwind CSS v4 components
- Accessible primitives
- Dark mode support
- **Status**: Active development

**@revealui/dev** - Development tooling
- TypeScript configurations
- Build scripts
- Testing utilities
- **Status**: Stable

## Dependency Flow

```
apps/admin
  ├─→ @revealui/core
  │    ├─→ @revealui/db
  │    ├─→ @revealui/auth
  │    └─→ @revealui/config
  ├─→ @revealui/ui
  └─→ @revealui/ai

```

### Dependency Rules

1. **No circular dependencies** between packages
2. **Packages import from packages**, never from apps
3. **Apps import packages**, not other apps
4. **Core utilities** (db, auth, config) are foundational
5. **Feature packages** (ai, security) depend on core

## Technology Stack

### Frontend
- **React 19** - UI library with Server Components
- **Next.js 16** - App Router framework
- **Tailwind CSS v4** - Styling (10-100x faster builds)
- **TypeScript 6** - Type safety

### Backend
- **RevealUI Core** - Admin dashboard + content engine
- **Drizzle ORM** - Type-safe database queries
- **PostgreSQL** (NeonDB) - Production database
- **PGlite** - Test database

### Development
- **pnpm** - Package manager
- **Turborepo** - Build orchestration
- **Vitest** - Testing framework
- **Biome** - Linting & formatting

## Build System

### Turborepo Configuration

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Build Order

1. **Core packages** (db, auth, config, contracts)
2. **Feature packages** (ai, security, ui)
3. **Applications** (cms, dashboard)

### Commands

```bash
# Build everything
pnpm build

# Build specific package
pnpm --filter @revealui/core build

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Type check all packages
pnpm typecheck
```

## Package Development

### Creating a New Package

```bash
# 1. Create package directory
mkdir -p packages/my-package/src

# 2. Create package.json
{
  "name": "@revealui/my-package",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  }
}

# 3. Create tsconfig.json
{
  "extends": "@revealui/dev/ts/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}

# 4. Create src/index.ts
export * from './my-feature'

# 5. Update root pnpm-workspace.yaml (if needed)
```

### Package Best Practices

1. **Single Responsibility**: Each package does one thing well
2. **Clear Exports**: Export only public API
3. **Type Safety**: Comprehensive TypeScript types
4. **Documentation**: README.md with examples
5. **Tests**: Unit tests for core functionality

## Common Patterns

### Importing Between Packages

```typescript
// ✅ GOOD: Import from package
import { getRevealUI } from '@revealui/core'
import { validateToken } from '@revealui/auth'

// ❌ BAD: Relative imports across packages
import { getRevealUI } from '../../../core/src/instance'
```

### Shared Types

```typescript
// packages/contracts/src/user.ts
export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

// Used everywhere
import type { User } from '@revealui/contracts'
```

### Configuration

```typescript
// packages/config/src/index.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL,
  },
  auth: {
    secret: process.env.REVEALUI_SECRET,
  },
}

// Used in packages
import { config } from '@revealui/config'
```

## File Organization

### Package Structure

```
packages/my-package/
├── src/
│   ├── index.ts           # Public API
│   ├── core/              # Core functionality
│   ├── utils/             # Utilities
│   └── __tests__/         # Tests
├── dist/                  # Build output (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### App Structure

```
apps/admin/
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (frontend)/    # Public pages
│   │   ├── (backend)/     # Admin pages
│   │   └── api/           # API routes
│   ├── lib/               # CMS configuration
│   │   ├── collections/   # RevealUI collections
│   │   ├── globals/       # RevealUI globals
│   │   ├── blocks/        # Content blocks
│   │   └── components/    # React components
│   └── __tests__/         # Tests
├── public/                # Static assets
└── next.config.mjs
```

## Key Architectural Decisions

### 1. Monorepo Benefits
- **Code sharing**: Shared packages across apps
- **Consistent tooling**: Unified build/test/lint
- **Atomic commits**: Changes across packages
- **Type safety**: Compiler enforces contracts

### 2. Package Boundaries
- **Clear interfaces**: Explicit exports
- **Testability**: Packages tested independently
- **Reusability**: Can extract to external packages
- **Maintainability**: Easy to locate code

### 3. TypeScript First
- **Type safety**: Catch errors at compile time
- **Documentation**: Types serve as docs
- **Refactoring**: Safe to change code
- **Developer experience**: IntelliSense everywhere

### 4. Test Strategy
- **Unit tests**: Per package
- **Integration tests**: In apps
- **E2E tests**: Critical user flows
- **Test database**: PGlite for speed

## Performance Considerations

### Build Performance
- **Incremental builds**: Turborepo caching
- **Parallel execution**: Multiple packages at once
- **Selective builds**: Only changed packages

### Runtime Performance
- **Code splitting**: Dynamic imports
- **Tree shaking**: Dead code elimination
- **Server Components**: Reduce client bundle
- **Edge deployment**: Vercel Edge Network

## Migration Guide

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter @revealui/core add package-name

# Add to root (dev tools)
pnpm add -D -w package-name
```

### Moving Code Between Packages

1. Create new file in target package
2. Move & update imports
3. Export from target package index
4. Update consuming packages
5. Run `pnpm build` to verify
6. Delete old file

## Resources

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo](https://turbo.build/repo/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM](https://orm.drizzle.team)

Understanding this architecture enables effective RevealUI development! 🏗️
