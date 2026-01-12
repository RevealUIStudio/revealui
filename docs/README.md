# RevealUI Framework Documentation

**Last Updated**: January 8, 2025

Welcome to the RevealUI Framework documentation! This guide will help you navigate all available documentation.

## Quick Links

- [CI/CD Guide](./CI-CD-GUIDE.md) - Deployment with NeonDB and Vercel
- [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Deployment Runbook](./DEPLOYMENT-RUNBOOK.md) - Production deployment guide

## Documentation Structure

### Getting Started

- **[CI/CD Guide](./CI-CD-GUIDE.md)** - Deploy to production with NeonDB Postgres
- **[Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md)** - Complete setup guide with instructions
- **[Environment Variables Reference](./ENV-VARIABLES-REFERENCE.md)** - Quick reference table format
- **[Fresh Database Setup](./FRESH-DATABASE-SETUP.md)** - Complete database setup guide

### Architecture & Planning

- **[CRDT Memory System](./archive/migrations/GRADE-A-CRDT-PLAN.md)** - Memory system implementation plan (archived)

### User Guides

- **[Blog Creation Guide](../BLOG-CREATION-GUIDE.md)** - How to create and manage blog posts
- **[CMS Content Examples](../CMS-CONTENT-EXAMPLES.md)** - Content structure examples
- **[CMS Content Recommendations](../CMS-CONTENT-RECOMMENDATIONS.md)** - Best practices for content
- **[CMS Frontend Connection Guide](../CMS-FRONTEND-CONNECTION-GUIDE.md)** - Connect frontend to CMS
- **[RevealUI Theme Usage Guide](../REVEALUI-THEME-USAGE-GUIDE.md)** - Theme customization guide

### Deployment & Operations

- **[Deployment Runbook](./DEPLOYMENT-RUNBOOK.md)** - Complete deployment guide
- **[Rollback Procedure](./ROLLBACK-PROCEDURE.md)** - Emergency rollback steps

### Testing & Quality

- **[Testing Strategy](./TESTING-STRATEGY.md)** - Testing guidelines
- **[Verification Guide](../VERIFICATION-GUIDE.md)** - How to verify agent claims independently
- **[Lint Errors Report](./LINT_ERRORS_REPORT.md)** - Current lint status
- **[Load Testing Guide](./LOAD-TESTING-GUIDE.md)** - Performance testing guide
- **[Penetration Testing Guide](./PENETRATION-TESTING-GUIDE.md)** - Security testing guide
- **[Manual Verification Checklist](./MANUAL-VERIFICATION-CHECKLIST.md)** - Manual testing checklist

### Architecture

- **[Multi-tenant Architecture](./MULTI-TENANT-ARCHITECTURE.md)** - Multi-tenant patterns
- **[Custom Integrations](./CUSTOM-INTEGRATIONS.md)** - Third-party integrations
- **[Known Limitations](./KNOWN-LIMITATIONS.md)** - Current limitations
- **[Drizzle Guide](./DRIZZLE-GUIDE.md)** - Drizzle ORM / Neon HTTP integration guide
- **[ElectricSQL Integration](./electric-integration.md)** - ElectricSQL integration guide
- **[ElectricSQL Setup Guide](./electric-setup-guide.md)** - ElectricSQL setup instructions
- **[TanStack DB + Electric Research](./TANSTACK_DB_ELECTRIC_RESEARCH.md)** - Comprehensive analysis of TanStack DB and Electric SQL integration patterns
- **[TanStack DB Benefits for RevealUI](./TANSTACK_DB_BENEFITS_FOR_REVEALUI.md)** - Analysis of how TanStack DB could benefit RevealUI's architecture
- **[TanStack DB Implementation Plan](./TANSTACK_DB_IMPLEMENTATION_PLAN.md)** - Detailed implementation plan for adding TanStack DB to RevealUI
- **[TanStack DB Current State Assessment](./TANSTACK_DB_CURRENT_STATE_ASSESSMENT.md)** - Updated assessment of current state after codebase changes
- **[Component Mapping](../COMPONENT-MAPPING.md)** - Component structure reference
- **[Database Migration Verification](../packages/db/VERIFY-MIGRATION.md)** - Migration verification checklist
- **[Memory Performance Guide](../packages/memory/PERFORMANCE.md)** - Memory system performance guide

