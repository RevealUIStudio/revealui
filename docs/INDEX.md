---
title: "Master Documentation Index"
type: "index"
status: "active"
last_updated: "2026-01-30"
tags: ["index", "navigation", "reference"]
related: ["README.md", "AGENT_QUICK_START.md"]
---

# Master Documentation Index

**Last Updated**: 2026-01-30  
**Status**: ✅ Active

This is the comprehensive index of all RevealUI Framework documentation, organized by multiple dimensions for easy discovery.

---

## 📚 Quick Navigation

- **[For AI Agents](./AGENT_QUICK_START.md)** - Start here if you're an AI agent
- **[For Developers](./onboarding/QUICK_START.md)** - Start here if you're a developer
- **[Master Index](./INDEX.md)** - Comprehensive navigation (you are here)
- **[Current Status](./PROJECT_STATUS.md)** - Project state dashboard
- **[Main README](./README.md)** - Documentation overview

---

## By Topic

### 🚀 Getting Started

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Agent Quick Start](./AGENT_QUICK_START.md) | Guide | Agents | Entry point for AI agents |
| [Developer Quick Start](./onboarding/QUICK_START.md) | Guide | Developers | 5-minute setup guide |
| [Status Dashboard](./PROJECT_STATUS.md) | Reference | All | Current project state |
| [CI/CD Guide](./infrastructure/CI-CD-GUIDE.md) | Guide | Developers | Deployment setup |
| [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) | Guide | Developers | Complete configuration guide with quick reference tables |

### 🏗️ Architecture

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) | Reference | All | System architecture overview |
| [Dual Database Architecture](./architecture/DUAL_DATABASE_ARCHITECTURE.md) | Reference | Developers | Database architecture |
| [Multi-tenant Architecture](./architecture/MULTI_TENANT_ARCHITECTURE.md) | Guide | Developers | Multi-tenant patterns |
| [Turbopack Decisions](./architecture/TURBOPACK-DECISIONS.md) | ADR | Developers | Turbopack production build analysis |
| [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) | Reference | All | Package structure and conventions |

### 🔐 Authentication

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Auth System Design](./auth/AUTH_SYSTEM_DESIGN.md) | Reference | Developers | Authentication system design |
| [Auth Usage Examples](./onboarding/AUTH_USAGE_EXAMPLES.md) | Guide | Developers | Code examples and patterns |
| [Auth Migration Guide](./onboarding/AUTH_MIGRATION_GUIDE.md) | Migration | Developers | JWT to session-based migration |
| [Auth Status](./auth/AUTH_PROJECT_STATUS.md) | Reference | All | Current auth implementation status |
| [Auth Implementation Status](./auth/IMPLEMENTATION_PROJECT_STATUS.md) | Reference | Developers | Implementation details |
| [Auth Usage Guide](./auth/USAGE_GUIDE.md) | Guide | Developers | Authentication usage guide |
| [CSRF Protection Strategy](./security/CSRF_PROTECTION.md) | Guide | Developers | CSRF protection implementation |

### 💾 Database

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Fresh Database Setup](./database/FRESH-DATABASE-SETUP.md) | Guide | Developers | Complete database setup |
| [Fresh Database Summary](./database/FRESH-DATABASE-SUMMARY.md) | Reference | Developers | Database setup summary |
| [Database Migration Plan](./database/DATABASE-MIGRATION-PLAN.md) | Guide | Developers | Migration strategy |
| [Database Provider Switching](./database/DATABASE-PROVIDER-SWITCHING.md) | Guide | Developers | Switch between providers |
| [Database Types Reference](./database/DATABASE_TYPES_REFERENCE.md) | Reference | Developers | Type definitions |
| [Type Generation Guide](./database/TYPE_GENERATION_GUIDE.md) | Guide | Developers | Generate types from schema |
| [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md) | Guide | Developers | Drizzle ORM / Neon HTTP |
| [ElectricSQL Integration](./infrastructure/electric-integration.md) | Guide | Developers | ElectricSQL setup |
| [ElectricSQL Setup Guide](./infrastructure/electric-setup-guide.md) | Guide | Developers | Setup instructions |
| [ElectricSQL Migrations](./database/electric.migrations.sql) | Reference | Developers | SQL migrations |
| [TanStack DB Research](./database/TANSTACK_DB_ELECTRIC_RESEARCH.md) | Reference | Developers | TanStack DB analysis |
| [TanStack DB Benefits](./database/TANSTACK_DB_BENEFITS_FOR_REVEALUI.md) | Reference | Developers | Benefits analysis |
| [TanStack DB Implementation Plan](./database/TANSTACK_DB_IMPLEMENTATION_PLAN.md) | Plan | Developers | Implementation plan |
| [Contract Integration Guide](./database/CONTRACT_INTEGRATION_GUIDE.md) | Guide | Developers | Contract layer integration |

