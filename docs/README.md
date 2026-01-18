# RevealUI Framework Documentation

**Last Updated**: 2025-01-27  
**Status**: ✅ Active

Welcome to the RevealUI Framework documentation! This guide will help you navigate all available documentation.

## 🚀 Quick Start

### ⚠️ Important: Production Readiness

**Status:** 🔴 **NOT PRODUCTION READY** - Active Development

👉 **START HERE**: [Production Readiness Assessment](./PRODUCTION_READINESS.md)
- Current state and blockers
- What's working vs what's not
- Honest assessment

👉 **Path Forward**: [Production Roadmap](./PRODUCTION_ROADMAP.md)
- Clear, actionable steps
- Timeline and effort estimates
- Success criteria

👉 **Current Status**: [Status Dashboard](./STATUS.md)
- Single source of truth
- Quick status overview
- Package structure

### For AI Agents
👉 **Start here**: [Agent Quick Start Guide](./AGENT_QUICK_START.md)
- Current project state
- Key files to read first
- Common tasks and workflows
- Code conventions

### For Developers
👉 **First time?** Start with [Onboarding Guide](./guides/ONBOARDING.md) - Complete setup and orientation
👉 **Quick setup?** Use [Quick Start Guide](./guides/QUICK_START.md) - 5-minute setup guide
- Prerequisites checklist
- Common issues and solutions

> **Note:** Framework is in active development. Some features may not work until critical blockers are resolved.

### Navigation
- **[Master Index](./INDEX.md)** - Complete documentation index by topic, type, audience, and task
- **[Task-Based Guide](./TASKS.md)** - Find documentation by what you want to accomplish
- **[Keywords Index](./KEYWORDS.md)** - Search documentation by keyword, term, or concept

## Quick Links

### Essential (Read First)
- [**Production Readiness Assessment**](./PRODUCTION_READINESS.md) - ⚠️ **START HERE** - Current state and blockers
- [**Production Roadmap**](./PRODUCTION_ROADMAP.md) - Clear path to production readiness
- [**Status Dashboard**](./STATUS.md) - Single source of truth for project status

### Navigation
- [Agent Quick Start](./AGENT_QUICK_START.md) - **For AI agents** - Start here
- [Master Index](./INDEX.md) - **Complete documentation index** - Find docs by topic, type, audience, task
- [Task-Based Guide](./TASKS.md) - **Find docs by task** - "I want to..." navigation
- [Keywords Index](./KEYWORDS.md) - **Search by keyword** - Find docs by term or concept

