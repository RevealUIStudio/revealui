# RevealUI Framework Documentation

**Last Updated**: January 8, 2025

Welcome to the RevealUI Framework documentation! This guide will help you navigate all available documentation.

## Quick Links

- [CI/CD Guide](./development/CI-CD-GUIDE.md) - Deployment with NeonDB and Vercel
- [Environment Variables](./reference/configuration/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment guide

## Documentation Structure

### Getting Started

- **[CI/CD Guide](./development/CI-CD-GUIDE.md)** - Deploy to production with NeonDB Postgres
- **[Environment Variables Guide](./reference/configuration/ENVIRONMENT-VARIABLES-GUIDE.md)** - Complete setup guide with instructions
- **[Environment Variables Reference](./reference/configuration/ENV-VARIABLES-REFERENCE.md)** - Quick reference table format
- **[Fresh Database Setup](./guides/database/FRESH-DATABASE-SETUP.md)** - Complete database setup guide

### Architecture & Planning

- **[CRDT Memory System](./archive/migrations/GRADE-A-CRDT-PLAN.md)** - Memory system implementation plan (archived)

### User Guides

#### Authentication

- **[Auth Migration Guide](./guides/auth/AUTH_MIGRATION_GUIDE.md)** - Guide for migrating from JWT to session-based auth
- **[Auth Usage Examples](./guides/auth/AUTH_USAGE_EXAMPLES.md)** - Code examples and usage patterns for the auth system
- **[Auth System Design](./reference/auth/AUTH_SYSTEM_DESIGN.md)** - Comprehensive authentication system design

#### Database

- **[Fresh Database Setup](./guides/database/FRESH-DATABASE-SETUP.md)** - Complete database setup guide
- **[Database Migration Plan](./reference/database/DATABASE-MIGRATION-PLAN.md)** - Database migration strategy
- **[Database Provider Switching](./reference/database/DATABASE-PROVIDER-SWITCHING.md)** - Switch between database providers
- **[Drizzle Guide](./reference/database/DRIZZLE-GUIDE.md)** - Drizzle ORM / Neon HTTP integration guide
- **[ElectricSQL Integration](./reference/database/electric-integration.md)** - ElectricSQL integration guide
- **[ElectricSQL Setup Guide](./reference/database/electric-setup-guide.md)** - ElectricSQL setup instructions
- **[TanStack DB Research](./reference/database/TANSTACK_DB_ELECTRIC_RESEARCH.md)** - Comprehensive analysis of TanStack DB and Electric SQL
- **[TanStack DB Benefits](./reference/database/TANSTACK_DB_BENEFITS_FOR_REVEALUI.md)** - Analysis of how TanStack DB could benefit RevealUI
- **[TanStack DB Implementation Plan](./reference/database/TANSTACK_DB_IMPLEMENTATION_PLAN.md)** - Detailed implementation plan
- **[Migrate Vercel Postgres to Supabase](./guides/database/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md)** - Migration guide

#### Deployment

- **[Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md)** - Complete deployment guide
- **[Rollback Procedure](./guides/deployment/ROLLBACK-PROCEDURE.md)** - Emergency rollback steps
- **[Docker WSL2 Setup](./guides/deployment/DOCKER-WSL2-SETUP.md)** - Docker setup for WSL2

#### Testing

- **[Load Testing Guide](./guides/testing/LOAD-TESTING-GUIDE.md)** - Performance testing guide
- **[Testing Strategy](./development/testing/TESTING-STRATEGY.md)** - Testing guidelines

#### Configuration

- **[Neon API Key Setup](./guides/configuration/NEON_API_KEY_SETUP.md)** - Neon API key configuration

### Reference Documentation

#### Configuration

- **[Environment Variables Guide](./reference/configuration/ENVIRONMENT-VARIABLES-GUIDE.md)** - Configuration guide
- **[Environment Variables Reference](./reference/configuration/ENV-VARIABLES-REFERENCE.md)** - Quick reference
- **[Supabase IPv4 Explanation](./reference/configuration/SUPABASE_IPV4_EXPLANATION.md)** - Supabase networking

#### Architecture

- **[Multi-tenant Architecture](./reference/architecture/MULTI-TENANT-ARCHITECTURE.md)** - Multi-tenant patterns
- **[Custom Integrations](./reference/integrations/CUSTOM-INTEGRATIONS.md)** - Third-party integrations
- **[Known Limitations](./reference/KNOWN-LIMITATIONS.md)** - Current limitations

### Development

#### Implementation

- **[P0 Fixes Implementation](./development/implementation/P0_FIXES_IMPLEMENTATION.md)** - Critical fixes implementation
- **[P1 Fixes Implementation](./development/implementation/P1_FIXES_IMPLEMENTATION.md)** - High-priority fixes implementation
- **[P2 Fixes Implementation](./development/implementation/P2_FIXES_IMPLEMENTATION.md)** - Medium-priority fixes implementation
- **[File System Loading Implementation](./development/implementation/FILE_SYSTEM_LOADING_IMPLEMENTATION.md)** - File loading system
- **[Implementation Summary](./development/implementation/IMPLEMENTATION-SUMMARY.md)** - Implementation overview

#### Testing

- **[Testing Strategy](./development/testing/TESTING-STRATEGY.md)** - Testing guidelines
- **[Penetration Testing Guide](./development/testing/PENETRATION-TESTING-GUIDE.md)** - Security testing guide

#### Tools & Processes

- **[Documentation Tools](./development/DOCUMENTATION-TOOLS.md)** - Documentation management tools
- **[Documentation Structure](./development/STRUCTURE.md)** - Documentation organization
- **[Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md)** - Guidelines for AI-assisted development
- **[Lint Errors Report](./development/LINT_ERRORS_REPORT.md)** - Current lint status
- **[Quick Start Pre-Launch](./development/QUICK-START-PRE-LAUNCH.md)** - Pre-launch checklist
- **[Launch Checklist](./development/LAUNCH-CHECKLIST.md)** - Final launch preparation

### MCP (Model Context Protocol)

- **[MCP Setup Guide](./mcp/MCP_SETUP.md)** - Setting up MCP servers
- **[MCP Fixes 2025](./mcp/MCP_FIXES_2025.md)** - Recent MCP updates
- **[Next.js DevTools Demo](./mcp/NEXTJS_DEVTOOLS_MCP_DEMO.md)** - Demo and examples
- **[MCP Demo Interaction](./mcp/demo-mcp-interaction.md)** - MCP interaction examples

### Assessments

Historical assessments and verification reports can be found in [assessments/](./assessments/).

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

| Package | Purpose | Status |
|---------|---------|--------|
| `@revealui/core` | CMS framework | ✅ Working |
| `@revealui/schema` | Zod schemas | ✅ Working |
| `packages/services` | Stripe, Supabase | ✅ Working |
| `apps/cms` | Next.js CMS app | ✅ Compiles |
| `apps/web` | Vite builder app | ✅ Builds |

## Documentation by Use Case

### I want to...

**Deploy to production:**
1. Read [CI/CD Guide](./development/CI-CD-GUIDE.md)
2. Configure [Environment Variables](./reference/configuration/ENVIRONMENT-VARIABLES-GUIDE.md)
3. Follow [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md)

**Set up a fresh database:**
1. Read [Fresh Database Setup](./guides/database/FRESH-DATABASE-SETUP.md)
2. Follow the step-by-step instructions

**Understand the codebase:**
1. Review package structure and architecture documentation
2. Check [Implementation Summaries](./development/implementation/)
3. Review package structure above

## External Resources

- [React 19 Documentation](https://react.dev)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [NeonDB Documentation](https://neon.tech/docs)
- [Lexical Documentation](https://lexical.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com)

## Legal & Compliance

- **[Third Party Licenses](../THIRD_PARTY_LICENSES.md)** - Open source license information
- **[Changelog](../CHANGELOG.md)** - Project changelog and version history

## Documentation Management

- **[Documentation Tools](./development/DOCUMENTATION-TOOLS.md)** - Tools for managing and validating documentation
- **[Documentation Structure](./development/STRUCTURE.md)** - Documentation organization guide

**Historical Documentation**: Previous cleanup reports and reviews have been archived in `docs/archive/` and `docs/assessments/`.

## Contributing

Found an error or want to improve the documentation? See our [Contributing Guide](../CONTRIBUTING.md).

---

**Need help?** Check out our [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) or [open an issue](https://github.com/RevealUIStudio/revealui/issues).
