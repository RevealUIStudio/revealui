# Agent Quick Start Guide

**Last Updated**: 2025-01-27  
**Purpose**: Entry point for AI agents working on RevealUI Framework

---

## 🎯 Start Here

If you're an AI agent working on this codebase, read this document first to understand the project structure, current state, and how to navigate the documentation.

---

## Current State (2025-01-27)

### Project Overview
- **Framework**: RevealUI - Enterprise React 19 + Next.js 16 CMS Framework
- **Package Count**: 11 packages (reduced from 13 after merge)
- **Package Merge**: `@revealui/types` + `@revealui/generated` → `@revealui/core` (completed 2025-01-27)
- **Test Status**: 211/211 tests passing ✅
- **Build Status**: All packages build successfully ✅

### Package Structure
```
packages/
├── revealui/     # Core CMS framework (includes types/ and generated/)
├── db/           # Database (Drizzle ORM)
├── ai/           # AI system (memory, LLM, orchestration)
├── schema/       # Zod schemas (contract layer)
├── auth/         # Authentication system
├── services/     # External services (Stripe, Supabase)
├── sync/         # ElectricSQL client
├── presentation/ # UI components
├── config/       # Environment config
├── dev/          # Dev tooling
└── test/         # Test utilities
```

---

## 📚 Key Files to Read First

### 1. Package Structure
- **[Package Conventions](../packages/PACKAGE-CONVENTIONS.md)** - How packages are organized
- **[Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md)** - Recent package changes

### 2. Current Status
- **[Documentation Status](./STATUS.md)** - Current project state (see below)
- **[Package Merge Assessment](./assessments/PACKAGE_MERGE_ASSESSMENT.md)** - Package structure analysis

### 3. Architecture
- **[Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)** - System architecture
- **[Package Conventions](../packages/PACKAGE-CONVENTIONS.md)** - Package organization

### 4. Code Conventions
- **[Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)** - AI-assisted development guidelines
- **[Root .cursorrules](../.cursorrules)** - Project-specific rules

---

## 🔍 Common Tasks & Where to Find Docs

### Adding a New Feature
1. Review [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
2. Check [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)
3. Follow [Testing Strategy](./development/testing/TESTING-STRATEGY.md)

### Working with Types
1. [Type Generation Guide](./reference/database/TYPE_GENERATION_GUIDE.md)
2. [Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md)
3. [Package Conventions - Types Section](../packages/PACKAGE-CONVENTIONS.md#types-and-generated-code)

### Database Operations
1. [Database Types Reference](./reference/database/DATABASE_TYPES_REFERENCE.md)
2. [Drizzle Guide](./development/DRIZZLE-GUIDE.md)
3. [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md)

### Authentication
1. [Auth System Design](./reference/auth/AUTH_SYSTEM_DESIGN.md)
2. [Auth Usage Examples](./guides/auth/AUTH_USAGE_EXAMPLES.md)
3. [Auth Migration Guide](./guides/auth/AUTH_MIGRATION_GUIDE.md)

### Deployment
1. [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md)
2. [CI/CD Guide](./development/CI-CD-GUIDE.md)
3. [Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md)

---

## 🚨 Important Conventions

### Import Paths
- Use `@/lib/*` for CMS app imports
- Use `revealui/*` for framework imports
- Use `@revealui/core/types` (NOT `@revealui/types` - merged)
- Use `@revealui/core/generated` (NOT `@revealui/generated` - merged)

### Code Style
- **Quotes**: Single quotes for strings, double for JSX
- **Semicolons**: Omit when not required
- **Module System**: ESM only (NO CommonJS)
- **Package Manager**: Always use `pnpm` (never `npx`, use `pnpm dlx`)

### Next.js 16
- `params` and `searchParams` are Promises - always await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes

---

## 📋 Documentation Structure

```
docs/
├── README.md                    # Main documentation index
├── AGENT_QUICK_START.md         # This file (agent entry point)
├── STATUS.md                    # Current state dashboard
├── guides/                      # User guides
├── reference/                   # Reference documentation
├── development/                # Development guides
├── assessments/                # Project assessments
├── migrations/                  # Migration guides
├── architecture/               # Architecture docs
└── archive/                    # Historical docs
```

---

## 🎯 Quick Reference

### Package Imports
```typescript
// ✅ CORRECT (current)
import type { Config } from '@revealui/core/types'
import { GeneratedComponent } from '@revealui/core/generated/components'

// ❌ WRONG (old, merged)
import type { Config } from '@revealui/types'
import { GeneratedComponent } from '@revealui/generated/components'
```

### Common Commands
```bash
# Build all packages
pnpm build

# Type check
pnpm typecheck:all

# Run tests
pnpm test

# Generate types
pnpm generate:revealui-types
```

---

## 🔗 Related Documentation

- [Main Documentation Index](./README.md)
- [Current Status Dashboard](./STATUS.md)
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
- [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)
- [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)

---

## ⚠️ Things to Avoid

1. **Don't use CommonJS** - Always use ESM (`import`/`export`)
2. **Don't use `npx`** - Use `pnpm dlx` instead
3. **Don't use old package paths** - `@revealui/types` and `@revealui/generated` are merged
4. **Don't forget to await** - `params` and `searchParams` are Promises in Next.js 16
5. **Don't use GraphQL** - This project uses REST APIs only

---

## 📊 Project Health

- **Tests**: 211/211 passing ✅
- **Build**: All packages build successfully ✅
- **Type Safety**: Strict TypeScript enabled ✅
- **Documentation**: Comprehensive (see [Documentation Audit](./DOCUMENTATION_AUDIT_2025.md))

---

**Need Help?** Check the [Main Documentation Index](./README.md) or [Current Status](./STATUS.md) for more information.
