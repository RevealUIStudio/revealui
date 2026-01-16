---
title: "Task-Based Documentation Guide"
type: "guide"
status: "active"
last_updated: "2025-01-27"
tags: ["tasks", "workflows", "navigation"]
related: ["INDEX.md", "AGENT_QUICK_START.md", "README.md"]
---

# Task-Based Documentation Guide

**Last Updated**: 2025-01-27  
**Status**: ✅ Active

Find documentation by what you want to accomplish. Each section provides step-by-step guidance with links to relevant documentation.

---

## 🚀 I want to get started

### As an AI Agent

1. **Read the entry point**
   - [Agent Quick Start Guide](./AGENT_QUICK_START.md) - Current state, key files, common tasks

2. **Understand the current state**
   - [Status Dashboard](./STATUS.md) - Package structure, recent changes, quick reference
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - How packages are organized

3. **Learn the architecture**
   - [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System overview
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package structure

4. **Review code conventions**
   - [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md) - AI-assisted development guidelines
   - [Root .cursorrules](../.cursorrules) - Project-specific rules

### As a Developer

1. **Set up the project** (5 minutes)
   - [Developer Quick Start Guide](./guides/QUICK_START.md) - Step-by-step setup
   - [Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration
   - [Environment Variables Reference](./development/ENV-VARIABLES-REFERENCE.md) - Quick lookup

2. **Set up the database**
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Complete guide
   - [Database Types Reference](./reference/database/DATABASE_TYPES_REFERENCE.md) - Type definitions

3. **Verify everything works**
   - [Developer Quick Start Guide](./guides/QUICK_START.md#step-5-verify-everything-works) - Verification steps
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Run tests

---

## 🏗️ I want to understand the codebase

1. **Start with the overview**
   - [Status Dashboard](./STATUS.md) - Current project state
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package organization

2. **Learn the architecture**
   - [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
   - [Dual Database Architecture](./architecture/DUAL_DATABASE_ARCHITECTURE.md) - Database architecture
   - [Multi-tenant Architecture](./development/MULTI-TENANT-ARCHITECTURE.md) - Multi-tenant patterns

3. **Explore package structure**
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Detailed package organization
   - [Component Mapping](./reference/COMPONENT-MAPPING.md) - Component, business logic, schema mapping

4. **Review recent changes**
   - [Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) - Recent package changes
   - [Status Dashboard](./STATUS.md#recent-changes-last-30-days) - Recent changes summary

---

## ➕ I want to add a new feature

1. **Review package conventions**
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
   - [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md) - Code style guidelines

2. **Understand the architecture**
   - [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md#creating-new-packages) - Creating new packages

3. **Follow development practices**
   - [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md) - AI-assisted development guidelines
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Testing requirements
   - [Error Handling](./development/ERROR_HANDLING.md) - Error handling patterns

4. **Test your changes**
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Testing guidelines
   - [Coverage Report Template](./development/COVERAGE-REPORT-TEMPLATE.md) - Test coverage

---

## 🔐 I want to work with authentication

1. **Understand the system**
   - [Auth System Design](./reference/auth/AUTH_SYSTEM_DESIGN.md) - Authentication system overview
   - [Auth Status](./reference/authentication/AUTH_STATUS.md) - Current implementation status

2. **See usage examples**
   - [Auth Usage Examples](./guides/auth/AUTH_USAGE_EXAMPLES.md) - Code examples and patterns
   - [Auth Implementation Status](./reference/authentication/IMPLEMENTATION_STATUS.md) - Implementation details

3. **Migrate from JWT (if needed)**
   - [Auth Migration Guide](./guides/auth/AUTH_MIGRATION_GUIDE.md) - JWT to session-based migration

4. **Security considerations**
   - [CSRF Protection Strategy](./development/CSRF_PROTECTION.md) - CSRF protection
   - [Penetration Testing Guide](./development/testing/PENETRATION-TESTING-GUIDE.md) - Security testing

---

## 💾 I want to work with the database

1. **Set up a fresh database**
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Complete setup guide
   - [Fresh Database Summary](./reference/database/FRESH-DATABASE-SUMMARY.md) - Quick summary

2. **Understand database types**
   - [Database Types Reference](./reference/database/DATABASE_TYPES_REFERENCE.md) - Type definitions
   - [Type Generation Guide](./reference/database/TYPE_GENERATION_GUIDE.md) - Generate types from schema

3. **Use Drizzle ORM**
   - [Drizzle Guide](./development/DRIZZLE-GUIDE.md) - Drizzle ORM / Neon HTTP integration
   - [Database Provider Switching](./reference/database/DATABASE-PROVIDER-SWITCHING.md) - Switch providers

4. **Work with ElectricSQL**
   - [ElectricSQL Integration](./development/electric-integration.md) - Integration guide
   - [ElectricSQL Setup Guide](./development/electric-setup-guide.md) - Setup instructions
   - [ElectricSQL Migrations](./reference/database/electric.migrations.sql) - SQL migrations

5. **Migrate databases**
   - [Database Migration Plan](./reference/database/DATABASE-MIGRATION-PLAN.md) - Migration strategy
   - [Migrate Vercel Postgres to Supabase](./development/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md) - Migration guide

6. **Explore advanced topics**
   - [TanStack DB Research](./reference/database/TANSTACK_DB_ELECTRIC_RESEARCH.md) - TanStack DB analysis
   - [TanStack DB Benefits](./reference/database/TANSTACK_DB_BENEFITS_FOR_REVEALUI.md) - Benefits analysis
   - [Contract Integration Guide](./reference/database/CONTRACT_INTEGRATION_GUIDE.md) - Contract layer

---

## 🚀 I want to deploy to production

1. **Prepare for deployment**
   - [CI/CD Guide](./development/CI-CD-GUIDE.md) - CI/CD with NeonDB and Vercel
   - [Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration
   - [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Complete deployment guide

2. **Configure environment**
   - [Environment Variables Reference](./development/ENV-VARIABLES-REFERENCE.md) - All variables
   - [Neon API Key Setup](./guides/configuration/NEON_API_KEY_SETUP.md) - Neon configuration

3. **Deploy**
   - [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Step-by-step deployment
   - [CI/CD Guide](./development/CI-CD-GUIDE.md) - Automated deployment

4. **Monitor and maintain**
   - [Monitoring Setup](./development/MONITORING_SETUP.md) - Monitoring configuration
   - [Rollback Procedure](./development/ROLLBACK-PROCEDURE.md) - Emergency rollback

---

## 🧪 I want to write tests

1. **Understand testing strategy**
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Testing guidelines
   - [Coverage Report Template](./development/COVERAGE-REPORT-TEMPLATE.md) - Coverage requirements

2. **Write different types of tests**
   - [Load Testing Guide](./development/testing/LOAD-TESTING-GUIDE.md) - Performance testing
   - [Penetration Testing Guide](./development/testing/PENETRATION-TESTING-GUIDE.md) - Security testing
   - [Auth Performance Testing](./development/performance/AUTH_PERFORMANCE_TESTING.md) - Auth tests

3. **Run and verify tests**
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Running tests
   - [Status Dashboard](./STATUS.md#testing-status) - Current test status

---

## ⚙️ I want to configure the project

1. **Environment variables**
   - [Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Complete setup
   - [Environment Variables Reference](./development/ENV-VARIABLES-REFERENCE.md) - Quick reference

2. **Database configuration**
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Database setup
   - [Database Provider Switching](./reference/database/DATABASE-PROVIDER-SWITCHING.md) - Switch providers
   - [Neon API Key Setup](./guides/configuration/NEON_API_KEY_SETUP.md) - Neon configuration

3. **Networking**
   - [Supabase IPv4 Explanation](./reference/configuration/SUPABASE_IPV4_EXPLANATION.md) - Networking config

4. **Monitoring and logging**
   - [Monitoring Setup](./development/MONITORING_SETUP.md) - Monitoring configuration
   - [Logging Strategy](./development/LOGGING_STRATEGY.md) - Logging best practices

---

## 📝 I want to work with CMS content

1. **Create content**
   - [CMS Content Examples](./guides/CMS-CONTENT-EXAMPLES.md) - Ready-to-use examples
   - [CMS Content Recommendations](./guides/CMS-CONTENT-RECOMMENDATIONS.md) - Best practices
   - [Blog Creation Guide](./guides/BLOG-CREATION-GUIDE.md) - Create blog posts

2. **Connect to frontend**
   - [CMS Frontend Connection Guide](./guides/CMS-FRONTEND-CONNECTION-GUIDE.md) - Connect CMS to frontend

3. **Customize themes**
   - [RevealUI Theme Usage Guide](./guides/REVEALUI-THEME-USAGE-GUIDE.md) - Theme customization

---

## 🔧 I want to troubleshoot issues

1. **Common setup issues**
   - [Developer Quick Start Guide](./guides/QUICK_START.md#troubleshooting) - Common issues and solutions
   - [Environment Variables Guide](./development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration issues

2. **Database issues**
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Database troubleshooting
   - [Drizzle Guide](./development/DRIZZLE-GUIDE.md) - Drizzle-specific issues

3. **Deployment issues**
   - [Deployment Runbook](./guides/deployment/DEPLOYMENT-RUNBOOK.md) - Deployment troubleshooting
   - [Rollback Procedure](./development/ROLLBACK-PROCEDURE.md) - Emergency procedures

4. **Check known limitations**
   - [Known Limitations](./development/KNOWN-LIMITATIONS.md) - Current limitations
   - [Error Handling](./development/ERROR_HANDLING.md) - Error handling patterns

---

## 🔄 I want to migrate or update

1. **Package migrations**
   - [Package Merge Migration Guide](./migrations/PACKAGE_MERGE_MIGRATION_GUIDE.md) - Package merge (types + generated → core)
   - [Deprecated Types Removal](./migrations/DEPRECATED-TYPES-REMOVAL.md) - Type deprecation

2. **Database migrations**
   - [Database Migration Plan](./reference/database/DATABASE-MIGRATION-PLAN.md) - Migration strategy
   - [Migrate Vercel Postgres to Supabase](./development/MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md) - Database migration
   - [Breaking Changes - CRDT](./migrations/BREAKING-CHANGES-CRDT.md) - CRDT breaking changes

3. **Auth migrations**
   - [Auth Migration Guide](./guides/auth/AUTH_MIGRATION_GUIDE.md) - JWT to session-based

---

## 🔌 I want to work with MCP (Model Context Protocol)

1. **Set up MCP**
   - [MCP Setup Guide](./mcp/MCP_SETUP.md) - Setting up MCP servers
   - [MCP Quick Start](./mcp/QUICK_START.md) - Using configured MCP servers

2. **Next.js DevTools**
   - [Next.js DevTools Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md) - DevTools MCP setup
   - [Next.js DevTools Demo](./mcp/NEXTJS_DEVTOOLS_MCP_DEMO.md) - Demo and examples
   - [Next.js DevTools In Action](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md) - Usage examples

3. **Examples and fixes**
   - [MCP Demo Interaction](./mcp/demo-mcp-interaction.md) - Interaction examples
   - [MCP Fixes 2025](./mcp/MCP_FIXES_2025.md) - Recent updates

---

## 📊 I want to understand project status

1. **Current status**
   - [Status Dashboard](./STATUS.md) - Current project state
   - [Final Status 2026](./assessments/FINAL_STATUS_2026.md) - Final project status

2. **Assessments**
   - [Brutal Final Assessment 2026](./assessments/BRUTAL_FINAL_ASSESSMENT_2026.md) - Comprehensive assessment
   - [Documentation Assessment](./assessments/DOCUMENTATION_ASSESSMENT.md) - Documentation quality
   - [API Routes Audit 2026](./assessments/API_ROUTES_AUDIT_2026.md) - API routes review

3. **Next steps**
   - [Next Steps Assessment](./assessments/NEXT_STEPS_BRUTAL_ASSESSMENT.md) - Priorities and next steps
   - [Prioritized Action Plan](./planning/PRIORITIZED_ACTION_PLAN.md) - Action plan

---

## 📚 I want to find specific documentation

1. **Use the master index**
   - [Master Index](./INDEX.md) - Comprehensive index by topic, type, audience, task

2. **Browse by category**
   - [Main README](./README.md) - Documentation overview
   - [Agent Quick Start](./AGENT_QUICK_START.md) - For AI agents
   - [Developer Quick Start](./guides/QUICK_START.md) - For developers

3. **Search by task**
   - [This document](./TASKS.md) - Task-based navigation (you are here)

---

## 🤝 I want to contribute

1. **Read contributing guidelines**
   - [Contributing Guidelines](../../CONTRIBUTING.md) - How to contribute
   - [Code Style Guide](./development/LLM-CODE-STYLE-GUIDE.md) - Code style requirements

2. **Understand the codebase**
   - [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package structure
   - [Architecture Overview](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture

3. **Follow development practices**
   - [Testing Strategy](./development/testing/TESTING-STRATEGY.md) - Testing requirements
   - [Error Handling](./development/ERROR_HANDLING.md) - Error handling patterns

---

## 🧠 I want to understand the memory/AI system

1. **Learn about the AI system**
   - [Unified Backend Architecture](./architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture including AI
   - [Dual Database Architecture](./architecture/DUAL_DATABASE_ARCHITECTURE.md) - Database architecture for AI

2. **Work with ElectricSQL for memory**
   - [ElectricSQL Integration](./development/electric-integration.md) - Integration guide
   - [ElectricSQL Setup Guide](./development/electric-setup-guide.md) - Setup instructions
   - [ElectricSQL Migrations](./reference/database/electric.migrations.sql) - SQL migrations

3. **Understand vector database**
   - [Dual Database Architecture](./architecture/DUAL_DATABASE_ARCHITECTURE.md) - Vector database architecture
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Database setup including Supabase

---

## 🔌 I want to set up MCP (Model Context Protocol)

1. **Get started with MCP**
   - [MCP Setup Guide](./mcp/MCP_SETUP.md) - Setting up MCP servers
   - [MCP Quick Start](./mcp/QUICK_START.md) - Using configured MCP servers

2. **Next.js DevTools**
   - [Next.js DevTools Quickstart](./mcp/NEXTJS_DEVTOOLS_MCP_QUICKSTART.md) - DevTools MCP setup
   - [Next.js DevTools Demo](./mcp/NEXTJS_DEVTOOLS_MCP_DEMO.md) - Demo and examples
   - [Next.js DevTools In Action](./mcp/NEXTJS_DEVTOOLS_IN_ACTION.md) - Usage examples

3. **Troubleshooting**
   - [MCP Fixes 2025](./mcp/MCP_FIXES_2025.md) - Recent updates and fixes
   - [MCP Demo Interaction](./mcp/demo-mcp-interaction.md) - Interaction examples

---

## 🐛 I want to debug issues

1. **Check error handling**
   - [Error Handling](./development/ERROR_HANDLING.md) - Error handling patterns
   - [Logging Strategy](./development/LOGGING_STRATEGY.md) - Logging best practices

2. **Review known issues**
   - [Known Limitations](./development/KNOWN-LIMITATIONS.md) - Current limitations
   - [Troubleshooting](./guides/QUICK_START.md#troubleshooting) - Common issues and solutions

3. **Check database issues**
   - [Fresh Database Setup](./reference/database/FRESH-DATABASE-SETUP.md) - Database troubleshooting
   - [Drizzle Guide](./development/DRIZZLE-GUIDE.md) - Drizzle-specific issues

4. **Review implementation status**
   - [Implementation Summary](./development/implementation/IMPLEMENTATION-SUMMARY.md) - Implementation overview
   - [Status Dashboard](./STATUS.md) - Current project state

---

## ⚡ I want to optimize performance

1. **Performance testing**
   - [Performance Testing](./development/performance/PERFORMANCE_TESTING.md) - General performance testing
   - [Auth Performance Testing](./development/performance/AUTH_PERFORMANCE_TESTING.md) - Auth performance tests
   - [Load Testing Guide](./development/testing/LOAD-TESTING-GUIDE.md) - Performance testing guide

2. **Monitoring**
   - [Monitoring Setup](./development/MONITORING_SETUP.md) - Monitoring configuration

3. **Database optimization**
   - [Drizzle Guide](./development/DRIZZLE-GUIDE.md) - Database optimization
   - [Database Provider Switching](./reference/database/DATABASE-PROVIDER-SWITCHING.md) - Switch providers for performance

---

## Related Documentation

- [Master Index](./INDEX.md) - Comprehensive documentation index
- [Agent Quick Start](./AGENT_QUICK_START.md) - For AI agents
- [Developer Quick Start](./guides/QUICK_START.md) - For developers
- [Main README](./README.md) - Documentation overview
- [Status Dashboard](./STATUS.md) - Current project state

---

**Last Updated**: 2025-01-27  
**Maintained By**: RevealUI Team