### 🚀 Deployment

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Deployment Runbook](./onboarding/DEPLOYMENT-RUNBOOK.md) | Guide | Developers | Production deployment |
| [CI/CD Guide](./infrastructure/CI-CD-GUIDE.md) | Guide | Developers | CI/CD with NeonDB and Vercel |
| [Rollback Procedure](./infrastructure/ROLLBACK_PROCEDURE.md) | Guide | Developers | Emergency rollback steps |
| [Docker WSL2 Setup](./infrastructure/DOCKER-WSL2-SETUP.md) | Guide | Developers | Docker setup for WSL2 |
| [Migrate Vercel Postgres to Supabase](./infrastructure/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md) | Migration | Developers | Database migration guide |

### 🧪 Testing

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Testing Strategy](./testing/TESTING-STRATEGY.md) | Guide | Developers | Testing guidelines |
| [Load Testing Guide](./testing/LOAD_TESTING_GUIDE.md) | Guide | Developers | Performance testing |
| [Penetration Testing Guide](./testing/PENETRATION_TESTING_GUIDE.md) | Guide | Developers | Security testing |
| [Coverage Report Template](./testing/COVERAGE-REPORT-TEMPLATE.md) | Template | Developers | Test coverage template |
| [Auth Performance Testing](./performance/AUTH_PERFORMANCE_TESTING.md) | Guide | Developers | Auth performance tests |
| [Performance Testing](./performance/PERFORMANCE_TESTING.md) | Guide | Developers | General performance testing |

### 🛠️ Development & Tooling

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Tooling Versions](./development/TOOLING-VERSIONS.md) | Reference | Developers | Current tool versions & update process |
| [Path Aliases Strategy](./development/PATH-ALIASES.md) | Guide | Developers | TypeScript & Vitest path alias patterns |
| [TypeScript Strict Mode Migration](./technical-debt/TYPESCRIPT-STRICT-MODE.md) | Plan | Developers | AI package strict mode migration plan |

### 📝 CMS & Content

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [CMS Content Examples](./onboarding/CMS-CONTENT-EXAMPLES.md) | Guide | Developers | Ready-to-use content |
| [CMS Content Recommendations](./onboarding/CMS-CONTENT-RECOMMENDATIONS.md) | Guide | Developers | Content best practices |
| [CMS Frontend Connection Guide](./onboarding/CMS-FRONTEND-CONNECTION-GUIDE.md) | Guide | Developers | Connect CMS to frontend |
| [Blog Creation Guide](./onboarding/BLOG-CREATION-GUIDE.md) | Guide | Developers | Create blog posts |
| [RevealUI Theme Usage Guide](./onboarding/REVEALUI-THEME-USAGE-GUIDE.md) | Guide | Developers | Theme customization |

### ⚙️ Configuration

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) | Guide | Developers | Complete setup guide with quick reference tables |
| [Neon API Key Setup](./onboarding/NEON_API_KEY_SETUP.md) | Guide | Developers | Neon configuration |
| [Supabase IPv4 Explanation](./infrastructure/SUPABASE_IPV4_EXPLANATION.md) | Reference | Developers | Networking configuration |

### 🔧 Development

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Code Style Guide](./standards/LLM-CODE-STYLE-GUIDE.md) | Guide | All | AI-assisted development guidelines |
| [Code Style Guidelines](./standards/CODE-STYLE-GUIDELINES.md) | Guide | Developers | General code style |
| [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) | Reference | All | Package organization |
| [Custom Integrations](./infrastructure/CUSTOM-INTEGRATIONS.md) | Guide | Developers | Third-party integrations |
| [Known Limitations](./standards/KNOWN-LIMITATIONS.md) | Reference | Developers | Current limitations |
| [Error Handling](./standards/ERROR_HANDLING.md) | Guide | Developers | Error handling patterns |
| [Logging Strategy](./standards/LOGGING_STRATEGY.md) | Guide | Developers | Logging best practices |
| [Monitoring Setup](./infrastructure/MONITORING_SETUP.md) | Guide | Developers | Monitoring configuration |
| [API Docs Guide](./standards/API_DOCS_GUIDE.md) | Guide | Developers | API documentation guide |
| [Documentation Tools](./standards/DOCUMENTATION-TOOLS.md) | Reference | Developers | Documentation management tools |
| [Documentation Structure](./standards/STRUCTURE.md) | Reference | Developers | Documentation organization |

