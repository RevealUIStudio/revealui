---
title: "Master Documentation Index"
type: "index"
status: "active"
last_updated: "2026-01-31"
tags: ["index", "navigation", "reference"]
related: ["README.md", "PROJECT_ROADMAP.md", "PROJECT_STATUS.md"]
---

# Master Documentation Index

**Last Updated**: 2026-01-31
**Status**: ✅ Active

This is the comprehensive index of all RevealUI Framework documentation, organized by multiple dimensions for easy discovery.

---

## 📚 Quick Navigation

- **[For AI Agents](./automation/AGENTS.md)** - Start here if you're an AI agent
- **[For Developers](./onboarding/QUICK_START.md)** - Start here if you're a developer
- **[Master Index](./INDEX.md)** - Comprehensive navigation (you are here)
- **[Current Status](./PROJECT_STATUS.md)** - Project state dashboard
- **[Project Roadmap](./PROJECT_ROADMAP.md)** - Development roadmap

---

## By Topic

### 🚀 Getting Started

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Agents Guide](./automation/AGENTS.md) | Guide | Agents | Entry point for AI agents (includes capabilities and quick start) |
| [Developer Quick Start](./onboarding/QUICK_START.md) | Guide | Developers | 5-minute setup guide |
| [Status Dashboard](./PROJECT_STATUS.md) | Reference | All | Current project state |
| [Project Roadmap](./PROJECT_ROADMAP.md) | Reference | All | Development roadmap |
| [CI/CD Guide](./infrastructure/CI_CD_GUIDE.md) | Guide | Developers | CI/CD setup with monitoring and rollback procedures |
| [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) | Guide | Developers | Complete configuration guide with quick reference tables |
| [Environment Setup](./onboarding/ENVIRONMENT_SETUP.md) | Guide | Developers | Complete environment setup (includes Docker WSL2 setup, known limitations, and launch checklist) |

### 🏗️ Architecture

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) | Reference | All | System architecture overview |
| [Dual Database Architecture](./architecture/DUAL_DATABASE_ARCHITECTURE.md) | Reference | Developers | Database architecture |
| [Multi-tenant Architecture](./architecture/MULTI_TENANT_ARCHITECTURE.md) | Guide | Developers | Multi-tenant patterns |
| [Turbopack Decisions](./architecture/TURBOPACK-DECISIONS.md) | ADR | Developers | Turbopack production build analysis |
| [Component Mapping](./architecture/COMPONENT_MAPPING.md) | Reference | Developers | Component, business logic, schema mapping |

### 🔐 Authentication

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Auth System](./auth/AUTH_SYSTEM.md) | Reference | Developers | Complete authentication system design and architecture |
| [Auth Guide](./auth/AUTH_GUIDE.md) | Guide | Developers | Authentication usage guide with code examples and patterns |
| [Auth Migration Guide](./auth/AUTH_MIGRATION_GUIDE.md) | Migration | Developers | JWT to session-based migration |
| [Security Guide](./security/SECURITY.md) | Guide | Developers | Security best practices (includes CSRF protection) |

### 💾 Database

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Database Guide](./database/DATABASE.md) | Guide | Developers | Complete database guide (includes setup, types, and provider configuration) |
| [Database Migrations](./database/MIGRATIONS.md) | Guide | Developers | Migration strategy and provider switching |
| [Contract Integration Guide](./database/CONTRACT_INTEGRATION_GUIDE.md) | Guide | Developers | Contract layer integration |
| [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md) | Guide | Developers | Drizzle ORM / Neon HTTP |

### 🚀 Deployment

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Deployment Runbook](./onboarding/DEPLOYMENT_RUNBOOK.md) | Guide | Developers | Production deployment |
| [CI/CD Guide](./infrastructure/CI_CD_GUIDE.md) | Guide | Developers | CI/CD with NeonDB and Vercel (includes monitoring and rollback procedures) |
| [Docker Production Security](./infrastructure/DOCKER_PRODUCTION_SECURITY.md) | Guide | Developers | Docker security best practices |

### 🧪 Testing

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Testing Guide](./testing/TESTING.md) | Guide | Developers | Comprehensive testing guide (includes load, penetration, verification testing, and strategy) |
| [Performance Testing](./performance/PERFORMANCE.md) | Guide | Developers | Performance and load testing (includes auth performance benchmarks) |

### 🛠️ Development & Tooling

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Path Aliases Strategy](./development/PATH-ALIASES.md) | Guide | Developers | TypeScript & Vitest path alias patterns |
| [Database Scripts](./development/DATABASE_SCRIPTS.md) | Reference | Developers | Database utility scripts |
| [CI Environment](./development/CI_ENVIRONMENT.md) | Reference | Developers | CI environment configuration |
| [TypeScript Strict Mode Migration](./technical-debt/TYPESCRIPT-STRICT-MODE.md) | Plan | Developers | AI package strict mode migration plan |

