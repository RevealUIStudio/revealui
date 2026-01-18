# Agent Capabilities Specific to RevealUI Codebase

This document outlines all the capacities and behaviors that arise from using the Cursor agent window with the RevealUI codebase specifically, compared to working with a generic codebase.

## Table of Contents

1. [Mandatory Rules & Policies](#mandatory-rules--policies)
2. [Specialized Agents](#specialized-agents)
3. [Workflows & Automation](#workflows--automation)
4. [MCP (Model Context Protocol) Integration](#mcp-model-context-protocol-integration)
5. [Codebase-Specific Tooling](#codebase-specific-tooling)
6. [Architecture Awareness](#architecture-awareness)
7. [Code Quality Enforcement](#code-quality-enforcement)
8. [Documentation Management](#documentation-management)
9. [Testing Infrastructure](#testing-infrastructure)
10. [Cohesion Analysis](#cohesion-analysis)

---

## Mandatory Rules & Policies

### Legacy Code Removal Policy (TOP PRIORITY)

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

**Files**: `.cursor/AGENT-RULES.md`, `.cursor/LEGACY-CODE-REMOVAL-POLICY.md`

### Framework-Specific Conventions

The agent enforces these RevealUI-specific conventions:

- **No GraphQL**: Uses REST APIs and RPC exclusively (GraphQL is forbidden)
- **Package Manager**: Always use `pnpm dlx` instead of `npx` (except preinstall hooks)
- **Module System**: ESM (`import`/`export`) only - NO CommonJS
- **Next.js 16**: Aware that `params` and `searchParams` are Promises (must await)
- **TypeScript**: Strict mode, no `as any`, prefer explicit types
- **Biome Formatting**: Single quotes for strings, double quotes for JSX, no unnecessary semicolons

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

### 3. CMS Agent (`.cursor/agents/cms.md`)
- RevealUI CMS collections, hooks, and access control patterns
- Collection configuration patterns
- Admin interface patterns

### 4. TypeScript Agent (`.cursor/agents/typescript.md`)
- Type checking and fixes specific to RevealUI's type system
- Aware of framework-specific types (`Config`, `CollectionConfig`)
- Type generation workflows

### 5. Testing Agent (`.cursor/agents/testing.md`)
- Vitest and Playwright patterns
- Framework-specific test utilities from `@revealui/test`

**Usage**: Reference agents in chat: "Use the CMS agent to help with..." or "Apply the TypeScript agent for..."

---

## Workflows & Automation

### Step-by-Step Workflows

Predefined workflows for common tasks:

1. **analyze-console-errors.md** - Browser console error analysis using MCP (⚠️ Experimental)
2. **new-component.md** - Component creation workflow
3. **ralph-iterative-workflow.md** - Iterative development patterns

### Automation Scripts

The agent has access to extensive automation scripts in `/scripts`:

- **Analysis**: Code quality analysis, type migration, performance measurement
- **Audit**: Console usage auditing, type safety checking
- **Cohesion**: Code cohesion analysis and pattern detection
- **Database**: Reset, migration, seeding operations
- **Documentation**: Lifecycle management, stale doc detection, API doc generation
- **Validation**: Pre-launch validation, package verification, security testing

**Command Examples**:
- `pnpm audit:console` - Audit console usage
- `tsx scripts/docs/detect-stale-docs.ts` - Find stale documentation
- `tsx scripts/analysis/analyze-code-quality.ts` - Analyze code quality patterns

---

## MCP (Model Context Protocol) Integration

### Configured MCP Servers

The agent has access to **6 MCP servers** configured specifically for RevealUI:

1. **Vercel MCP** (`mcp-vercel`)
   - Deployment management
   - Project configuration
   - Environment variable access

2. **Stripe MCP** (`mcp-stripe`)
   - Payment processing
   - Customer management
   - Webhook handling

3. **Neon MCP** (`mcp-neon`)
   - Database management
   - Connection testing
   - Migration tools

4. **Supabase MCP** (`mcp-supabase`)
   - Supabase project management
   - Auth configuration
   - Database operations

5. **Playwright MCP** (`mcp-playwright`)
   - E2E testing automation
   - Browser automation
   - Test execution

6. **Next.js DevTools MCP** (`mcp-next-devtools`)
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

## Codebase-Specific Tooling

### Scaffold Commands

**Page Scaffolding** (`.cursor/commands/scaffold-page.ts`):
- Generate new pages with templates (landing, dashboard, profile, settings)
- Automatically include MCP integration hooks
- Generate TypeScript types for new pages
- Command: `pnpm scaffold:page --name="Dashboard" --route="/dashboard"`

### Type Generation Scripts

- **RevealUI Types**: `pnpm generate:revealui-types` - Generate CMS types
- **Supabase Types**: `pnpm generate:supabase-types` - Generate Supabase types
- **Neon Types**: `pnpm generate:neon-types` - Generate database types
- **OpenAPI Spec**: `pnpm generate:openapi` - Generate API documentation

### Cohesion Analysis

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

---

## Architecture Awareness

### Monorepo Structure

The agent understands the **pnpm workspace structure**:

```
apps/
  ├── cms/        # Next.js 16 + @revealui/core application
  └── web/        # RevealUI + React application

packages/
  ├── core/       # Core CMS framework (@revealui/core)
  ├── db/         # Drizzle ORM schemas (@revealui/db)
  ├── config/     # Configuration management (@revealui/config)
  ├── services/   # Shared services (Stripe, Supabase)
  ├── dev/        # Development tooling
  ├── test/       # Test utilities
  └── ai/         # AI memory and agent context management
```

### Import Path Awareness

The agent enforces correct import paths:
- `@/lib/*` - CMS app imports
- `@revealui/core` - CMS framework imports
- `@revealui/db` - Database imports
- `@revealui/config` - Configuration imports
- `revealui/*` vs `@revealui/*` - Scoped vs unscoped (agent knows both exist)

### Framework-Specific Patterns

- **CMS Initialization**: `getRevealUI({ config })` pattern
- **Collection Access**: Aware of collection hooks and access control
- **Admin Interface**: Understands admin layout and routing patterns
- **Block Rendering**: Knows `RenderBlocks` and block normalization patterns

---

## Code Quality Enforcement

### Automated Quality Checks

The agent runs quality checks via scripts:

1. **Console Auditing**: `scripts/audit/audit-console-usage.ts`
2. **Type Safety**: `scripts/audit/audit-any-types.ts`
3. **Code Quality**: `scripts/analysis/analyze-code-quality.ts`

### Validation Scripts

Pre-launch and continuous validation:
- `scripts/validation/pre-launch-validation.ts`
- `scripts/validation/run-automated-validation.ts`
- `scripts/validation/check-console-statements.ts`

### Build & Test Awareness

The agent knows:
- **Turbopack** is preferred over Webpack for Next.js builds
- Test locations: `*.test.ts` or `*.spec.ts` next to source files
- Coverage reporting via `pnpm test:coverage`
- Type checking: `pnpm typecheck:all`

---

## Documentation Management

### Lifecycle Management

**File**: `scripts/docs/detect-stale-docs.ts`, `scripts/docs/docs-lifecycle.ts`

The agent can:
- Detect stale documentation
- Manage assessment documents
- Archive old documentation
- Consolidate duplicate docs

**Commands**:
- `tsx scripts/docs/detect-stale-docs.ts`
- `tsx scripts/docs/manage-assessments.ts`

### Documentation Scripts

- **API Docs**: Generate from code comments
- **Package READMEs**: Auto-generate package documentation
- **JSDoc Coverage**: Measure documentation completeness
- **Validation**: Verify documentation quality

---

## Testing Infrastructure

### Test Utilities Package

The agent knows about `@revealui/test` package with:
- Integration test utilities
- Database test setup/teardown
- Auth testing helpers
- Performance baseline tools

### Test Scripts

Located in `/scripts/test/`:
- `auth-direct-test.ts` - Direct auth testing
- `auth-e2e-test.ts` - End-to-end auth flows
- `performance-baseline.ts` - Performance benchmarking
- `setup-test-database.ts` - Test database initialization

### Test Configuration

The agent is aware of:
- Vitest configuration for unit tests
- Playwright configuration for E2E tests
- Test database setup patterns
- Integration test workflows

---

## Cohesion Analysis

### Pattern Detection

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

---

## Environment Configuration

### Environment Variables

The agent knows:
- `.env` files are **tracked in git** (production values in CI/CD)
- Required variables: `REVEALUI_SECRET`, `REVEALUI_PUBLIC_SERVER_URL`
- Database: `POSTGRES_URL` (SQLite fallback when unavailable)
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Vercel: `VERCEL_API_KEY`, `VERCEL_TOKEN`

**Note**: Environment files are **included in Cursor context** (not in `.cursorignore`) to help with configuration assistance, while sensitive values remain in CI/CD.

---

## Development Workflow

### Automation Scripts

**File**: `scripts/automation/auto-start-dev.ts`

The agent understands the development workflow:
- `pnpm dev` runs pre-hook automation before starting servers
- `pnpm dev:no-automation` bypasses automation
- Background server execution patterns
- **Never pipes dev server output** through `head`/`tail` (runs continuously)

### Build Commands

- `pnpm build` - Build all packages (uses Vercel build)
- `pnpm build:packages` - Build publishable packages only
- `pnpm typecheck:all` - Type check entire monorepo
- `pnpm lint` - Lint all packages (concurrency: 15)
- `pnpm test` - Run all tests (concurrency: 15)

---

## Summary

### Unique Capabilities vs Generic Codebase

1. **Mandatory Legacy Removal**: Top-priority enforcement not present in generic codebases
2. **Specialized Agents**: Task-specific AI behaviors (CMS, Next.js, TypeScript)
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
- **Type Generation**: Automatically generates types from CMS/database schemas
- **Quality Focus**: Runs validation and auditing as part of development workflow

---

**Last Updated**: January 2026  
**Related Files**:
- `.cursor/AGENT-RULES.md`
- `.cursor/LEGACY-CODE-REMOVAL-POLICY.md`
- `.cursor/README.md`
- `.cursor/rules.md`
- `.cursor/config.json`
- `.cursor/cohesion-analysis.json`