#### Implementation

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [P0 Fixes Implementation](./implementation/P0_FIXES_IMPLEMENTATION.md) | Reference | Developers | Critical fixes implementation |
| [P1 Fixes Implementation](./implementation/P1_FIXES_IMPLEMENTATION.md) | Reference | Developers | High-priority fixes implementation |
| [P2 Fixes Implementation](./implementation/P2_FIXES_IMPLEMENTATION.md) | Reference | Developers | Medium-priority fixes implementation |
| [Priority 1 Fixes Complete](./implementation/PRIORITY_1_FIXES_COMPLETE.md) | Reference | Developers | Priority 1 fixes completion summary |
| [File System Loading Implementation](./implementation/FILE_SYSTEM_LOADING_IMPLEMENTATION.md) | Reference | Developers | File loading system implementation |
| [Implementation Summary](./implementation/IMPLEMENTATION-SUMMARY.md) | Reference | Developers | Implementation overview |

### 📦 Migrations

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) | Migration | All | Package merge (types + generated → core) |
| [Breaking Changes - CRDT](./migrations/BREAKING-CHANGES-CRDT.md) | Migration | Developers | CRDT migration breaking changes |
| [Deprecated Types Removal](./migrations/DEPRECATED-TYPES-REMOVAL.md) | Migration | Developers | Type deprecation guide |

### 🔌 MCP (Model Context Protocol)

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [MCP Setup Guide](./mcp/MCP_SETUP.md) | Guide | Developers | Setting up MCP servers |
| [MCP Fixes 2025](./mcp/MCP_FIXES_2025.md) | Reference | Developers | Recent MCP updates |
| [MCP Quick Start](./mcp/QUICK_START.md) | Guide | Developers | Using configured MCP servers |
| [Next.js DevTools Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md) | Guide | Developers | DevTools MCP setup |
| [Next.js DevTools Demo](./mcp/NEXTJS_DEVTOOLS_MCP_DEMO.md) | Guide | Developers | Demo and examples |
| [Next.js DevTools In Action](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md) | Guide | Developers | DevTools examples |
| [MCP Demo Interaction](./mcp/demo-mcp-interaction.md) | Guide | Developers | MCP interaction examples |

### 📊 Assessments

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Current Status](../PROJECT_STATUS.md) | Status | All | Project health dashboard |
| [Production Readiness](../PRODUCTION_READINESS.md) | Assessment | All | Deployment readiness |
| [Production Roadmap](../PRODUCTION_ROADMAP.md) | Planning | All | Development roadmap |
| [Triple Database Setup](./assessments/TRIPLE_DATABASE_SETUP.md) | Guide | Developers | Database setup guide |
| [Database Connection Setup](./assessments/DATABASE_CONNECTION_SETUP.md) | Guide | Developers | Connection configuration |
| [Database Setup Strategy](./assessments/DATABASE_SETUP_STRATEGY.md) | Guide | Developers | Database strategy |
| [SQLite vs ElectricSQL](./assessments/SQLITE_VS_ELECTRICSQL.md) | Analysis | Developers | Database technology comparison |

### 📋 Planning

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Prioritized Action Plan](./planning/PRIORITIZED_ACTION_PLAN.md) | Plan | All | Project action plan |
| [Product Service Completion Plan](./planning/PRODUCT_SERVICE_COMPLETION_PLAN.md) | Plan | All | Product service roadmap |
| [Ralph Cohesion Engine Research](./planning/RALPH_COHESION_ENGINE_RESEARCH.md) | Research | Developers | Cohesion engine research |
| [Unfinished Work Inventory](./planning/UNFINISHED_WORK_INVENTORY.md) | Reference | All | Incomplete work tracking |

### 📖 Reference

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Component Mapping](./reference/COMPONENT_MAPPING.md) | Reference | Developers | Component, business logic, schema mapping |
| [Dependencies List](./reference/DEPENDENCIES-LIST.md) | Reference | Developers | Complete dependencies |
| [Frameworks List](./reference/FRAMEWORKS-LIST.md) | Reference | Developers | Framework usage |

---

## By Type

### Guides (Step-by-Step Instructions)

- [Agent Quick Start](./AGENT_QUICK_START.md)
- [Developer Quick Start](./onboarding/QUICK_START.md)
- [CI/CD Guide](./infrastructure/CI-CD-GUIDE.md)
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md)
- [Fresh Database Setup](./database/FRESH-DATABASE-SETUP.md)
- [Deployment Runbook](./onboarding/DEPLOYMENT-RUNBOOK.md)
- [Auth Usage Examples](./onboarding/AUTH_USAGE_EXAMPLES.md)
- [Testing Strategy](./testing/TESTING-STRATEGY.md)
- [Code Style Guide](./standards/LLM-CODE-STYLE-GUIDE.md)
- [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md)
- [ElectricSQL Integration](./infrastructure/electric-integration.md)
- [CMS Content Examples](./onboarding/CMS-CONTENT-EXAMPLES.md)
- [Blog Creation Guide](./onboarding/BLOG-CREATION-GUIDE.md)

