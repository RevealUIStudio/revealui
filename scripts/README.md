# Scripts Directory

This directory contains all project scripts, organized by category for better maintainability and cross-platform compatibility.

## Organization

Scripts are organized into the following directories:

### 📁 `database/`
Database-related scripts:
- `run-migration.ts` - Run database migrations
- `setup-test-db.ts` - Setup test database with Docker
- `setup-test-db-simple.ts` - Simple test database setup (direct SQL)
- `init-database.ts` - Initialize database
- `seed-sample-content.ts` - Seed database with sample content
- `reset-database.ts` - Reset database (drops all tables)

### 📁 `validation/`
Validation and quality check scripts:
- `pre-launch-validation.ts` - Comprehensive pre-launch checks
- `check-console-statements.ts` - Check for console statements in production code
- `validate-package-scripts.ts` - Validate package.json scripts
- `validate-automation.ts` - Validate automation scripts configuration
- `validate-production.ts` - Validate production deployment against Neon
- `security-test.ts` - Security testing suite
- `test-api-routes.ts` - Test all memory API routes
- `run-automated-validation.ts` - Automated validation workflow
- `verify-services-runtime.ts` - Verify service runtime
- `verify-services-cms-types.ts` - Verify CMS types
- `test-nextjs-mcp-endpoint.ts` - Test Next.js MCP endpoint

### 📁 `setup/`
Setup and configuration scripts:
- `setup-env.js` - Interactive environment setup wizard
- `validate-env.js` - Validate environment variables
- `setup-mcp.ts` - Setup MCP servers
- `install-clean.ts` - Clean install with deprecation warnings suppressed
- `setup-docker-wsl2.ts` - Docker Engine setup for WSL2 (Linux-specific)
- `sync-env-to-dev-local.ts` - Sync environment variables to dev-local

### 📁 `mcp/`
Model Context Protocol (MCP) server scripts:
- `mcp-vercel.ts` - Vercel MCP server
- `mcp-stripe.ts` - Stripe MCP server
- `mcp-neon.ts` - Neon MCP server
- `mcp-supabase.ts` - Supabase MCP server
- `mcp-playwright.ts` - Playwright MCP server

### 📁 `dev/`
Development workflow scripts:
- `dev.ts` - Start development environment
- `build.ts` - Build system
- `fix-node16-imports.ts` - Fix Node16 module resolution by adding .js extensions
- `deploy.ts` - Deployment scripts

### 📁 `analysis/`
Code analysis scripts:
- `analyze-code-quality.ts` - Analyze code quality
- `analyze-types.ts` - Analyze TypeScript types
- `migrate-types.ts` - Migrate types
- `measure-performance.js` - Performance measurement

### 📁 `deployment/`
Deployment-related scripts:
- `archive-assessments.ts` - Archive assessment/execution files

### 📁 `verification/`
Verification and testing scripts:
- `check-circular-deps.ts` - Check for circular dependencies
- `test-crud-operations.ts` - Test CRUD operations
- `verify-endpoints.ts` - Verify RevealUI API endpoints

### 📁 `docs/`
Documentation management scripts:
- `docs-lifecycle.ts` - Manage documentation lifecycle (tracking, validation, archiving)
- `generate-api-docs.ts` - Generate API documentation
- `validate-jsdoc.ts` - Validate JSDoc comments
- And many more documentation utilities...

### 📁 `shared/`
Shared utilities for cross-platform script execution:
- `utils.ts` - Common utilities (logging, command execution, file operations)

## Cross-Platform Compatibility

All new scripts are written in TypeScript/Node.js for cross-platform compatibility (Windows, macOS, Linux). The scripts use:

- **ESM modules** (`import`/`export`) - not CommonJS
- **Shared utilities** from `shared/utils.ts` for consistent behavior
- **Cross-platform command execution** via Node.js `child_process`
- **Consistent logging** with colored output (when supported)

## Usage

### Running Scripts

Scripts can be run directly with `tsx` or `node`:

```bash
# TypeScript scripts
pnpm tsx scripts/validation/pre-launch-validation.ts

# JavaScript scripts
node scripts/setup/setup-env.js
```

### Package.json Scripts

Most scripts are also available via npm/pnpm scripts in the root `package.json`:

```bash
# Validation
pnpm validate:env
pnpm validate:pre-launch
pnpm validate:package-scripts

# Database
pnpm db:init
pnpm db:reset
pnpm seed:content

# MCP Servers
pnpm mcp:all
pnpm mcp:vercel
pnpm mcp:stripe

# Development
pnpm setup:env
```

## Migration from Legacy Scripts

✅ **All legacy shell scripts have been migrated to TypeScript!**

### Migration Status - Complete

- ✅ `pre-launch-validation` → `validation/pre-launch-validation.ts`
- ✅ `check-console-statements` → `validation/check-console-statements.ts`
- ✅ `run-migration` → `database/run-migration.ts`
- ✅ `setup-test-db` → `database/setup-test-db.ts`
- ✅ `reset-database.sh` → `database/reset-database.ts`
- ✅ `test-nextjs-mcp-endpoint.sh` → `validation/test-nextjs-mcp-endpoint.ts`

**Result:** All scripts are now cross-platform TypeScript. No legacy code remains in the codebase.

