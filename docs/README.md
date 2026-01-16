# RevealUI Framework Documentation

**Last Updated**: 2025-01-27  
**Status**: ✅ Active

Welcome to the RevealUI Framework documentation! This guide will help you navigate all available documentation.

## 🚀 Quick Start

### For AI Agents
👉 **Start here**: [Agent Quick Start Guide](./AGENT_QUICK_START.md)
- Current project state
- Key files to read first
- Common tasks and workflows
- Code conventions

### For Developers
👉 **Start here**: [Developer Quick Start Guide](./guides/QUICK_START.md)
- 5-minute setup guide
- Prerequisites checklist
- Common issues and solutions

### Current Status
👉 **See**: [Status Dashboard](./STATUS.md)
- Package structure (11 packages)
- Recent changes
- Quick reference

### Navigation
- **[Master Index](./INDEX.md)** - Complete documentation index by topic, type, audience, and task
- **[Task-Based Guide](./TASKS.md)** - Find documentation by what you want to accomplish
- **[Keywords Index](./KEYWORDS.md)** - Search documentation by keyword, term, or concept

## Quick Links

- [Agent Quick Start](./AGENT_QUICK_START.md) - **For AI agents** - Start here
- [Master Index](./INDEX.md) - **Complete documentation index** - Find docs by topic, type, audience, task
- [Task-Based Guide](./TASKS.md) - **Find docs by task** - "I want to..." navigation
- [Keywords Index](./KEYWORDS.md) - **Search by keyword** - Find docs by term or concept
- [Status Dashboard](./STATUS.md) - Current project state
- [CI/CD Guide](./development/CI-CD-GUIDE.md) - Deployment with NeonDB and Vercel
- [Environment Variables](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment guide
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions

## Documentation Structure

### Getting Started

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

### Assessments

#### Current Assessments (2025-2026)

- **[Project Status 2026](./assessments/PROJECT_STATUS_2026.md)** - Comprehensive project status and assessment
- **[Security Audit Auth](./assessments/SECURITY_AUDIT_AUTH.md)** - Authentication security audit
- **[Production Readiness Plan](./assessments/PRODUCTION_READINESS_PLAN_2026.md)** - Production readiness roadmap
- **[Brutal Final Assessment 2026](./assessments/BRUTAL_FINAL_ASSESSMENT_2026.md)** - Final comprehensive assessment
- **[Brutal Architecture Assessment](./assessments/BRUTAL_ARCHITECTURE_ASSESSMENT_2026.md)** - Architecture review
- **[Brutal Implementation Assessment](./assessments/BRUTAL_IMPLEMENTATION_ASSESSMENT_2026.md)** - Implementation review
- **[Brutal Test Fixes Assessment](./assessments/BRUTAL_TEST_FIXES_FINAL_ASSESSMENT_2026.md)** - Test fixes review
- **[Brutal Verification Assessment](./assessments/BRUTAL_VERIFICATION_ASSESSMENT_2026.md)** - Verification review
- **[Package Merge Assessment](./assessments/PACKAGE_MERGE_ASSESSMENT.md)** - Package merge analysis
- **[Package Merge Implementation](./assessments/PACKAGE_MERGE_IMPLEMENTATION_ASSESSMENT.md)** - Package merge implementation review
- **[Package Cleanup Assessment](./assessments/CLEANUP_ASSESSMENT.md)** - Post-merge cleanup review
- **[Documentation Assessment](./assessments/DOCUMENTATION_ASSESSMENT.md)** - Documentation quality review
- **[Next Steps Assessment](./assessments/NEXT_STEPS_BRUTAL_ASSESSMENT.md)** - Next steps and priorities
- **[Documentation Audit 2025](./DOCUMENTATION_AUDIT_2025.md)** - Project-wide documentation audit

#### Status Reports

- **[Final Status 2026](./assessments/FINAL_STATUS_2026.md)** - Final project status
- **[Final Verification Status](./assessments/FINAL_VERIFICATION_STATUS.md)** - Verification status
- **[Final Completion Report](./assessments/FINAL_COMPLETION_REPORT_2026.md)** - Completion summary
- **[Work Completion Report](./assessments/WORK_COMPLETION_REPORT_2026.md)** - Work completion summary
- **[Verification Results](./assessments/VERIFICATION_RESULTS_2026.md)** - Verification results

**Historical assessments** have been archived to [archive/assessments/](./archive/assessments/) for reference.

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
│  @revealui/core     │  @revealui/schema  │  packages/services   │
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
| `@revealui/schema` | Zod schemas | ✅ Working | Domain-organized |
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
1. Read [Developer Quick Start](./guides/QUICK_START.md)
2. Configure [Environment Variables](./development/ENVIRONMENT-VARIABLES-GUIDE.md)
3. Set up [Database](./reference/database/FRESH-DATABASE-SETUP.md)

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