### Reference (Quick Lookup)

- [Status Dashboard](./PROJECT_STATUS.md)
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) - Includes quick reference tables
- [Database Types Reference](./database/DATABASE_TYPES_REFERENCE.md)
- [Component Mapping](./architecture/COMPONENT_MAPPING.md)
- [Dependencies List](./architecture/DEPENDENCIES-LIST.md)
- [Frameworks List](./architecture/FRAMEWORKS-LIST.md)
- [Auth System Design](./auth/AUTH_SYSTEM_DESIGN.md)
- [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)

### Migration Guides

- [Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md)
- [Auth Migration Guide](./onboarding/AUTH_MIGRATION_GUIDE.md)
- [Breaking Changes - CRDT](./migrations/BREAKING-CHANGES-CRDT.md)
- [Deprecated Types Removal](./migrations/DEPRECATED-TYPES-REMOVAL.md)
- [Migrate Vercel Postgres to Supabase](./infrastructure/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md)

### Assessments

- [Current Status](../PROJECT_STATUS.md)
- [Production Readiness](../PRODUCTION_READINESS.md)
- [Production Roadmap](../PRODUCTION_ROADMAP.md)
- [Triple Database Setup](./assessments/TRIPLE_DATABASE_SETUP.md)
- [Database Connection Setup](./assessments/DATABASE_CONNECTION_SETUP.md)

### Plans

- [Prioritized Action Plan](./planning/PRIORITIZED_ACTION_PLAN.md)
- [Product Service Completion Plan](./planning/PRODUCT_SERVICE_COMPLETION_PLAN.md)
- [Database Migration Plan](./database/DATABASE-MIGRATION-PLAN.md)

---

## By Audience

### For AI Agents

- [Agent Quick Start](./AGENT_QUICK_START.md) - **Start here**
- [Status Dashboard](./PROJECT_STATUS.md)
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
- [Code Style Guide](./standards/LLM-CODE-STYLE-GUIDE.md)
- [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
- [Task-Based Guide](./INDEX.md)

### For Developers

- [Developer Quick Start](./onboarding/QUICK_START.md) - **Start here**
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md)
- [Fresh Database Setup](./database/FRESH-DATABASE-SETUP.md)
- [Deployment Runbook](./onboarding/DEPLOYMENT-RUNBOOK.md)
- [Testing Strategy](./testing/TESTING-STRATEGY.md)
- [Code Style Guidelines](./standards/CODE-STYLE-GUIDELINES.md)

### For Contributors

- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Code Style Guide](./standards/LLM-CODE-STYLE-GUIDE.md)
- [Testing Strategy](./testing/TESTING-STRATEGY.md)
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)

---

## By Task

This master index provides comprehensive navigation by topic, task, audience, and type.

### Common Tasks

- **Set up the project**: [Developer Quick Start](./onboarding/QUICK_START.md)
- **Add a new feature**: [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) + [Code Style Guide](./standards/LLM-CODE-STYLE-GUIDE.md)
- **Deploy to production**: [CI/CD Guide](./infrastructure/CI-CD-GUIDE.md) + [Deployment Runbook](./onboarding/DEPLOYMENT-RUNBOOK.md)
- **Set up a fresh database**: [Fresh Database Setup](./database/FRESH-DATABASE-SETUP.md)
- **Understand the codebase**: [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) + [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
- **Work with authentication**: [Auth System Design](./auth/AUTH_SYSTEM_DESIGN.md) + [Auth Usage Examples](./onboarding/AUTH_USAGE_EXAMPLES.md)
- **Work with database**: [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md) + [Database Types Reference](./database/DATABASE_TYPES_REFERENCE.md)
- **Run tests**: [Testing Strategy](./testing/TESTING-STRATEGY.md)

---

## Documentation Management

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Documentation Improvement Plan](./DOCUMENTATION_IMPROVEMENT_PLAN.md) | Plan | All | Documentation improvement roadmap |
| [Documentation Audit 2025](./DOCUMENTATION_AUDIT_2025.md) | Assessment | All | Project-wide documentation audit |
| [Documentation Tools](./standards/DOCUMENTATION-TOOLS.md) | Reference | Developers | Documentation management tools |
| [Documentation Structure](./standards/STRUCTURE.md) | Reference | Developers | Documentation organization |
| [Documentation Index](./standards/DOCUMENTATION_INDEX.md) | Reference | All | Comprehensive documentation index |

---

## Related Documentation

- [Main README](./README.md) - Documentation overview
- [Master Index](./INDEX.md) - Comprehensive navigation
- [Agent Quick Start](./AGENT_QUICK_START.md) - For AI agents
- [Status Dashboard](./PROJECT_STATUS.md) - Current project state

---

**Last Updated**: 2025-01-27  
**Maintained By**: RevealUI Team