### Development Tools

- **[Code Style Guidelines](../CODE-STYLE-GUIDELINES.md)** - Coding standards and conventions
- **[LLM Code Style Guide](./LLM-CODE-STYLE-GUIDE.md)** - Guidelines for AI-assisted development
- **[Package Conventions](../packages/PACKAGE-CONVENTIONS.md)** - Package structure standards
- **[Documentation Tools](./DOCUMENTATION-TOOLS.md)** - Documentation management tools
- **[Next.js DevTools Guide](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md)** - DevTools usage guide
- **[Next.js DevTools MCP Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md)** - MCP integration guide
- **[Script Testing Guide](../scripts/TESTING-GUIDE.md)** - Testing guide for scripts
- **[Dependencies List](../DEPENDENCIES-LIST.md)** - Complete dependencies reference
- **[Frameworks List](../FRAMEWORKS-LIST.md)** - Frameworks and tools reference

### Migration Guides

**Note**: Migration guides have been archived as the project is at v0.1.0 (initial release) with no users. See `docs/archive/migrations/` for historical migration documentation.

- **[Breaking Changes: CRDT](../BREAKING-CHANGES-CRDT.md)** - CRDT breaking changes and migration
- **[Deprecated Types Removal](../DEPRECATED-TYPES-REMOVAL.md)** - Deprecated type removal guide
- **[Modernization Verification](../MODERNIZATION-VERIFICATION.md)** - Node.js 24.12.0 & ESM migration verification

### MCP (Model Context Protocol)

- **[MCP Setup Guide](./MCP_SETUP.md)** - Setting up MCP servers
- **[MCP Fixes 2025](./MCP_FIXES_2025.md)** - Recent MCP updates
- **[MCP Test Results](./MCP_TEST_RESULTS.md)** - MCP integration testing
- **[Next.js DevTools Guide](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md)** - Next.js DevTools usage
- **[Next.js DevTools MCP Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md)** - MCP integration quickstart
- **[Next.js DevTools MCP Demo](./NEXTJS_DEVTOOLS_MCP_DEMO.md)** - Demo and examples
- **[MCP Demo Interaction](../scripts/demo-mcp-interaction.md)** - MCP interaction examples

### Production & Operations

- **[Quick Start Pre-Launch](./QUICK-START-PRE-LAUNCH.md)** - Pre-launch checklist
- **[Launch Checklist](./LAUNCH-CHECKLIST.md)** - Final launch preparation
- **[Docker WSL2 Setup](./DOCKER-WSL2-SETUP.md)** - Docker setup for WSL2

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
1. Read [CI/CD Guide](./CI-CD-GUIDE.md)
2. Configure [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md)
3. Follow [Deployment Runbook](./DEPLOYMENT-RUNBOOK.md)

**Understand the codebase:**
1. Review package structure and architecture documentation
2. Review package structure above

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

- **[Documentation Tools](./DOCUMENTATION-TOOLS.md)** - Tools for managing and validating documentation
- **[Cleanup Complete](./CLEANUP-COMPLETE.md)** - Documentation cleanup completion report

**Historical Documentation**: Previous cleanup reports and reviews have been archived in `docs/archive/`.

## Archive

Historical documentation, assessments, and technical analysis files have been archived for reference in `docs/archive/`.

## Contributing

Found an error or want to improve the documentation? See our [Contributing Guide](../CONTRIBUTING.md).

---

**Need help?** Check out our [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) or [open an issue](https://github.com/RevealUIStudio/revealui/issues).