### 📝 CMS & Content

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [CMS Guide](./onboarding/CMS_GUIDE.md) | Guide | Developers | Complete CMS guide (includes content examples, recommendations, and frontend connection) |
| [Overview](./onboarding/OVERVIEW.md) | Reference | Developers | Complete framework overview (includes features, integrations, types, payments, and theme customization) |

### ⚙️ Configuration

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) | Guide | Developers | Complete setup guide with quick reference tables |
| [Environment Setup](./onboarding/ENVIRONMENT_SETUP.md) | Guide | Developers | Complete environment setup (includes Docker WSL2, known limitations, launch checklist) |
| [Environment Comparison](./guides/ENVIRONMENT_COMPARISON.md) | Reference | Developers | Comparison of development environments |
| [Nix Setup](./guides/NIX_SETUP.md) | Guide | Developers | Nix development environment setup |

### 🔧 Development Standards

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Code Style](./standards/CODE_STYLE.md) | Guide | All | Code style guide (includes linting and AI-assisted development guidelines) |
| [Documentation Standards](./standards/DOCUMENTATION_STANDARDS.md) | Guide | All | Documentation standards (includes root docs policy) |
| [Observability](./standards/OBSERVABILITY.md) | Guide | Developers | Error handling and logging strategy |
| [Safeguards](./standards/SAFEGUARDS.md) | Reference | Developers | Code safeguards and protections |
| [Code of Conduct](./standards/CODE_OF_CONDUCT.md) | Reference | All | Community code of conduct |
| [Module Resolution Strategy](./standards/MODULE_RESOLUTION_STRATEGY.md) | Reference | Developers | Module resolution patterns |

### 🤖 Automation & AI

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Agents Guide](./automation/AGENTS.md) | Guide | Agents | AI agent capabilities and quick start |
| [Automation Guides](./automation/AUTOMATION_GUIDES.md) | Guide | Developers | Comprehensive automation guides (includes auto-start, deployment setup, and testing) |
| [Automation Boundaries](./automation/AUTOMATION_BOUNDARIES.md) | Reference | All | Automation limitations and boundaries |
| [Integrations](./automation/INTEGRATIONS.md) | Reference | Developers | AI tool integrations (Claude, Ralph, Brutal Honesty) |
| [Cohesion](./automation/COHESION.md) | Reference | Developers | Cohesion engine configuration |
| [Branch Protection Setup](./automation/BRANCH_PROTECTION_SETUP.md) | Guide | Developers | GitHub branch protection configuration |

### 🔌 MCP (Model Context Protocol)

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [MCP Guide](./mcp/MCP.md) | Guide | Developers | Complete MCP guide (includes setup, quick start, Next.js DevTools integration, and examples) |

### 📚 Reference & Components

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Component Catalog](./reference/COMPONENT_CATALOG.md) | Reference | Developers | Complete component catalog and reference |

### 🔒 Security

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Security Guide](./security/SECURITY.md) | Guide | Developers | Security best practices (includes CSRF protection) |

### ⚖️ Legal

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Third Party Licenses](./legal/THIRD_PARTY_LICENSES.md) | Reference | All | Third-party software licenses |

### 📋 RFCs (Request for Comments)

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Reproducible Dev Environments](./RFC-REPRODUCIBLE-DEV-ENVIRONMENTS.md) | RFC | Developers | RFC for reproducible development environments |

---

## By Type

### Guides (Step-by-Step Instructions)

- [Agents Guide](./automation/AGENTS.md) - AI agent capabilities and quick start
- [Developer Quick Start](./onboarding/QUICK_START.md)
- [CI/CD Guide](./infrastructure/CI_CD_GUIDE.md) - Includes monitoring and rollback
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md)
- [Environment Setup](./onboarding/ENVIRONMENT_SETUP.md) - Complete environment setup
- [Database Guide](./database/DATABASE.md) - Complete database setup and configuration
- [Deployment Runbook](./onboarding/DEPLOYMENT_RUNBOOK.md)
- [Auth Guide](./auth/AUTH_GUIDE.md) - Usage examples and patterns
- [Testing Guide](./testing/TESTING.md) - Comprehensive testing guide
- [Code Style](./standards/CODE_STYLE.md) - Code style and linting
- [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md)
- [CMS Guide](./onboarding/CMS_GUIDE.md) - Complete CMS guide
- [MCP Guide](./mcp/MCP.md) - Complete MCP integration guide
- [Automation Guides](./automation/AUTOMATION_GUIDES.md) - Comprehensive automation guides
- [Security Guide](./security/SECURITY.md) - Security best practices

