---
title: "Automation Guide"
description: "CI/CD automation, git hooks, pre-commit checks, and deployment scripts"
category: operations
audience: maintainer
---

# Automation Guide

Comprehensive guide to automation, AI agents, code quality analysis, and development integrations in the RevealUI Framework.

Commercial note: automation and AI features should be priced primarily through account-level entitlements plus metered execution, not only static tier flags or per-user license assumptions.

## Table of Contents

1. [AI Agents](#ai-agents)
   - [Quick Start for Agents](#quick-start-for-agents)
   - [Agent Capabilities](#agent-capabilities)
   - [Specialized Agents](#specialized-agents)
   - [Workflows & Automation](#workflows--automation)
   - [MCP Integration](#mcp-integration)
   - [Development Guidelines](#development-guidelines)
2. [Automation Guides](#automation-guides)
   - [Auto-Start Development](#auto-start-development)
   - [Deployment Setup](#deployment-setup)
   - [Testing Infrastructure](#testing-infrastructure)
   - [Automation Boundaries](#automation-boundaries)
   - [Branch Protection](#branch-protection)
3. [Cohesion Engine](#cohesion-engine)
   - [Overview](#cohesion-overview)
   - [Usage](#cohesion-usage)
   - [Architecture](#cohesion-architecture)
   - [Patterns Detected](#patterns-detected)
4. [Integrations](#integrations)
   - [Claude Code Integration](#claude-code-integration)
   - [Rev Workflow System](#rev-workflow-system)
   - [Brutal Honesty System](#brutal-honesty-system)
   - [Integration Architecture](#integration-architecture)

---

# AI Agents

Comprehensive guide to AI agent capabilities, configurations, and workflows in the RevealUI Framework.

## Quick Start for Agents

**Purpose**: Entry point for AI agents working on RevealUI Framework

### Current State (2026-03-16)

**Project Overview**

- **Framework**: RevealUI — Full-stack React 19 + Next.js 16 Admin Framework
- **Package Count**: 22 packages (17 OSS + 5 Pro)
- **Test Status**: 1,300+ test files, all packages build and typecheck ✅
- **Build Status**: All 30 workspaces build successfully ✅

### Commercial Direction

From 2026 onward, automation features should align with:

- platform subscription value at the account or workspace level
- metered agent execution for workflows, tool calls, and expensive automations
- optional commerce-linked fees when automation participates in paid transactions
- trust and governance controls as premium capabilities

**Package Structure**

```
packages/
├── core/           # Runtime engine (includes types/ and generated/)
├── contracts/      # Zod schemas & TypeScript types
├── db/             # Database (Drizzle ORM, 81 tables)
├── auth/           # Authentication system
├── presentation/   # 57 UI components (Tailwind v4)
├── router/         # File-based router with SSR
├── config/         # Type-safe env config (Zod)
├── utils/          # Logger, DB helpers, validation
├── cli/            # create-revealui scaffolding
├── create-revealui/ # npm create revealui initializer
├── setup/          # Environment setup utilities
├── sync/           # ElectricSQL real-time sync
├── cache/          # CDN config, edge cache, ISR presets
├── resilience/     # Circuit breaker, retry, bulkhead
├── security/       # Headers, CORS, RBAC/ABAC, GDPR
├── dev/            # Shared configs (Biome, TS, Tailwind)
├── test/           # E2E specs, fixtures, mocks
├── ai/             # AI agents, CRDT memory (Pro)
├── mcp/            # MCP hypervisor + adapter framework (Pro)
├── editors/        # Editor config sync (Pro)
├── services/       # Stripe + Supabase (Pro)
└── harnesses/      # AI harness adapters (Pro)
```

### Key Files to Read First

**1. Package Structure**

- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - How packages are organized

**2. Current Status**

- [Architecture](./ARCHITECTURE.md) - System architecture and patterns

**3. Code Conventions**

- [Code Standards](./STANDARDS.md) - Code style, linting, module resolution
- [Package Conventions](../packages/PACKAGE-CONVENTIONS.md) - Package organization

### Common Tasks & Documentation

**Adding a New Feature**

1. Review [Package Conventions](../packages/PACKAGE-CONVENTIONS.md)
2. Check [Code Standards](./STANDARDS.md)
3. Follow [Testing Guide](./testing/TESTING.md)

**Working with Types**

1. [Package Conventions - Types Section](../packages/PACKAGE-CONVENTIONS.md#types-and-generated-code)
2. Types live in `@revealui/contracts` (Zod schemas) and `@revealui/core/types` (admin types)

**Database Operations**

1. [Database Guide](./DATABASE.md) - Schema, migrations, queries
2. Schemas in `packages/db/src/schema/` — Drizzle ORM

**Authentication**

1. [Auth Guide](./AUTH.md) - System design, usage, migration

**Deployment**

1. [Deployment Runbook](./guides/deployment/DEPLOYMENT_RUNBOOK.md)
2. [CI/CD Guide](./development/CI_CD_GUIDE.md)
3. [Environment Variables Guide](./development/ENVIRONMENT_VARIABLES_GUIDE.md)

### Important Conventions

**Import Paths**

- Use `@/lib/*` for admin app imports
- Use `revealui/*` for framework imports
- Use `@revealui/core/types` (NOT `@revealui/types` - merged)
- Use `@revealui/core/generated` (NOT `@revealui/generated` - merged)

**Code Style**

- **Quotes**: Single quotes for strings, double for JSX
- **Semicolons**: Omit when not required
- **Module System**: ESM only (NO CommonJS)
- **Package Manager**: Always use `pnpm` (never `npx`, use `pnpm dlx`)

**Next.js 16**

- `params` and `searchParams` are Promises - always await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes

### Documentation Structure

```
docs/
├── INDEX.md                    # Master documentation index
├── ARCHITECTURE.md             # System architecture
├── STANDARDS.md                # Code standards
├── TESTING.md                  # Testing guide
├── REFERENCE.md                # Package reference
└── archive/                    # Historical docs
```

### Quick Reference

**Package Imports**

```typescript
// ✅ CORRECT (current)
import type { Config } from "@revealui/core/types";
import { GeneratedComponent } from "@revealui/core/generated/components";

// ❌ WRONG (old, merged)
import type { Config } from "@revealui/types";
import { GeneratedComponent } from "@revealui/generated/components";
```

**Common Commands**

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

### Things to Avoid

1. **Don't use CommonJS** - Always use ESM (`import`/`export`)
2. **Don't use `npx`** - Use `pnpm dlx` instead
3. **Don't use old package paths** - `@revealui/types` and `@revealui/generated` are merged
4. **Don't forget to await** - `params` and `searchParams` are Promises in Next.js 16
5. **Don't use GraphQL** - This project uses REST APIs only

### Project Health

- **Tests**: 211/211 passing ✅
- **Build**: All packages build successfully ✅
- **Type Safety**: Strict TypeScript enabled ✅
- **Documentation**: Comprehensive (see [Documentation Audit](./DOCUMENTATION_AUDIT_2025.md))

---

## Agent Capabilities

This section outlines all the capacities and behaviors that arise from using AI agents with the RevealUI codebase specifically, compared to working with a generic codebase.

### Mandatory Rules & Policies

#### Legacy Code Removal Policy (TOP PRIORITY)

**Status**: 🔴 **MANDATORY - ENFORCED PROJECT-WIDE**

The agent is **required** to:

1. **Before Every Change**: Search for deprecated/legacy code in the affected area
2. **No Backward Compatibility**: Never maintain old code paths "for backward compatibility"
3. **Immediate Removal**: Remove deprecated code in the same PR/commit as new implementations
4. **Refactor All Call Sites**: Update all usages to new implementations immediately
5. **No Grace Period**: Deprecated code must be removed within the same development cycle

**This is not optional** - it's enforced on every agent interaction. The agent will:

- Check for legacy code before making changes
- Refactor to new implementations if legacy code is found
- Remove old code as part of the change
- Update all references to use current implementations

**Files**: `.cursor/rules.md` (includes agent-specific rules), `.cursor/LEGACY-CODE-REMOVAL-POLICY.md`

#### Framework-Specific Conventions

The agent enforces these RevealUI-specific conventions:

- **No GraphQL**: Uses REST APIs and RPC exclusively (GraphQL is forbidden)
- **Package Manager**: Always use `pnpm dlx` instead of `npx` (except preinstall hooks)
- **Module System**: ESM (`import`/`export`) only - NO CommonJS
- **Next.js 16**: Aware that `params` and `searchParams` are Promises (must await)
- **TypeScript**: Strict mode, no `as any`, prefer explicit types
- **Biome Formatting**: Single quotes for strings, double quotes for JSX, no unnecessary semicolons

### Codebase-Specific Tooling

#### Scaffold Commands

**Page Scaffolding** (`.cursor/commands/scaffold-page.ts`):

- Generate new pages with templates (landing, dashboard, profile, settings)
- Automatically include MCP integration hooks
- Generate TypeScript types for new pages
- Command: `pnpm scaffold:page --name="Dashboard" --route="/dashboard"`

#### Type Generation Scripts

- **RevealUI Types**: `pnpm generate:revealui-types` - Generate admin types
- **Neon Types**: `pnpm generate:neon-types` - Generate database types
- **OpenAPI Spec**: `pnpm generate:openapi` - Generate API documentation

#### Cohesion Analysis

**File**: `.cursor/cohesion-analysis.json`

The agent can access **code cohesion analysis** that identifies:

- Duplicate patterns (e.g., `getRevealUI({ config })` calls found 11 times)
- Type safety violations (60 instances of `as any`)
- Import inconsistencies (110 unscoped imports)
- Pattern recommendations

**Current Analysis**:

- 225 total pattern instances across 91 files
- 1 CRITICAL issue (type assertions with `as any`)
- 2 HIGH issues (duplicate patterns)
- Overall grade: "D+ (Functional but Painful)"

The agent uses this to prioritize refactoring and identify technical debt.

### Architecture Awareness

#### Monorepo Structure

The agent understands the **pnpm workspace structure**:

```
apps/
  ├── admin/        # Next.js 16 + @revealui/core application
  └── web/        # RevealUI + React application

packages/
  ├── core/       # Core runtime engine (@revealui/core)
  ├── db/         # Drizzle ORM schemas (@revealui/db)
  ├── config/     # Configuration management (@revealui/config)
  ├── services/   # Shared services (Stripe, Supabase)
  ├── dev/        # Development tooling
  ├── test/       # Test utilities
  └── ai/         # AI memory and agent context management
```

#### Import Path Awareness

The agent enforces correct import paths:

- `@/lib/*` - admin app imports
- `@revealui/core` - Runtime engine imports
- `@revealui/db` - Database imports
- `@revealui/config` - Configuration imports
- `revealui/*` vs `@revealui/*` - Scoped vs unscoped (agent knows both exist)

#### Framework-Specific Patterns

- **admin Initialization**: `getRevealUI({ config })` pattern
- **Collection Access**: Aware of collection hooks and access control
- **Admin Interface**: Understands admin layout and routing patterns
- **Block Rendering**: Knows `RenderBlocks` and block normalization patterns

### Code Quality Enforcement

#### Automated Quality Checks

The agent runs quality checks via scripts:

1. **Console Auditing**: `scripts/audit/audit-console-usage.ts`
2. **Type Safety**: `scripts/audit/audit-any-types.ts`
3. **Code Quality**: `scripts/analysis/analyze-code-quality.ts`

#### Validation Scripts

Pre-launch and continuous validation:

- `scripts/validation/pre-launch-validation.ts`
- `scripts/validation/run-automated-validation.ts`
- `scripts/validation/check-console-statements.ts`

#### Build & Test Awareness

The agent knows:

- **Turbopack** is preferred over Webpack for Next.js builds
- Test locations: `*.test.ts` or `*.spec.ts` next to source files
- Coverage reporting via `pnpm test:coverage`
- Type checking: `pnpm typecheck:all`

### Documentation Management

#### Lifecycle Management

**File**: `scripts/docs/detect-stale-docs.ts`, `scripts/docs/docs-lifecycle.ts`

The agent can:

- Detect stale documentation
- Manage assessment documents
- Archive old documentation
- Consolidate duplicate docs

**Commands**:

- `tsx scripts/docs/detect-stale-docs.ts`
- `tsx scripts/docs/manage-assessments.ts`

#### Documentation Scripts

- **API Docs**: Generate from code comments
- **Package READMEs**: Auto-generate package documentation
- **JSDoc Coverage**: Measure documentation completeness
- **Validation**: Verify documentation quality

### Testing Infrastructure

#### Test Utilities Package

The agent knows about `@revealui/test` package with:

- Integration test utilities
- Database test setup/teardown
- Auth testing helpers
- Performance baseline tools

#### Test Scripts

Located in `/scripts/test/`:

- `auth-direct-test.ts` - Direct auth testing
- `auth-e2e-test.ts` - End-to-end auth flows
- `performance-baseline.ts` - Performance benchmarking
- `setup-test-database.ts` - Test database initialization

#### Test Configuration

The agent is aware of:

- Vitest configuration for unit tests
- Playwright configuration for E2E tests
- Test database setup patterns
- Integration test workflows

### Cohesion Analysis

#### Pattern Detection

The agent can access and act on cohesion analysis that identifies:

1. **Duplicate Patterns** (HIGH severity)
   - Config imports (17 instances)
   - `getRevealUI({ config })` calls (11 instances)

2. **Type Safety Violations** (CRITICAL severity)
   - 60 instances of `as any` across 29 files
   - 27 instances of `as unknown` across 18 files

3. **Import Inconsistencies** (MEDIUM severity)
   - 110 unscoped imports (`revealui/` instead of `@revealui/`)

The agent uses this data to:

- Prioritize refactoring efforts
- Suggest pattern extraction into utilities
- Identify technical debt hotspots

### Environment Configuration

#### Environment Variables

The agent knows:

- `.env` files are **tracked in git** (production values in CI/CD)
- Required variables: `REVEALUI_SECRET`, `REVEALUI_PUBLIC_SERVER_URL`
- Database: `POSTGRES_URL` (PGlite used for local dev/testing when unavailable)
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Vercel: `VERCEL_API_KEY`, `VERCEL_TOKEN`

**Note**: Environment files are **included in Cursor context** (not in `.cursorignore`) to help with configuration assistance, while sensitive values remain in CI/CD.

### Development Workflow

#### Automation Scripts

**File**: `scripts/automation/auto-start-dev.ts`

The agent understands the development workflow:

- `pnpm dev` runs pre-hook automation before starting servers
- `pnpm dev:no-automation` bypasses automation
- Background server execution patterns
- **Never pipes dev server output** through `head`/`tail` (runs continuously)

#### Build Commands

- `pnpm build` - Build all packages (uses Vercel build)
- `pnpm build:packages` - Build publishable packages only
- `pnpm typecheck:all` - Type check entire monorepo
- `pnpm lint` - Lint all packages (concurrency: 15)
- `pnpm test` - Run all tests (concurrency: 15)

---

## Specialized Agents

The codebase includes **specialized agent configurations** that guide behavior for specific tasks:

### 1. Next.js Agent (`.cursor/agents/nextjs.md`)

- Next.js 16 specific patterns and route handlers
- Dynamic route handling with `export const dynamic = "force-dynamic"`
- Promise-based params/searchParams patterns

### 2. Next.js Error Analyzer (`.cursor/agents/nextjs-error-analyzer.md`)

- **Experimental**: Capture and analyze browser console errors using MCP
- Integrated debugging capabilities

### 3. Admin Agent (`.cursor/agents/admin.md`)

- RevealUI admin collections, hooks, and access control patterns
- Collection configuration patterns
- Admin interface patterns

### 4. TypeScript Agent (`.cursor/agents/typescript.md`)

- Type checking and fixes specific to RevealUI's type system
- Aware of framework-specific types (`Config`, `CollectionConfig`)
- Type generation workflows

### 5. Testing Agent (`.cursor/agents/testing.md`)

- Vitest and Playwright patterns
- Framework-specific test utilities from `@revealui/test`

**Usage**: Reference agents in chat: "Use the admin agent to help with..." or "Apply the TypeScript agent for..."

---

## Workflows & Automation

### Step-by-Step Workflows

Predefined workflows for common tasks:

1. **analyze-console-errors.md** - Browser console error analysis using MCP (⚠️ Experimental)
2. **new-component.md** - Component creation workflow
3. **rev-iterative-workflow.md** - Iterative development patterns

### Automation Scripts

The agent has access to extensive automation scripts in `/scripts`:

- **Analysis**: Code quality analysis, type migration, performance measurement
- **Audit**: Console usage auditing, type safety checking
- **Cohesion**: Code cohesion analysis and pattern detection
- **Database**: Reset, migration, seeding operations
- **Documentation**: Lifecycle management, stale doc detection, API doc generation
- **Validation**: Pre-launch validation, package verification, security testing

**Command Examples**:

- `pnpm analysis:console` - Audit console usage
- `tsx scripts/docs/detect-stale-docs.ts` - Find stale documentation
- `tsx scripts/analysis/analyze-code-quality.ts` - Analyze code quality patterns

---

## MCP Integration

### Configured MCP Servers

The agent has access to **7 MCP servers** configured specifically for RevealUI:

1. **Code Validator MCP** (`mcp-code-validator`)
   - Static analysis and code quality checks
   - Lint rule validation
   - Type checking

2. **Vercel MCP** (`mcp-vercel`)
   - Deployment management
   - Project configuration
   - Environment variable access

3. **Stripe MCP** (`mcp-stripe`)
   - Payment processing
   - Customer management
   - Webhook handling

4. **Neon MCP** (`mcp-neon`)
   - Database management
   - Connection testing
   - Migration tools

5. **Supabase MCP** (`mcp-supabase`)
   - Supabase project management
   - Auth configuration
   - Database operations

6. **Playwright MCP** (`mcp-playwright`)
   - E2E testing automation
   - Browser automation
   - Test execution

7. **Next.js DevTools MCP** (`mcp-next-devtools`)
   - Next.js debugging
   - Development tooling
   - Performance analysis

**Configuration Files**: `.cursor/mcp-config.json`, `.mcp/config.json`

**Capabilities**:

- Direct integration with deployment pipelines
- Payment processing workflows
- Database operations without manual SQL
- Automated testing execution
- Debugging and performance analysis

---

## Development Guidelines

### Summary: Unique Capabilities vs Generic Codebase

1. **Mandatory Legacy Removal**: Top-priority enforcement not present in generic codebases
2. **Specialized Agents**: Task-specific AI behaviors (admin, Next.js, TypeScript)
3. **MCP Integration**: 6 configured servers (Vercel, Stripe, Neon, Supabase, Playwright, Next.js DevTools)
4. **Cohesion Analysis**: Access to code pattern analysis and technical debt metrics
5. **Framework-Specific Tooling**: Scaffolding, type generation, documentation management
6. **Architecture Awareness**: Deep understanding of monorepo structure and import patterns
7. **Quality Enforcement**: Automated auditing and validation specific to RevealUI patterns
8. **Documentation Lifecycle**: Automated doc management and stale detection
9. **Test Infrastructure**: Framework-specific test utilities and patterns
10. **Development Automation**: Pre-hook scripts and workflow automation

### Key Behavioral Differences

- **Proactive Legacy Removal**: Removes old code as part of every change
- **MCP-Aware**: Can leverage deployment, payment, and database tools directly
- **Pattern Recognition**: Uses cohesion analysis to suggest improvements
- **Type Generation**: Automatically generates types from admin/database schemas
- **Quality Focus**: Runs validation and auditing as part of development workflow

---

# Automation Guides

Comprehensive guides for development automation, testing, and deployment in RevealUI Framework.

## Auto-Start Development

This guide explains how the automation checks MCP server configuration and provides Rev workflow suggestions when running `pnpm dev`.

### Overview

The RevealUI framework includes automation that:

1. **MCP configuration check** - Validates MCP server configuration when you run `pnpm dev`
2. **Rev workflow suggestions** - Reminds you about active Rev workflows or suggests using Rev for complex tasks

### MCP Server Configuration Check

#### How It Works

When you run `pnpm dev`, the automation script:

1. Checks if `.cursor/mcp-config.json` exists (indicates MCP is configured)
2. Validates environment variables for each MCP server
3. Shows which servers are configured and ready

**Important**: MCP servers are managed by Cursor IDE automatically. The automation script doesn't start them - it only checks if they're configured correctly. Cursor IDE will start MCP servers when needed based on `.cursor/mcp-config.json`.

#### Configuration

**Enable Configuration Check (Default)**

By default, MCP configuration is checked if:

- `.cursor/mcp-config.json` exists (MCP is configured)
- Required environment variables are set for the servers

**Disable Configuration Check**

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_START_MCP=false
```

Or use the non-automated dev command:

```bash
pnpm dev:no-automation
```

#### Available MCP Servers

The automation checks for these servers and validates their configuration:

1. **Vercel** - Requires `VERCEL_API_KEY` or `VERCEL_TOKEN`
2. **Stripe** - Requires `STRIPE_SECRET_KEY`
3. **Neon** - Requires `NEON_API_KEY`
4. **Supabase** - Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`
5. **Playwright** - No env vars required (always available)
6. **Next.js DevTools** - No env vars required (always available)

#### Starting MCP Servers

**By Cursor IDE (Recommended)**: Cursor IDE automatically starts MCP servers when needed based on `.cursor/mcp-config.json`.

**Manual Preparation**: Validate MCP credentials and include MCP checks in the standard RevealUI bootstrap:

```bash
pnpm setup:mcp
revealui dev up --include mcp
```

### Rev Workflow Suggestions

#### How It Works

The automation script:

1. Checks if a Rev workflow is currently active
2. If active, shows status and continuation commands
3. If not active, suggests using Rev for complex tasks (optional)

#### Active Workflow Detection

If you have an active Rev workflow, you'll see:

```
📋 Rev workflow is active
   Check status: pnpm rev:status
   Continue: pnpm rev:continue
```

#### Suggestions

If no active workflow and suggestions are enabled, you'll see:

```
💡 Tip: Use Rev workflow for complex, multi-iteration tasks
   Start: pnpm rev:start "<task>" --completion-promise "DONE"
   Set AUTO_SUGGEST_REV=false to disable this message
```

#### Disable Suggestions

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_SUGGEST_REV=false
```

### Environment Variables

Add these to your `.env.development.local`:

```bash
# MCP Auto-Start Control
AUTO_START_MCP=true              # Enable/disable MCP auto-start (default: true if configured)
AUTO_SUGGEST_REV=true          # Enable/disable Rev suggestions (default: true)

# MCP Server Configuration (required for auto-start)
VERCEL_API_KEY=your_key_here     # For Vercel MCP
STRIPE_SECRET_KEY=sk_test_...    # For Stripe MCP
NEON_API_KEY=your_key_here       # For Neon MCP
SUPABASE_URL=https://...         # For Supabase MCP
SUPABASE_ANON_KEY=your_key_here  # For Supabase MCP
```

### Usage Examples

#### Default Behavior (Auto-Start Enabled)

```bash
# Starts MCP servers automatically, shows Rev tips
pnpm dev
```

#### Disable Auto-Start

```bash
# Set env var
export AUTO_START_MCP=false
pnpm dev

# Or use non-automated command
pnpm dev:no-automation
```

#### Disable Rev Suggestions

```bash
# Set env var
export AUTO_SUGGEST_REV=false
pnpm dev
```

#### Full Control

```bash
# Disable all automation
export AUTO_START_MCP=false
export AUTO_SUGGEST_REV=false
pnpm dev

# Or just use the non-automated command (no suggestions shown)
pnpm dev:no-automation
```

### Troubleshooting

#### MCP Servers Not Starting

1. **Check configuration**:

   ```bash
   ls .cursor/mcp-config.json  # Should exist
   ```

2. **Check environment variables**:

   ```bash
   # Verify required vars are set
   echo $VERCEL_API_KEY
   echo $STRIPE_SECRET_KEY
   # etc...
   ```

3. **Validate MCP setup** (to see errors):
   ```bash
   pnpm setup:mcp
   ```

#### Automation Script Failing

The automation script is designed to **never block** `pnpm dev` startup. If automation fails, you'll see a warning but dev will still start.

To debug:

```bash
# Run automation script directly
tsx scripts/automation/auto-start-dev.ts
```

#### MCP Servers Already Running

If MCP servers are already running from a previous session, starting them again is safe. The MCP protocol handles multiple instances gracefully (they'll connect to the same servers).

### Best Practices

1. **Enable auto-start by default** - It's convenient and doesn't interfere if you don't need it
2. **Use Rev workflow suggestions** - Helps you discover the feature for complex tasks
3. **Set env vars in `.env.development.local`** - Keeps configuration persistent
4. **Check MCP status manually** if needed:
   ```bash
   # See what servers are configured
   cat .cursor/mcp-config.json
   ```

### Related Commands

- `pnpm dev` - Start dev with automation (default)
- `pnpm dev:no-automation` - Start dev without automation
- `pnpm setup:mcp` - Validate MCP credentials manually
- `revealui dev up --include mcp` - Include MCP checks in the standard bootstrap flow
- `pnpm rev:start` - Start a Rev workflow
- `pnpm rev:status` - Check Rev workflow status

### Implementation Details

The automation script (`scripts/automation/auto-start-dev.ts`) runs before `turbo run dev` and:

1. Checks for Rev workflows
2. Validates MCP configuration
3. Starts MCP servers in background (non-blocking)
4. Provides helpful tips and status messages

All automation is **non-blocking** - if it fails, `pnpm dev` will still start normally.

---

## Deployment Setup

### Overview

RevealUI uses Vercel for both staging and production deployments. This document covers the setup and configuration for automated deployments.

### Environments

#### Staging Environment

- **Trigger**: Automatic on pushes to `main` branch
- **Purpose**: Performance testing and validation
- **URL**: Auto-generated Vercel deployment URL (e.g., `https://revealui-xyz.vercel.app`)
- **Retention**: Deployments are temporary and may be cleaned up by Vercel

#### Production Environment

- **Trigger**: Manual approval after staging validation
- **Purpose**: Live user-facing application
- **URL**: Production domain (configured in Vercel)
- **Retention**: Permanent deployments with rollback capability

### Required Secrets

Add these secrets to your GitHub repository:

#### Vercel Integration

```
VERCEL_TOKEN          # Vercel API token for deployments
VERCEL_PROJECT_ID     # Optional: Project ID for advanced Vercel features
VERCEL_ORG_ID         # Optional: Organization ID for team deployments
```

#### Environment Variables

```
STAGING_URL           # Base URL for staging performance tests
PRODUCTION_URL        # Production domain URL
```

### Vercel Configuration

#### Project Setup

1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework**: Next.js (for admin) + Static (for Web)
   - **Build Command**: `pnpm build:packages && pnpm build`
   - **Output Directory**: Auto-detected from `vercel.json`
   - **Install Command**: `pnpm install --frozen-lockfile`

#### Domain Configuration

- **Staging**: Uses Vercel's auto-generated URLs
- **Production**: Configure your custom domain in Vercel dashboard

### Deployment Workflow

#### Automatic Staging Deployment

1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: Packages and applications are built
3. **Deploy**: Pushed to Vercel staging
4. **Test**: Performance tests run against staging URL
5. **Gate**: Results determine production deployment readiness

#### Manual Production Deployment

1. **Trigger**: Manual workflow dispatch after staging approval
2. **Validation**: Requires staging URL input
3. **Deploy**: Production deployment to custom domain
4. **Verification**: Smoke tests and health checks
5. **Monitoring**: Deployment status and rollback plan

### Troubleshooting

#### Common Issues

**Vercel CLI Authentication**

```
Error: No authorization token was found
```

**Solution**: Ensure `VERCEL_TOKEN` secret is properly set

**Build Failures**

```
Error: Build failed due to missing dependencies
```

**Solution**: Check that `pnpm install` completed successfully

**Domain Configuration**

```
Error: Domain not configured
```

**Solution**: Configure custom domain in Vercel dashboard

#### Rollback Procedures

**Emergency Rollback**

1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the failing deployment
3. Click "Rollback" to revert to previous version
4. Monitor application health

**Via GitHub Actions**

1. Run "Production Deployment" workflow with `force_deploy: true`
2. Select a previous working deployment
3. Monitor rollback completion

### Monitoring

#### Health Checks

- **Staging**: Automatic health checks during deployment
- **Production**: Smoke tests after deployment completion

#### Performance Monitoring

- **Lighthouse**: Automated performance scoring
- **Load Testing**: Response time and throughput validation
- **Regression Detection**: Performance baseline comparisons

### Security Considerations

- **Secrets Management**: All Vercel tokens stored as GitHub secrets
- **Environment Isolation**: Staging and production use separate environments
- **Access Control**: Production deployments require manual approval
- **Audit Trail**: All deployments logged in GitHub Actions and Vercel

### Cost Optimization

- **Staging Cleanup**: Vercel automatically removes old staging deployments
- **Production Optimization**: Use Vercel Analytics to monitor usage
- **Build Caching**: GitHub Actions caching reduces build times

### Support

For deployment issues:

1. Check Vercel dashboard for deployment logs
2. Review GitHub Actions workflow runs
3. Check environment variables and secrets
4. Contact DevOps team for assistance

---

## Testing Infrastructure

### Overview

This guide provides comprehensive testing procedures for the GitHub infrastructure improvements. Test the infrastructure systematically to ensure all components work correctly.

### Pre-Testing Checklist

#### Repository Configuration

- [ ] Branch protection rules applied to `main` branch
- [ ] Required secrets configured (`VERCEL_TOKEN`, etc.)
- [ ] All workflows are present and syntactically valid

#### Local Development Setup

- [ ] Node.js 24.x installed (check `.nvmrc`)
- [ ] Dependencies installed (`pnpm install`)
- [ ] All validation scripts executable

### Phase 1: Validation Scripts Testing

#### Test Validation Scripts Locally

```bash
# Test workspace validation
pnpm run validate:workspace

# Test dependency validation
pnpm run validate:deps

# Test type validation (requires TypeScript)
pnpm run validate:ts
```

**Expected Results:**

- ✅ Scripts run without errors
- ✅ Clear pass/fail messages
- ✅ No missing dependencies or configuration issues

#### Test Changeset Tools

```bash
# Test changeset helper
pnpm changeset:status

# Test changeset validation (if changesets exist)
pnpm changeset:version --dry-run
```

### Phase 2: Branch Protection Testing

#### Manual Branch Protection Test

1. **Create Test Branch:**

   ```bash
   git checkout -b test-infrastructure
   git commit --allow-empty -m "Test infrastructure"
   git push origin test-infrastructure
   ```

2. **Create Test PR:**
   - Go to GitHub → Pull Requests → New Pull Request
   - Base: `main`, Compare: `test-infrastructure`
   - Create PR with title "Test: Infrastructure Validation"

3. **Verify Branch Protection:**
   - [ ] PR cannot be merged without approval
   - [ ] All required status checks are running
   - [ ] "Merge pull request" button is disabled
   - [ ] Security scans are executing

4. **Test Review Process:**
   - [ ] Add yourself as reviewer
   - [ ] Approve the PR
   - [ ] Verify merge is now allowed (after all checks pass)

### Phase 3: CI/CD Pipeline Testing

#### Test CI Pipeline Execution

**Monitor CI Checks on Test PR:**

- [ ] `validate-config` - Should pass configuration validation
- [ ] `lint` - Should run Biome checks
- [ ] `typecheck` - Should validate TypeScript compilation
- [ ] `test` - Should run unit tests with coverage
- [ ] `security-scan` - Should check for vulnerabilities
- [ ] `docs-verification` - Should validate documentation
- [ ] `build-admin` - Should build Next.js admin application
- [ ] `build-web` - Should build Vite web application
- [ ] `validate-crdt` - Should validate database schema
- [ ] `integration-tests` - Should run database integration tests

**Expected Results:**

- ✅ All checks pass (green checkmarks)
- ✅ No workflow failures
- ✅ Test coverage reports generated
- ✅ Build artifacts uploaded

#### Test Security Scanning

**Verify Security Checks:**

- [ ] Snyk vulnerability scan completes
- [ ] Secret scanning runs without errors
- [ ] Dependency review executes
- [ ] CodeQL analysis finishes

**Security Test Scenario:**

```bash
# Create a test file with a fake secret (remove after test)
echo "API_KEY=fake_secret_123" > test-secret.txt
git add test-secret.txt
git commit -m "Test security scanning"
git push
```

**Expected Results:**

- ⚠️ Secret scanning should flag the fake secret
- ✅ Other security checks should pass
- 🧹 Remove the test file after verification

### Phase 4: Deployment Testing

#### Test Staging Deployment

**Trigger Staging Deployment:**

1. Merge the test PR to `main` branch
2. Monitor the "Performance" workflow
3. Check staging deployment job

**Verify Staging Deployment:**

- [ ] Vercel deployment succeeds
- [ ] Health checks pass
- [ ] Performance tests run against staging URL
- [ ] Staging URL is accessible

#### Test Production Deployment Gates

**Verify Production Gates:**

- [ ] Staging tests must pass before production deployment
- [ ] Production deployment requires manual approval
- [ ] Production deployment uses staging artifacts
- [ ] Rollback procedures are documented

### Phase 5: Automated Verification

#### Run Verification Scripts

```bash
# Verify branch protection (requires GitHub CLI)
pnpm verify:branch-protection

# Test local validation (if available)
pnpm validate:all
```

#### Monitor Workflow Metrics

**Check GitHub Actions:**

- [ ] All workflows complete successfully
- [ ] No workflow timeouts or cancellations
- [ ] Reasonable execution times (< 15 minutes for CI)
- [ ] No excessive resource usage

### Test Scenarios

#### Happy Path Testing

1. **Clean PR:** Create PR with no issues
   - Expected: All checks pass, mergeable after approval

2. **Code Quality Issues:** Introduce linting errors
   - Expected: `lint` check fails, blocks merge

3. **Type Errors:** Add TypeScript errors
   - Expected: `typecheck` check fails, blocks merge

4. **Test Failures:** Break existing tests
   - Expected: `test` check fails, blocks merge

#### Security Testing

1. **Vulnerable Dependencies:** Add known vulnerable package
   - Expected: Security scans fail, blocks merge

2. **Secret Exposure:** Commit fake secrets
   - Expected: Secret scanning alerts, review required

#### Deployment Testing

1. **Staging Success:** Clean merge triggers staging
   - Expected: Staging deploys successfully, tests pass

2. **Production Gates:** Attempt production deploy
   - Expected: Requires manual approval, uses staging results

### Troubleshooting Common Issues

#### Status Checks Not Appearing

```
Problem: Required status checks don't show in branch protection
Solution: Wait 5-10 minutes after workflows run, then refresh
```

#### Workflow Not Triggering

```
Problem: Workflows not running on PR
Solution: Check workflow triggers match branch names exactly
```

#### Deployment Failures

```
Problem: Vercel deployment fails
Solution: Check VERCEL_TOKEN secret is configured correctly
```

#### Validation Script Errors

```
Problem: Local validation scripts fail
Solution: Ensure all dependencies are installed and Node.js version matches
```

### Success Criteria

#### Infrastructure Health

- [ ] All workflows execute successfully
- [ ] Branch protection prevents unauthorized merges
- [ ] Security scanning blocks vulnerable code
- [ ] Deployment pipeline works end-to-end
- [ ] Validation scripts provide clear feedback

#### Developer Experience

- [ ] Clear error messages and guidance
- [ ] Reasonable wait times for CI checks
- [ ] Helpful documentation and troubleshooting
- [ ] No false positives in validation

#### Security Posture

- [ ] Zero bypassable security controls
- [ ] All code changes require review
- [ ] Security scans prevent vulnerable deployments
- [ ] Audit trail maintained for all changes

### Performance Benchmarks

#### CI Pipeline Performance

- **Total CI Time:** < 15 minutes
- **Individual Job Times:**
  - `lint`: < 2 minutes
  - `typecheck`: < 3 minutes
  - `test`: < 5 minutes
  - `build-admin`: < 4 minutes
  - `build-web`: < 2 minutes

#### Deployment Performance

- **Staging Deploy:** < 5 minutes
- **Production Deploy:** < 3 minutes (after approval)
- **Health Checks:** < 1 minute

### Continuous Monitoring

#### Daily Checks

- [ ] Workflow success rates (> 95%)
- [ ] Average CI completion times
- [ ] Security scan results (no critical vulnerabilities)

#### Weekly Reviews

- [ ] Branch protection effectiveness
- [ ] Deployment success rates
- [ ] User feedback on development experience

#### Monthly Audits

- [ ] Security control effectiveness
- [ ] Performance regression detection
- [ ] Infrastructure documentation updates

### Quick Test Commands

```bash
# Local validation
pnpm validate:workspace
pnpm validate:deps

# Branch protection check
pnpm verify:branch-protection

# Changeset testing
pnpm changeset:status

# Full CI simulation
pnpm typecheck && pnpm lint && pnpm test
```

**Remember:** Testing infrastructure is an ongoing process. Run these tests regularly to ensure continued reliability.

---

## Automation Boundaries

### Overview

This section clearly defines the boundaries between automated and manual processes in the RevealUI development workflow. Understanding these boundaries is crucial for realistic expectations and effective development practices.

### ✅ Automated Systems (Working)

#### 1. File Organization System

**Status:** ✅ Fully Automated
**Coverage:** ~30% of infrastructure

**What it handles:**

- Automatic analysis → plan → implementation → review promotion
- File lifecycle management with standardized naming
- Search and discovery across all documentation
- Cleanup of old files (configurable retention)

**Boundaries:**

- Requires analyses to have specific section headers
- Cannot create content, only organize existing files
- Manual intervention needed for complex merges

#### 2. Basic TypeScript Fixes

**Status:** ✅ Automated for Simple Cases
**Coverage:** Presentation package issues

**What it handles:**

- Adding `| undefined` to optional properties
- Simple type assertion fixes
- Component interface corrections

**Boundaries:**

- Cannot handle complex type inference issues
- Limited to pattern-based fixes
- Supabase integration issues require manual intervention

#### 3. Linting Fixes

**Status:** ✅ Mostly Automated
**Coverage:** Standard linting violations

**What it handles:**

- Unused import removal
- Code formatting fixes
- Standard rule violations

**Boundaries:**

- Complex refactoring beyond simple fixes
- Custom rule violations requiring judgment

### ❌ Manual Intervention Required

#### 1. Complex TypeScript Issues

**Status:** ❌ Manual Only
**Examples:**

- Supabase `never` type constraints
- Advanced generic type inference
- Complex schema type mismatches

**Why Manual:**

- Requires deep understanding of type relationships
- Pattern-based fixes insufficient
- Risk of breaking functionality too high

#### 2. Cursor IDE Integration

**Status:** ❌ Manual Investigation Required
**Issues:**

- Command registration not working
- IDE-specific integration challenges
- Undocumented requirements

**Why Manual:**

- Requires IDE-specific knowledge
- May involve Cursor configuration changes
- Platform-specific integration issues

#### 3. Advanced Validation Issues

**Status:** ❌ Manual for Complex Cases
**Examples:**

- Multi-package dependency conflicts
- Complex test environment issues
- Integration test failures

**Why Manual:**

- Requires understanding of system interactions
- Automated fixes may mask underlying issues
- Risk assessment needed for each case

#### 4. Architecture Decisions

**Status:** ❌ Manual Only
**Examples:**

- New feature design decisions
- API contract changes
- Database schema modifications

**Why Manual:**

- Requires business context and user impact assessment
- Cannot be automated without understanding requirements
- Involves stakeholder decisions

### 🔄 Hybrid Approaches (Automated + Manual Oversight)

#### 1. Validation Enforcement

**Current Status:** Attempts automation, blocks on failures
**Future Potential:** Smart failure analysis with suggested fixes

#### 2. Code Generation

**Current Status:** Provides guidance, requires manual implementation
**Future Potential:** Automatic application with human approval

#### 3. Testing

**Current Status:** Generates tests, requires manual validation
**Future Potential:** Automatic test execution with coverage analysis

### 📊 Automation Maturity Levels

#### Level 1: Basic Automation (Current)

- File organization ✅
- Simple fixes ✅
- Status tracking ✅
- Basic validation ✅

#### Level 2: Intermediate Automation (Next Target)

- Complex type fixes 🤔
- IDE integration 🤔
- Advanced validation 🤔
- Code generation 🤔

#### Level 3: Advanced Automation (Future)

- Architecture decisions 🤔
- Complex refactoring 🤔
- Multi-system integration 🤔
- AI-assisted development 🤔

### 🎯 Practical Guidelines

#### When to Use Automation

- ✅ File organization and search
- ✅ Simple code fixes and formatting
- ✅ Status tracking and reporting
- ✅ Basic validation checks

#### When to Use Manual Intervention

- ❌ Complex type errors
- ❌ IDE integration issues
- ❌ Architecture decisions
- ❌ High-risk changes

#### When to Combine Both

- 🤔 Complex fixes with automated suggestions
- 🤔 Code generation with manual review
- 🤔 Testing with automated execution

### 🚀 Improvement Roadmap

#### Phase 1: Stabilize Current Automation (Priority: High)

- Fix validation timeout issues
- Improve error handling in automated systems
- Add better logging and monitoring

#### Phase 2: Expand Automation Coverage (Priority: Medium)

- Enhance type fixing capabilities
- Improve IDE integration reliability
- Add more sophisticated validation

#### Phase 3: Advanced Automation (Priority: Low)

- AI-assisted code generation
- Automated refactoring
- Intelligent architecture suggestions

### 📋 Development Workflow Recommendations

#### For Automated Tasks

1. Use file organization system for documentation
2. Apply automated fixes where available
3. Run validation checks regularly
4. Monitor automated system health

#### For Manual Tasks

1. Clearly document manual intervention needs
2. Provide context for complex decisions
3. Create reproducible steps for fixes
4. Update automation boundaries as systems improve

#### For Hybrid Tasks

1. Use automation for initial analysis
2. Apply manual judgment for complex cases
3. Document learnings for future automation
4. Gradually expand automated coverage

### ⚠️ Important Warnings

#### Don't Over-Rely on Automation

- Automation works best for well-defined, repetitive tasks
- Complex problems often need human insight
- Automated systems can fail silently

#### Don't Under-Use Automation

- Many routine tasks are well-automated
- File organization provides real productivity gains
- Automated validation catches many issues early

#### Monitor and Maintain

- Automated systems need regular maintenance
- Monitor for failures and edge cases
- Update automation as codebase evolves

---

## Branch Protection

### Overview

Branch protection rules are **critical security controls** that prevent unauthorized code changes from reaching the main branch. Without these rules, all CI/CD security measures are bypassed.

### Critical Security Impact

**Without Branch Protection:**

- ❌ PRs can be merged without reviews
- ❌ Failing CI checks are ignored
- ❌ Security vulnerabilities bypass validation
- ❌ Code quality standards unenforced

**With Branch Protection:**

- ✅ All changes require code review
- ✅ CI/CD pipelines must pass
- ✅ Security scans block vulnerable code
- ✅ Quality gates enforced automatically

### Required Branch Protection Rules

#### Target Branch: `main`

#### Require Pull Request Reviews

```
Required approving reviews: 1
Dismiss stale pull request approvals: true
Require review from Code Owners: false
Restrict push access: true
Allow force pushes: false
Allow deletions: false
```

#### Require Status Checks

**Required status checks before merging:**

- `validate-config` (CI)
- `lint` (CI)
- `typecheck` (CI)
- `test` (CI)
- `security-scan` (CI)
- `docs-verification` (CI)
- `build-admin` (CI)
- `build-web` (CI)
- `validate-crdt` (CI)
- `integration-tests` (CI)
- `snyk-security` (Security Scanning)
- `secret-scanning` (Security Scanning)
- `dependency-review` (Security Scanning)
- `codeql-analysis` (Security Scanning)

#### Additional Settings

```
Require branches to be up to date: true
Restrict who can dismiss pull request reviews: [Repository administrators only]
Include administrators: true
```

### Implementation Steps

#### Option 1: GitHub UI Configuration (Recommended)

1. **Navigate to Repository Settings:**
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Click "Branches" in left sidebar

2. **Add Branch Protection Rule:**
   - Click "Add rule" button
   - Enter `main` in "Branch name pattern"
   - Configure the settings as specified above

3. **Status Check Configuration:**
   - In the "Require status checks to pass" section
   - Add each required check from the list above
   - Ensure "Require branches to be up to date" is checked

#### Option 2: GitHub CLI Configuration

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Set branch protection rules
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input - << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-config",
      "lint",
      "typecheck",
      "test",
      "security-scan",
      "docs-verification",
      "build-admin",
      "build-web",
      "validate-crdt",
      "integration-tests",
      "snyk-security",
      "secret-scanning",
      "dependency-review",
      "codeql-analysis"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "dismissal_restrictions": {
      "users": [],
      "teams": []
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
EOF
```

### Verification Steps

#### Manual Verification

1. **Create a test PR** to the main branch
2. **Verify required checks** are running
3. **Attempt to merge without approval** - should be blocked
4. **Attempt to merge with failing checks** - should be blocked

#### Automated Verification Script

```bash
#!/usr/bin/env node
// scripts/verify-branch-protection.mjs

import { execSync } from 'child_process';

const REPO = process.env.GITHUB_REPOSITORY || 'RevealUIStudio/revealui';
const BRANCH = 'main';

console.log(`🔍 Verifying branch protection for ${REPO}:${BRANCH}\n`);

try {
  // Get branch protection rules
  const cmd = `gh api repos/${REPO}/branches/${BRANCH}/protection`;
  const protection = JSON.parse(execSync(cmd, { encoding: 'utf8' }));

  console.log('✅ Branch protection is enabled\n');

  // Check required status checks
  const requiredChecks = protection.required_status_checks?.contexts || [];
  console.log(`📋 Required status checks (${requiredChecks.length}):`);
  requiredChecks.forEach(check => console.log(`   • ${check}`));

  // Verify critical checks are present
  const criticalChecks = [
    'validate-config', 'lint', 'typecheck', 'test',
    'security-scan', 'build-admin', 'build-web'
  ];

  const missingChecks = criticalChecks.filter(check =>
    !requiredChecks.includes(check)
  );

  if (missingChecks.length > 0) {
    console.error(`❌ Missing critical checks: ${missingChecks.join(', ')}`);
    process.exit(1);
  }

  // Check PR review requirements
  const reviews = protection.required_pull_request_reviews;
  if (reviews?.required_approving_review_count >= 1) {
    console.log(`✅ PR reviews required: ${reviews.required_approving_review_count}`);
  } else {
    console.error('❌ PR reviews not properly configured');
    process.exit(1);
  }

  // Check admin enforcement
  if (protection.enforce_admins?.enabled) {
    console.log('✅ Admin enforcement enabled');
  } else {
    console.warn('⚠️ Admin enforcement not enabled');
  }

  console.log('\n🎉 Branch protection verification passed!');

} catch (error) {
  console.error(`❌ Branch protection verification failed: ${error.message}`);
  console.error('\nTo fix: Configure branch protection rules in repository settings');
  process.exit(1);
}
```

### Required Status Checks Explained

#### CI Pipeline Checks

- **`validate-config`**: Ensures environment configuration is valid
- **`lint`**: Code style and quality validation
- **`typecheck`**: TypeScript compilation verification
- **`test`**: Unit test execution and coverage
- **`security-scan`**: Dependency vulnerability scanning
- **`docs-verification`**: Documentation validation
- **`build-admin`**: Next.js admin application build
- **`build-web`**: Vite web application build
- **`validate-crdt`**: Database schema validation
- **`integration-tests`**: End-to-end integration testing

#### Security Scanning Checks

- **`snyk-security`**: Snyk vulnerability scanning
- **`secret-scanning`**: GitLeaks secret detection
- **`dependency-review`**: GitHub dependency review
- **`codeql-analysis`**: GitHub CodeQL security analysis

### Troubleshooting

#### Status Checks Not Appearing

**Problem:** Required status checks don't show up in branch protection settings

**Solutions:**

1. **Wait for workflow runs**: Status checks only appear after workflows have run
2. **Check workflow names**: Ensure job names match exactly in branch protection
3. **Verify workflow triggers**: Ensure workflows run on pull requests to main

#### PR Reviews Being Dismissed

**Problem:** Reviews are dismissed when new commits are pushed

**Solution:** This is expected behavior with "Dismiss stale reviews" enabled. Re-request review after addressing feedback.

#### Administrators Can't Merge

**Problem:** Repository admins can't merge their own PRs

**Solution:** This is expected with "Include administrators" enabled. Require another admin or team member to review.

### Advanced Configuration

#### Code Owners Integration

```yaml
# .github/CODEOWNERS
# Require code owner reviews for specific paths
packages/core/ @core-team
packages/security/ @security-team
```

#### Branch Protection for Other Branches

Consider protecting `test` branch with similar rules:

- Fewer required reviews (1 instead of 2)
- Same status checks
- Allow force pushes for maintainers

#### Status Check Customization

For complex repositories, consider:

- **Separate check suites** for different types of validation
- **Conditional checks** based on changed files
- **External status checks** from third-party services

### Security Benefits

#### Attack Vector Mitigation

- **Prevents unauthorized merges** without review
- **Blocks vulnerable code** through security scanning
- **Enforces quality standards** automatically
- **Maintains audit trail** of all changes

#### Compliance Benefits

- **SOX/HIPAA**: Change approval requirements
- **GDPR**: Data protection through security scanning
- **Industry Standards**: CIS, NIST security controls

### Monitoring & Maintenance

#### Regular Audits

- **Monthly**: Review branch protection effectiveness
- **Quarterly**: Update required status checks for new workflows
- **After incidents**: Verify controls prevented similar issues

#### Metrics to Track

- **PR merge success rate**: Should be high with proper reviews
- **Time to merge**: Should balance speed vs. quality
- **Security incidents prevented**: Track vulnerabilities caught by scans

### Emergency Procedures

#### Temporary Bypass (Rare)

In extreme circumstances, administrators can temporarily disable branch protection, but this should:

1. Be logged with justification
2. Be re-enabled immediately after
3. Trigger additional security review

#### Alternative Merge Strategies

- **Squash merges**: Clean history, easier to revert
- **Rebase merges**: Linear history, preserves context
- **Merge commits**: Full history preservation

### Support

For branch protection issues:

1. Check repository settings → Branches
2. Verify workflow status in Actions tab
3. Review PR checks and required statuses
4. Contact repository administrators

---

# Cohesion Engine

Automated cohesion analysis and cleanup system for RevealUI Framework.

## Cohesion Overview

The Cohesion Engine provides:

1. **Analysis** - Detects cohesion issues (patterns, metrics, type safety)
2. **Assessment** - Generates brutally honest assessment documents
3. **Fixes** - Automatically fixes issues (Phase 3 - minimal structure)

## Status

- ✅ **Phase 1: Analysis Engine** - Complete
- ✅ **Phase 2: Assessment Generation** - Complete
- ⚠️ **Phase 3: Automated Cleanup** - Minimal structure (pending full implementation)
- ⏳ **Phase 4: Rev Integration** - Pending

## Cohesion Usage

### Analyze Codebase

```bash
pnpm cohesion:analyze
```

Scans the codebase for cohesion issues and generates analysis results in `.cursor/cohesion-analysis.json`.

### Generate Assessment

```bash
pnpm cohesion:assess
```

Generates a brutally honest assessment document from analysis results. Output: `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md`

### Apply Fixes (Phase 3 - Limited)

```bash
# Dry run (show what would be fixed)
pnpm cohesion:fix --dry-run

# Apply fixes for specific issue type
pnpm cohesion:fix --fix-type=type-assertion-any

# Apply fixes (WARNING: Not fully implemented yet)
pnpm cohesion:fix
```

**Note**: Automated fixes are not yet fully implemented. The fix command currently shows what would be fixed but doesn't apply changes.

## Cohesion Architecture

```
scripts/cohesion/
├── analyze.ts          # Analysis command
├── assess.ts           # Assessment generation command
├── fix.ts              # Automated fix command (Phase 3)
├── types.ts            # TypeScript types
└── utils/
    ├── patterns.ts     # Pattern detection
    ├── metrics.ts      # Metrics generation
    ├── extraction.ts   # Code extraction
    ├── templates.ts    # Assessment templates
    └── fixes.ts        # Fix strategies (Phase 3)
```

## Patterns Detected

The engine detects:

1. **Config Import Pattern** - Duplicate `import config from '@revealui/config'`
2. **getRevealUI Calls** - Duplicate `getRevealUI({ config })` patterns
3. **Type Assertions** - `as any` and `as unknown` usage
4. **Unscoped Imports** - `revealui/` instead of `@revealui/`
5. **Direct Path Imports** - Workaround imports (`../../packages/...`)

## Assessment Output

The assessment document includes:

- Executive summary with overall grade
- Quantitative evidence (file counts, percentages)
- Critical developer friction points
- Cohesion gaps by severity
- Overall assessment (Would I Use This?)
- Required fixes (prioritized)
- Success metrics

## Future Work

### Phase 3: Automated Cleanup (Full Implementation)

- Type assertion removal
- Import standardization
- Pattern extraction (create utilities)
- Configuration fixes

### Phase 4: Rev Integration

- Iterative improvement workflow
- Progress tracking
- Incremental fixes
- Completion detection

## Development

To extend the engine:

1. **Add Pattern Detection**: Update `utils/patterns.ts` with new pattern matchers
2. **Add Fix Strategy**: Implement fix strategy in `utils/fixes.ts`
3. **Update Templates**: Modify assessment template in `utils/templates.ts`

---

# Integrations

Comprehensive guide to AI agents, development tools, and quality systems integrated with RevealUI Framework.

## Claude Code Integration

This guide explains how to connect **Claude Code** (Anthropic's agentic CLI) to your **Antigravity** IDE and leverage the existing project infrastructure.

### Overview

RevealUI is built with extensive AI-agent infrastructure. You can interact with it through Anthropic's Claude Code CLI while working in the Antigravity IDE.

#### Integration Options

1. **Direct CLI Usage**: Run `claude` directly in Antigravity's integrated terminal.
2. **IDE Extension**: Use the official Claude Extension inside Antigravity (VS Code based).
3. **MCP Sharing**: Use RevealUI's pre-configured MCP servers in both environments.
4. **Agent Skills**: Use the `pnpm skills` CLI to manage agent capabilities.

### Option 1: Claude Code CLI (Recommended)

Running Claude Code in Antigravity's terminal gives the agent full access to your environment, build tools, and local servers.

#### Setup

1. **Install Claude Code globally**:

   ```bash
   pnpm add -g @anthropic-ai/claude-code
   ```

2. **Verify Configuration**:
   The project already contains a `.claude/` directory with `settings.local.json` which defines allowed permissions for the agent (e.g., `pnpm test`, `git`, etc.).

3. **Launch from Root**:
   Open the terminal in Antigravity and run:
   ```bash
   claude
   ```

### Option 2: MCP Integration

RevealUI includes several **Model Context Protocol (MCP)** servers that provide agents with "real-world" tools like database access and service management.

#### Shared MCP Servers

The project is configured to use:

- **Vercel MCP**: Manage deployments and storage.
- **Stripe MCP**: Manage payments and products.
- **Neon/Supabase MCP**: Query your production/dev databases.
- **Next.js DevTools MCP**: Inspect your application state.

#### Using MCP with Claude Code

Claude Code automatically looks for MCP configurations. If you are running the `pnpm dev` command, the local MCP servers are typically started automatically.

See `docs/mcp/MCP_SETUP.md` for detailed server configuration.

### Option 3: Agent Skills System

The RevealUI Framework includes a custom **Skills System** for agents. This allows you to "teach" Claude new capabilities by installing skills.

#### Skills CLI

Use the `pnpm skills` command in the Antigravity terminal:

```bash
pnpm skills list        # List installed skills
pnpm skills add <repo>  # Install a specific skill
pnpm skills info <name> # See what an agent can do with this skill
```

Skills typically include customized instructions (in `SKILL.md`) and specialized scripts that Claude can execute.

### Option 4: Antigravity-Claude Proxy

If you want to use Antigravity's models (like Gemini 2.0 Pro) _inside_ the Claude Code CLI, you can use the community-built proxy.

1. **Install the proxy**:

   ```bash
   pnpm add -g antigravity-claude-proxy
   ```

2. **Configure Claude Code** to point to the local proxy endpoint.

3. This allows you to leverage Antigravity's generous quotas while using Claude's agentic interface.

---

## Rev Workflow System

Rev is an iterative workflow system that integrates with the Cohesion Engine for automated codebase improvements.

### Overview

Rev provides:

- **Iterative Workflow**: Run cohesion analysis, assessment, and fixes as part of Rev iterations
- **Stage Tracking**: Tracks progress through analyze → assess → fix → complete stages
- **Status Reporting**: View current workflow status and progress
- **Integration**: Seamlessly integrates with existing Rev workflow commands

### Status

**Status**: ✅ **Complete**

Phase 4 integrates the Cohesion Engine with the Rev loop workflow system, enabling automated cohesion improvement as part of iterative development workflows.

### Usage

#### Start a Cohesion Workflow

```bash
# Start Rev workflow with cohesion engine
pnpm rev:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow as iteration
pnpm cohesion:rev workflow
```

#### Check Status

```bash
# Check cohesion workflow status
pnpm cohesion:rev status

# Check Rev workflow status (includes cohesion)
pnpm rev:status
```

#### Continue Workflow

```bash
# Continue Rev workflow (cohesion engine will continue from last stage)
pnpm rev:continue
```

### Workflow Stages

The cohesion workflow runs through these stages automatically:

1. **Analyze** - Run `pnpm cohesion:analyze`
   - Scans codebase for cohesion issues
   - Generates analysis JSON
   - Records grade and issue count

2. **Assess** - Run `pnpm cohesion:assess`
   - Generates brutally honest assessment document
   - Creates `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md`

3. **Fix (Dry Run)** - Run `pnpm cohesion:fix --dry-run`
   - Shows what fixes would be applied
   - Requires manual review before applying

4. **Complete** - All stages finished
   - Ready for next iteration or completion

### State Management

Cohesion workflow state is stored in:

- `.cursor/cohesion-rev-state.json` - Cohesion-specific state
- `.cursor/rev-state.md` - Rev workflow state (iteration tracking)

### Integration Points

- **Rev Workflow**: Uses Rev's iteration tracking and completion detection
- **Cohesion Commands**: Calls `cohesion:analyze`, `cohesion:assess`, `cohesion:fix` as needed
- **Progress Tracking**: Stores stage completion and metrics in separate state file

### Example Workflow

```bash
# 1. Start Rev workflow
pnpm rev:start "Improve cohesion" --completion-promise "DONE"

# 2. Run cohesion workflow (first iteration)
pnpm cohesion:rev workflow
# → Runs analysis stage

# 3. Continue (next iteration)
pnpm cohesion:rev workflow
# → Runs assessment stage

# 4. Continue (next iteration)
pnpm cohesion:rev workflow
# → Runs fix dry-run stage

# 5. Review fixes, then apply manually if needed
pnpm cohesion:fix  # Remove --dry-run to apply

# 6. Mark complete
echo "DONE" > .cursor/rev-complete.marker

# 7. Continue to completion
pnpm rev:continue
```

### Commands

#### `pnpm cohesion:rev workflow`

Runs the cohesion workflow as a Rev iteration. Automatically progresses through stages:

- Runs analysis if not complete
- Runs assessment if analysis complete
- Runs fixes (dry-run) if assessment complete

#### `pnpm cohesion:rev status`

Shows current cohesion workflow status:

- Current stage
- Iteration number
- Stage completion status
- Grade and metrics

### State File Format

`.cursor/cohesion-rev-state.json`:

```json
{
  "stage": "assess",
  "analysis_complete": true,
  "assessment_complete": false,
  "fixes_applied": false,
  "last_grade": "D+ (Functional but Painful)",
  "issues_found": 5,
  "fixes_applied_count": 0
}
```

### Completion Detection

The cohesion workflow respects Rev's completion promise mechanism:

- If completion marker matches promise, workflow completes
- State is saved and workflow can be continued later
- All stages are idempotent (safe to re-run)

### Error Handling

- Analysis failures are caught and reported
- Assessment failures are caught and reported
- Fix failures are caught and reported
- State is preserved between iterations
- Workflow can be resumed after errors

---

## Brutal Honesty System

Automatic assessment validation and enhancement system that ensures brutally honest code quality reports.

### Overview

**Status**: ✅ **Built into Rev Workflow System**

Brutal honesty is now **built into** the Rev workflow system and cohesion engine by default. You no longer need to explicitly request "brutal honesty" - it's automatic.

### How It Works

#### 1. Automatic Prompt Enhancement

When you start a Rev workflow, brutal honesty requirements are automatically added to the prompt:

```bash
pnpm rev:start "Assess codebase cohesion"
# Automatically includes brutal honesty requirements
```

**What Gets Added**:

- Brutal honesty criteria (blunt language, quantitative evidence, code examples)
- Explicit requirements (no euphemisms, realistic grades)
- Validation notice (assessment will be checked)

**To Disable** (not recommended):

```bash
pnpm rev:start "Assess codebase" --no-brutal-honesty
```

#### 2. Automatic Assessment Validation

When assessments are generated, they're automatically validated for brutal honesty:

```bash
pnpm cohesion:assess
# Automatically validates brutal honesty score
# Enhances if needed
```

**Validation Checks**:

- ✅ Uses blunt, direct language (not euphemisms)
- ✅ Includes quantitative evidence (numbers, percentages)
- ✅ Includes code examples (file:line references)
- ✅ Identifies root causes (explains WHY)
- ✅ Uses severity ratings (CRITICAL/HIGH/MEDIUM/LOW)
- ✅ Provides honest grade (not inflated)
- ✅ Includes "Would I Use This" assessment

**Scoring**:

- **70+ points**: Passes brutal honesty validation
- **< 70 points**: Automatically enhanced, warnings shown

#### 3. Automatic Enhancement

If an assessment doesn't meet brutal honesty standards, it's automatically enhanced:

- Adds missing required phrases ("Bottom Line", "Would I Use This")
- Replaces euphemisms with direct language
- Adds missing sections

### Validation Criteria

#### Required Elements (Score: 0-100)

1. **Blunt Language** (15 points)
   - Uses words like "painful", "frustrating", "broken"
   - Avoids euphemisms like "needs improvement"

2. **Quantitative Evidence** (15 points)
   - Includes specific numbers (file counts, percentages)
   - Not vague like "some" or "many"

3. **Code Examples** (15 points)
   - Shows file:line references
   - Includes actual code snippets

4. **Root Cause Analysis** (10 points)
   - Explains WHY issues exist
   - Not just WHAT they are

5. **Avoids Euphemisms** (15 points)
   - No "could be improved" or "needs work"
   - Direct, honest language

6. **Severity Ratings** (10 points)
   - Uses CRITICAL/HIGH/MEDIUM/LOW
   - Not just "issues"

7. **Honest Grade** (10 points)
   - Realistic grade (D+, C-, etc.)
   - Not inflated

8. **"Would I Use This"** (10 points)
   - Honest assessment of production readiness
   - Clear recommendation

### Usage Examples

#### Cohesion Assessment (Automatic)

```bash
# Start Rev workflow for cohesion improvement
pnpm rev:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow
pnpm cohesion:rev workflow
# → Automatically includes brutal honesty
# → Validates assessments
# → Enhances if needed
```

#### Direct Assessment (Automatic)

```bash
# Generate assessment
pnpm cohesion:assess
# → Automatically validates brutal honesty
# → Shows score and violations
# → Enhances if needed
```

#### Manual Rev Workflow (Automatic)

```bash
# Start any workflow
pnpm rev:start "Refactor authentication system"
# → Automatically includes brutal honesty requirements in prompt
# → Agent will use brutal honesty by default
```

### What Gets Validated

#### Assessment Text

- Language patterns (blunt vs. euphemistic)
- Quantitative evidence presence
- Code example presence
- Required phrases ("Bottom Line", "Would I Use This")
- Severity ratings
- Grade presence

#### Analysis Results

- Grade inflation (A/B with critical issues = inflated)
- Missing severity ratings
- Missing evidence

### Output Examples

#### Passed Validation

```
✅ Brutal honesty validation passed (85/100)
```

#### Failed Validation (Auto-Enhanced)

```
⚠️  Brutal honesty score: 45/100
⚠️  Violations: 4
ℹ️  Enhancing assessment with brutal honesty...
  - Added "Bottom Line" section to executive summary
  - Replaced euphemism with blunt language
✅ Assessment now meets brutal honesty standards
```

#### Failed Validation (Needs Manual Review)

```
⚠️  Assessment still needs improvement. Score: 65/100. Suggestions:
  - Use words like "painful", "frustrating", "broken" instead of euphemisms
  - Include specific numbers (file counts, percentages, line numbers)
  - Include "Would I Use This" assessment
```

### Configuration

#### Enable/Disable Brutal Honesty

**Default**: Enabled for all workflows

**Disable for specific workflow**:

```bash
pnpm rev:start "Assess codebase" --no-brutal-honesty
```

**Check if enabled**:

- Look for "Brutal honesty mode enabled" message when starting workflow

### Benefits

1. **No More Asking** - Brutal honesty is automatic
2. **Consistent Quality** - All assessments meet standards
3. **Automatic Enhancement** - Fixes violations automatically
4. **Clear Validation** - Shows score and violations
5. **Built-in Enforcement** - Can't skip brutal honesty

### Technical Details

#### Files

- `scripts/cohesion/utils/brutal-honesty.ts` - Validation and enhancement logic
- `scripts/cohesion/assess.ts` - Automatic validation on generation
- `scripts/cohesion/rev.ts` - Validation in Rev workflow
- `scripts/workflows/start.ts` - Automatic prompt enhancement

#### Functions

- `validateBrutalHonesty()` - Validates assessment text
- `enhanceWithBrutalHonesty()` - Enhances assessment if needed
- `generateBrutalHonestyPromptPrefix()` - Adds requirements to prompts
- `validateAnalysisForBrutalHonesty()` - Validates analysis results

### Future Enhancements

1. **Custom Rules** - Allow custom brutal honesty criteria
2. **Score Thresholds** - Configurable minimum scores
3. **Domain-Specific Rules** - Different rules for different domains
4. **Learning Mode** - Learn from manual corrections

---

## Integration Architecture

### System Overview

The integration architecture consists of three main components working together:

1. **Claude Code CLI** - Provides agentic AI interaction
2. **Rev Workflow System** - Manages iterative development workflows
3. **Brutal Honesty System** - Ensures quality assessment standards

### Data Flow

```
User Command
    ↓
Claude Code CLI / Rev Workflow
    ↓
Cohesion Analysis Engine
    ↓
Brutal Honesty Validation
    ↓
Assessment Enhancement (if needed)
    ↓
Automated Fixes (optional)
    ↓
State Persistence
```

### State Management

**Location**: `.cursor/` directory

**Files**:

- `cohesion-analysis.json` - Analysis results
- `cohesion-rev-state.json` - Rev workflow state
- `rev-state.md` - Iteration tracking
- `mcp-config.json` - MCP server configuration

### Integration Points

1. **Agent → Cohesion Engine**
   - Triggers analysis commands
   - Reads assessment results
   - Applies fixes

2. **Cohesion Engine → Brutal Honesty**
   - Validates assessments
   - Enhances content
   - Scores quality

3. **Rev → Both Systems**
   - Tracks iterations
   - Manages stages
   - Detects completion

### MCP Server Integration

All integrations can leverage the configured MCP servers:

- **Vercel MCP**: Deployment integration
- **Stripe MCP**: Payment processing
- **Neon/Supabase MCP**: Database operations
- **Playwright MCP**: Test automation
- **Next.js DevTools MCP**: Debug tooling

---

## Related Documentation

### AI Agents

- [Agent Quick Start Guide](#quick-start-for-agents)
- [MCP Setup Guide](../mcp/MCP_SETUP.md)
- [Project Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md)

### Automation

- [Deployment Runbook](./CI_CD_GUIDE.md)
- [CI/CD Guide](./CI_CD_GUIDE.md)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md)

### Cohesion & Quality

- `scripts/cohesion/` - Implementation files

**Last Updated**: March 2026