### Guides
- [CI/CD Guide](./development/CI-CD-GUIDE.md) - Deployment with NeonDB and Vercel
- [Environment Variables](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment guide
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions

## Documentation Structure

### Getting Started

- **[Onboarding Guide](./guides/ONBOARDING.md)** - ⭐ **NEW USERS START HERE** - Complete first-time setup and orientation
- **[Quick Start Guide](./guides/QUICK_START.md)** - Quick 5-minute setup guide
- **[CI/CD Guide](./development/CI-CD-GUIDE.md)** - Deploy to production with NeonDB Postgres
- **[Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md)** - Complete setup guide with instructions
- **[Environment Variables Reference](./development/ENV-VARIABLES-REFERENCE.md)** - Quick reference table format
- **[Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md)** - Complete database setup guide

### Architecture & Planning

- **[CRDT Memory System](./archive/migrations/GRADE-A-CRDT-PLAN.md)** - Memory system implementation plan (archived)
- **[Prioritized Action Plan](./planning/PRIORITIZED_ACTION_PLAN.md)** - Project action plan
- **[Ralph Cohesion Engine Research](./planning/RALPH_COHESION_ENGINE_RESEARCH.md)** - Cohesion engine research
- **[Breaking Changes - CRDT](./migrations/BREAKING-CHANGES-CRDT.md)** - CRDT migration breaking changes
- **[Deprecated Types Removal](./migrations/DEPRECATED-TYPES-REMOVAL.md)** - Type deprecation guide
- **[Modernization Verification](./migrations/MODERNIZATION-VERIFICATION.md)** - Modernization verification report

### User Guides

#### Authentication

- **[Auth Migration Guide](./guides/auth/AUTH_MIGRATION_GUIDE.md)** - Guide for migrating from JWT to session-based auth
- **[Auth Usage Examples](./guides/auth/AUTH_USAGE_EXAMPLES.md)** - Code examples and usage patterns for the auth system
- **[Auth System Design](./reference/auth/AUTH_SYSTEM_DESIGN.md)** - Comprehensive authentication system design
- **[CSRF Protection Strategy](./development/CSRF_PROTECTION.md)** - CSRF protection implementation

#### Database

- **[Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md)** - Complete database setup guide
- **[Fresh Database Summary](./reference/database/FRESH-DATABASE-SUMMARY.md)** - Database setup summary
- **[Database Migration Plan](./reference/database/DATABASE-MIGRATION-PLAN.md)** - Database migration strategy
- **[Database Migration Verification](../packages/db/VERIFY-MIGRATION.md)** - Database migration verification guide
- **[Database Provider Switching](./reference/database/DATABASE-PROVIDER-SWITCHING.md)** - Switch between database providers
- **[Drizzle Guide](./development/DRIZZLE-GUIDE.md)** - Drizzle ORM / Neon HTTP integration guide
- **[ElectricSQL Integration](./development/electric-integration.md)** - ElectricSQL integration guide
- **[ElectricSQL Setup Guide](./development/electric-setup-guide.md)** - ElectricSQL setup instructions
- **[ElectricSQL Migrations](./reference/database/electric.migrations.sql)** - SQL migrations for table electrification
- **[TanStack DB Research](./reference/database/TANSTACK_DB_ELECTRIC_RESEARCH.md)** - Comprehensive analysis of TanStack DB and Electric SQL
- **[TanStack DB Benefits](./reference/database/TANSTACK_DB_BENEFITS_FOR_REVEALUI.md)** - Analysis of how TanStack DB could benefit RevealUI
- **[TanStack DB Implementation Plan](./reference/database/TANSTACK_DB_IMPLEMENTATION_PLAN.md)** - Detailed implementation plan
- **[Migrate Vercel Postgres to Supabase](./development/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md)** - Migration guide

#### Deployment

- **[Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md)** - Complete deployment guide
- **[Rollback Procedure](./development/ROLLBACK-PROCEDURE.md)** - Emergency rollback steps
- **[Docker WSL2 Setup](./development/DOCKER-WSL2-SETUP.md)** - Docker setup for WSL2

#### Testing

- **[Load Testing Guide](./development/testing/LOAD-TESTING-GUIDE.md)** - Performance testing guide
- **[Testing Strategy](./development/testing/TESTING-STRATEGY.md)** - Testing guidelines
- **[Coverage Report Template](./development/COVERAGE-REPORT-TEMPLATE.md)** - Test coverage report template

#### Configuration

- **[Neon API Key Setup](./guides/configuration/NEON_API_KEY_SETUP.md)** - Neon API key configuration

#### CMS & Content

- **[CMS Content Examples](./guides/CMS-CONTENT-EXAMPLES.md)** - Ready-to-use content examples
- **[CMS Content Recommendations](./guides/CMS-CONTENT-RECOMMENDATIONS.md)** - Content best practices
- **[CMS Frontend Connection Guide](./guides/CMS-FRONTEND-CONNECTION-GUIDE.md)** - Connecting CMS to frontend
- **[RevealUI Theme Usage Guide](./guides/REVEALUI-THEME-USAGE-GUIDE.md)** - Theme customization guide

### Reference Documentation

#### Configuration

- **[Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md)** - Configuration guide
- **[Environment Variables Reference](./development/ENV-VARIABLES-REFERENCE.md)** - Quick reference
- **[Supabase IPv4 Explanation](./reference/configuration/SUPABASE_IPV4_EXPLANATION.md)** - Supabase networking

#### Architecture

- **[Multi-tenant Architecture](./development/MULTI-TENANT-ARCHITECTURE.md)** - Multi-tenant patterns
- **[Custom Integrations](./development/CUSTOM-INTEGRATIONS.md)** - Third-party integrations
- **[Known Limitations](./development/KNOWN-LIMITATIONS.md)** - Current limitations

#### Reference

- **[Component Mapping](./reference/COMPONENT-MAPPING.md)** - Component, business logic, and schema mapping
- **[Dependencies List](./reference/DEPENDENCIES-LIST.md)** - Complete dependencies reference
- **[Frameworks List](./reference/FRAMEWORKS-LIST.md)** - Framework usage reference

### Development

#### Implementation

- **[P0 Fixes Implementation](./development/implementation/P0_FIXES_IMPLEMENTATION.md)** - Critical fixes implementation
- **[P1 Fixes Implementation](./development/implementation/P1_FIXES_IMPLEMENTATION.md)** - High-priority fixes implementation
- **[P2 Fixes Implementation](./development/implementation/P2_FIXES_IMPLEMENTATION.md)** - Medium-priority fixes implementation
- **[Priority 1 Fixes Complete](./development/implementation/PRIORITY_1_FIXES_COMPLETE.md)** - Priority 1 fixes completion summary
- **[File System Loading Implementation](./development/implementation/FILE_SYSTEM_LOADING_IMPLEMENTATION.md)** - File loading system
- **[Implementation Summary](./development/implementation/IMPLEMENTATION-SUMMARY.md)** - Implementation overview
- **[Phase 4 Verification Summary](./assessments/PHASE_4_VERIFICATION_SUMMARY.md)** - Phase 4 implementation summary
- **[Agent Handoff Hybrid Approach](./agent/AGENT_HANDOFF_HYBRID_APPROACH.md)** - Hybrid implementation approach
- **[Prompt for Next Agent](./agent/PROMPT_FOR_NEXT_AGENT.md)** - Agent handoff context

#### Testing

- **[Testing Strategy](./development/testing/TESTING-STRATEGY.md)** - Testing guidelines
- **[Penetration Testing Guide](./development/testing/PENETRATION-TESTING-GUIDE.md)** - Security testing guide

#### Tools & Processes

- **[Linting Guide](./LINTING.md)** - ESLint and Biome setup and usage
- **[Documentation Tools](./development/DOCUMENTATION-TOOLS.md)** - Documentation management tools
- **[Documentation Structure](./development/STRUCTURE.md)** - Documentation organization
- **[Documentation Index](./development/DOCUMENTATION_INDEX.md)** - Comprehensive documentation index
- **[Documentation Improvement Plan](./DOCUMENTATION_IMPROVEMENT_PLAN.md)** - Plan for making docs more agent/developer friendly
- **[Documentation Audit 2025](./DOCUMENTATION_AUDIT_2025.md)** - Project-wide documentation audit
- **[Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)** - Guidelines for AI-assisted development
- **[Package Conventions](../packages/PACKAGE-CONVENTIONS.md)** - Package organization conventions

**Historical Documentation**: Previous cleanup reports and reviews have been archived in `docs/archive/` and `docs/assessments/`.

### MCP (Model Context Protocol)

- **[MCP Setup Guide](./mcp/MCP_SETUP.md)** - Setting up MCP servers
- **[MCP Fixes 2025](./mcp/MCP_FIXES_2025.md)** - Recent MCP updates
- **[Next.js DevTools Demo](./mcp/NEXTJS_DEVTOOLS_MCP_DEMO.md)** - Demo and examples
- **[MCP Demo Interaction](./mcp/demo-mcp-interaction.md)** - MCP interaction examples
- **[MCP Quick Start](./mcp/QUICK_START.md)** - Using configured MCP servers
- **[Next.js DevTools Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md)** - DevTools MCP setup guide
- **[Next.js DevTools In Action](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md)** - DevTools examples and usage

### Assessments & Status

#### Current (2025-2026)

- **[Production Readiness Assessment](./PRODUCTION_READINESS.md)** - ⚠️ **CURRENT** - Detailed assessment of current state
- **[Production Roadmap](./PRODUCTION_ROADMAP.md)** - ⚠️ **CURRENT** - Clear path to production
- **[Status Dashboard](./STATUS.md)** - ⚠️ **CURRENT** - Single source of truth

#### Historical Assessments (Archived)

**Note:** Many historical assessments have been archived. For current status, see [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) and [STATUS.md](./STATUS.md).

Historical assessments are available in:
- [assessments/](./assessments/) - Recent assessments
- [assessments/archive/](./assessments/archive/) - Archived assessments
- [archive/assessments/](./archive/assessments/) - Older archived assessments

**Key Historical Documents:**
- [Consolidated Status 2026](./assessments/CONSOLIDATED_STATUS_2026.md) - Previous consolidated status
- [Next Steps 2026](./assessments/NEXT_STEPS_2026.md) - Previous next steps (superseded by Production Roadmap)
- [Brutal Honest Assessment](./assessments/BRUTAL_HONEST_ASSESSMENT_2026_COMPREHENSIVE.md) - Previous assessment

> **For current status, always refer to [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) and [STATUS.md](./STATUS.md)**

## Key Technologies

- **React 19** with React Compiler
- **Next.js 16** for the CMS app
- **Vite + Hono** for the web builder app
- **NeonDB Postgres** for database
- **Lexical** (vanilla) for rich text editing
- **Vercel Blob** for media storage
- **Stripe** for payments
- **TypeScript** (strict mode)
- **Tailwind CSS 4.0**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RevealUI Framework                          │
├─────────────────────────────────────────────────────────────────┤
│  apps/cms          │  apps/web                                  │
│  (Next.js 16)      │  (Vite + Hono SSR)                        │
│  RevealUI CMS      │  Builder/Preview                          │
├─────────────────────────────────────────────────────────────────┤
│  @revealui/core     │  @revealui/contracts  │  packages/services   │
│  (CMS Framework)   │  (Zod Contracts)   │  (Stripe/Supabase)   │
├─────────────────────────────────────────────────────────────────┤
│  NeonDB Postgres   │  Vercel Blob Storage                       │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

**Total**: 11 packages (reduced from 13 after merge on 2025-01-27)

| Package | Purpose | Status | Key Exports |
|---------|---------|--------|-------------|
| `@revealui/core` | CMS framework | ✅ Working | `core/`, `client/`, `types/`, `generated/` |
| `@revealui/db` | Database (Drizzle) | ✅ Working | `core/`, `client/`, `types/` |
| `@revealui/ai` | AI system | ✅ Working | `memory/`, `client/` |
| `@revealui/contracts` | Zod schemas & validation | ✅ Working | Domain-organized |
| `@revealui/presentation` | UI components | ✅ Working | `client/` |
| `services` | Stripe, Supabase | ✅ Working | `core/`, `client/` |
| `auth` | Authentication | ✅ Working | Server + React hooks |
| `sync` | ElectricSQL | ✅ Working | Client-side |
| `config` | Environment config | ✅ Working | Single module |
| `dev` | Dev tooling | ✅ Working | Tooling-only |
| `test` | Test utilities | ✅ Working | Test-only |

> **Note**: `@revealui/types` and `@revealui/generated` were merged into `@revealui/core` on 2025-01-27. See [Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md).

## Documentation by Use Case

### I want to...

**Get started (AI Agent):**
1. Read [Agent Quick Start](./AGENT_QUICK_START.md)
2. Check [Current Status](./STATUS.md)
3. Review [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)

**Get started (Developer):**
1. First time? Read [Onboarding Guide](./guides/ONBOARDING.md) for complete setup
2. Quick setup? Use [Quick Start Guide](./guides/QUICK_START.md)
3. Configure [Environment Variables](./development/ENVIRONMENT-VARIABLES-GUIDE.md)
4. Set up [Database](./reference/database/FRESH-DATABASE-SETUP.md)

**Deploy to production:**
1. Read [CI/CD Guide](./development/CI-CD-GUIDE.md)
2. Configure [Environment Variables](./development/ENVIRONMENT-VARIABLES-GUIDE.md)
3. Follow [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md)

**Set up a fresh database:**
1. Read [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md)
2. Follow the step-by-step instructions

**Understand the codebase:**
1. Review [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
2. Check [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
3. Review [Implementation Summaries](./development/implementation/)

**Add a new feature:**
1. Review [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
2. Check [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)
3. Follow [Testing Strategy](./development/testing/TESTING-STRATEGY.md)

## External Resources

- [React 19 Documentation](https://react.dev)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [NeonDB Documentation](https://neon.tech/docs)
- [Lexical Documentation](https://lexical.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com)

## Legal & Compliance

- **[Third Party Licenses](./legal/THIRD_PARTY_LICENSES.md)** - Open source license information
- **[Changelog](../CHANGELOG.md)** - Project changelog and version history

## Documentation Management

- **[Documentation Tools](./development/DOCUMENTATION-TOOLS.md)** - Tools for managing and validating documentation
- **[Documentation Structure](./development/STRUCTURE.md)** - Documentation organization guide
- **[Orphaned Files Analysis](./development/ORPHANED_FILES_ANALYSIS.md)** - Analysis of orphaned documentation files
- **[Orphaned Files Cleanup Assessment](./assessments/ORPHANED_FILES_CLEANUP_ASSESSMENT.md)** - Final cleanup assessment report

**Historical Documentation**: Previous cleanup reports and reviews have been archived in `docs/archive/` and `docs/assessments/`.

## Contributing

Found an error or want to improve the documentation? See our [Contributing Guide](../CONTRIBUTING.md).

---

**Need help?** Check out our [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) or [open an issue](https://github.com/RevealUIStudio/revealui/issues).