### Reference (Quick Lookup)

- [Status Dashboard](./PROJECT_STATUS.md)
- [Project Roadmap](./PROJECT_ROADMAP.md)
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md) - Includes quick reference tables
- [Component Mapping](./architecture/COMPONENT_MAPPING.md)
- [Component Catalog](./reference/COMPONENT_CATALOG.md)
- [Auth System](./auth/AUTH_SYSTEM.md) - Authentication system design
- [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
- [Overview](./onboarding/OVERVIEW.md) - Complete framework overview

### Migration Guides

- [Auth Migration Guide](./auth/AUTH_MIGRATION_GUIDE.md) - JWT to session-based migration
- [Database Migrations](./database/MIGRATIONS.md) - Migration strategy and provider switching

---

## By Audience

### For AI Agents

- [Agents Guide](./automation/AGENTS.md) - **Start here**
- [Status Dashboard](./PROJECT_STATUS.md)
- [Code Style](./standards/CODE_STYLE.md)
- [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
- [Automation Boundaries](./automation/AUTOMATION_BOUNDARIES.md)

### For Developers

- [Developer Quick Start](./onboarding/QUICK_START.md) - **Start here**
- [Environment Setup](./onboarding/ENVIRONMENT_SETUP.md)
- [Environment Variables Guide](./infrastructure/ENVIRONMENT_VARIABLES_GUIDE.md)
- [Database Guide](./database/DATABASE.md)
- [Deployment Runbook](./onboarding/DEPLOYMENT_RUNBOOK.md)
- [Testing Guide](./testing/TESTING.md)
- [Code Style](./standards/CODE_STYLE.md)

### For Contributors

- [Code Style](./standards/CODE_STYLE.md)
- [Documentation Standards](./standards/DOCUMENTATION_STANDARDS.md)
- [Testing Guide](./testing/TESTING.md)
- [Code of Conduct](./standards/CODE_OF_CONDUCT.md)

---

## By Task

This master index provides comprehensive navigation by topic, task, audience, and type.

### Common Tasks

- **Set up the project**: [Developer Quick Start](./onboarding/QUICK_START.md) + [Environment Setup](./onboarding/ENVIRONMENT_SETUP.md)
- **Add a new feature**: [Overview](./onboarding/OVERVIEW.md) + [Code Style](./standards/CODE_STYLE.md)
- **Deploy to production**: [CI/CD Guide](./infrastructure/CI_CD_GUIDE.md) + [Deployment Runbook](./onboarding/DEPLOYMENT_RUNBOOK.md)
- **Set up a fresh database**: [Database Guide](./database/DATABASE.md)
- **Understand the codebase**: [Overview](./onboarding/OVERVIEW.md) + [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
- **Work with authentication**: [Auth System](./auth/AUTH_SYSTEM.md) + [Auth Guide](./auth/AUTH_GUIDE.md)
- **Work with database**: [Database Guide](./database/DATABASE.md) + [Drizzle Guide](./infrastructure/DRIZZLE_GUIDE.md)
- **Run tests**: [Testing Guide](./testing/TESTING.md)
- **Set up AI automation**: [Agents Guide](./automation/AGENTS.md) + [MCP Guide](./mcp/MCP.md)

---

## Documentation Management

| Document | Type | Audience | Description |
|----------|------|----------|-------------|
| [Documentation Standards](./standards/DOCUMENTATION_STANDARDS.md) | Guide | All | Documentation standards and best practices (includes root docs policy) |
| [Master Index](./INDEX.md) | Reference | All | This comprehensive documentation index |

---

## Related Documentation

- [Master Index](./INDEX.md) - Comprehensive navigation (you are here)
- [Agents Guide](./automation/AGENTS.md) - For AI agents
- [Status Dashboard](./PROJECT_STATUS.md) - Current project state
- [Project Roadmap](./PROJECT_ROADMAP.md) - Development roadmap

---

**Last Updated**: 2026-01-31
**Maintained By**: RevealUI Team

---

## Documentation Consolidation Notes

This index reflects the results of aggressive documentation consolidation completed on 2026-01-31:

- **48 files total** (down from 100+)
- **Major consolidations**:
  - Auth: 7 files → 3 files
  - Database: 6 files → 3 files
  - Testing: 4 files → 1 file (TESTING.md includes load, penetration, verification testing)
  - Performance: 3 files → 1 file (PERFORMANCE.md includes auth performance benchmarks)
  - MCP: 4 files → 1 file (MCP.md includes setup, quick start, and Next.js DevTools)
  - Automation: 12 files → 6 files
  - Onboarding: 10 files → 5 files
  - Infrastructure: 6 files → 4 files
  - Standards: 8 files → 6 files

All consolidated files maintain complete content from their source files with clear organization and cross-references.
