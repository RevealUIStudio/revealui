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

### 📁 `setup/`
Setup and configuration scripts:
- `setup-env.js` - Interactive environment setup wizard
- `validate-env.js` - Validate environment variables
- `setup-mcp.ts` - Setup MCP servers
- `install-clean.ts` - Clean install with deprecation warnings suppressed
- `setup-docker-wsl2.ts` - Docker Engine setup for WSL2 (Linux-specific)

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

### 📁 `shared/`
Shared utilities for cross-platform script execution:
- `utils.ts` - Common utilities (logging, command execution, file operations)

### 📁 `legacy/`
Legacy shell scripts (`.sh`) and PowerShell scripts (`.ps1`) that are being phased out in favor of cross-platform TypeScript/Node.js implementations.

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
pnpm seed:content

# MCP Servers
pnpm mcp:all
pnpm mcp:vercel
pnpm mcp:stripe

# Development
pnpm setup:env
```

## Migration from Legacy Scripts

Legacy shell scripts (`.sh`) and PowerShell scripts (`.ps1`) are being migrated to TypeScript for cross-platform compatibility. The legacy scripts are preserved in the `legacy/` directory for reference.

### Migration Status

- ✅ `check-console-statements` → `validation/check-console-statements.ts`
- ✅ `pre-launch-validation` → `validation/pre-launch-validation.ts`
- ✅ `run-migration` → `database/run-migration.ts`
- ✅ `setup-test-db` → `database/setup-test-db.ts`
- 🔄 Other scripts in progress

## Adding New Scripts

When adding new scripts:

1. **Choose the right directory** based on the script's purpose
2. **Use TypeScript** (`.ts`) for new scripts when possible
3. **Import shared utilities** from `shared/utils.ts`:
   ```typescript
   import { createLogger, execCommand, requireEnv } from '../shared/utils.js'
   ```
4. **Add shebang** for direct execution:
   ```typescript
   #!/usr/bin/env tsx
   ```
5. **Update package.json** if the script should be available as an npm script
6. **Document** the script's purpose and usage

## Shared Utilities

The `shared/utils.ts` module provides:

- **`createLogger()`** - Cross-platform logger with colored output
- **`execCommand()`** - Execute shell commands cross-platform
- **`commandExists()`** - Check if a command is available
- **`requireEnv()`** - Require environment variable or exit
- **`fileExists()`** - Check if file exists
- **`prompt()`** - Interactive user prompts
- **`confirm()`** - Yes/no confirmations
- **`waitFor()`** - Wait for async conditions

Example usage:

```typescript
import { createLogger, execCommand, requireEnv } from '../shared/utils.js'

const logger = createLogger()
const dbUrl = requireEnv('POSTGRES_URL', 'DATABASE_URL')

logger.header('Running Migration')
const result = await execCommand('pnpm', ['db:push'])
if (result.success) {
  logger.success('Migration completed')
} else {
  logger.error('Migration failed')
  process.exit(1)
}
```

## Testing Scripts

### Manual Testing

Scripts can be tested individually:

```bash
# Run a script directly
pnpm tsx scripts/validation/check-console-statements.ts

# Or use the npm script (if available)
pnpm validate:pre-launch
```

### Automated Testing

Unit tests and integration tests are available:

```bash
# Run unit tests for shared utilities
cd scripts && pnpm exec vitest run shared/__tests__/utils.test.ts

# Run integration tests
cd scripts && pnpm exec vitest run __tests__/integration/script-workflows.test.ts

# Run all script tests
cd scripts && pnpm exec vitest run
```

## Notes

- All scripts use **ESM (ES Modules)** - `import`/`export`, not `require`/`module.exports`
- Scripts follow the project's **Biome formatting rules** (single quotes, no semicolons, etc.)
- Use **`pnpm dlx`** instead of `npx` for running packages (per project conventions)
