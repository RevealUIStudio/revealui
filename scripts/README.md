# RevealUI Scripts

This directory contains TypeScript scripts for development, automation, and tooling in the RevealUI monorepo.

## Directory Structure

```
scripts/
├── cli/                # Unified CLI entry points (db, setup, skills, validate, workflow)
├── lib/                # Shared utilities (logger, exec, paths, args, errors, output)
│   ├── database/       # Database connection and backup management
│   ├── state/          # Workflow state management
│   └── validation/     # Environment and database validation
├── setup/              # Database and environment setup (22 scripts)
├── generate/           # Code generation (8 scripts)
├── analyze/            # Code analysis and quality auditing (23 scripts)
├── validate/           # Validation gates and checks (22 scripts)
├── gates/              # Quality gates and specialized checks
│   ├── cohesion/       # Architecture cohesion analysis
│   ├── ops/            # Build and deployment operations
│   ├── performance/    # Performance analysis and benchmarking
│   └── security/       # Security testing
├── mcp/                # MCP protocol server adapters
├── orchestration/      # Workflow automation and management (12 scripts)
├── commands/           # Direct command implementations
│   └── database/       # Database commands (backup, restore, status)
├── agent/              # Shell scripts for agent operations (8 scripts)
├── archive/            # Obsolete scripts (for reference)
├── types.ts            # Shared TypeScript types
└── __tests__/          # Comprehensive test suite
```

## Quick Reference

### Database Operations

```bash
pnpm db:init              # Initialize database connection
pnpm db:migrate           # Run database migrations
pnpm db:setup-test        # Set up test database with Docker
pnpm db:status            # Check database connection status
```

### Code Quality

```bash
pnpm analyze:quality      # Run code quality analysis (TODOs, any types)
pnpm analyze:types        # Analyze type usage for migrations
pnpm analyze:console      # Check for console statement usage
```

### Validation

```bash
pnpm validate:console     # Validate no console statements in production
pnpm validate:production  # Run production validation checks
pnpm validate:pre-launch  # Comprehensive pre-launch validation
```

### Code Generation

```bash
pnpm generate:supabase-types   # Generate TypeScript types from Supabase
pnpm docs:generate:api         # Generate API documentation
```

### MCP Servers

```bash
pnpm mcp:vercel           # Start Vercel MCP server
pnpm mcp:stripe           # Start Stripe MCP server
pnpm mcp:neon             # Start Neon MCP server
pnpm mcp:supabase         # Start Supabase MCP server
```

### Workflow

```bash
pnpm workflow:list        # List all workflows
pnpm workflow:create      # Create a new workflow
pnpm workflow:approve     # Approve/reject workflow step
```

### Environment

```bash
pnpm setup:env            # Set up environment variables
pnpm setup:env --force    # Overwrite existing env file
pnpm setup:env --generate # Generate secrets only
```

## Directory Details

### `cli/`

CLI entry points that provide the interface for various script commands:
- `db.ts` - Database CLI
- `skills.ts` - Agent skills CLI
- `validate.ts` - Validation CLI
- `workflow.ts` - Workflow management CLI

### `lib/`

Shared utilities used across all scripts:
- `logger.ts` - Colorful console logging with prefixes
- `exec.ts` - Child process execution helpers
- `paths.ts` - Project path utilities
- `utils.ts` - Common utility functions
- `state/` - State management (PGLite, memory adapters)

### `setup/`

Database and environment initialization:
- `database.ts` - Database connection and table setup
- `test-database.ts` - Docker-based test database setup
- `migrations.ts` - Migration runner
- `environment.ts` - Environment variable setup

### `generate/`

Code generation scripts:
- `supabase-types.ts` - TypeScript types from Supabase schema
- `api-docs.ts` - API documentation generator

### `analyze/`

Code analysis and auditing:
- `code-quality.ts` - TODOs, any types, JSDoc coverage
- `types.ts` - Type migration analysis
- `console-usage.ts` - Console statement detection

### `validate/`

Validation scripts for code quality gates:
- `console-statements.ts` - Check for console usage
- `production.ts` - Production readiness checks
- `pre-launch.ts` - Comprehensive pre-launch validation

### `mcp/`

MCP (Model Context Protocol) server adapters:
- `adapters/vercel.ts` - Vercel deployment management
- `adapters/stripe.ts` - Stripe payment integration
- `adapters/neon.ts` - Neon database management
- `adapters/supabase.ts` - Supabase integration
- `adapters/playwright.ts` - Playwright testing
- `adapters/next-devtools.ts` - Next.js dev tools

### `orchestration/`

Workflow automation:
- `engine.ts` - Workflow state machine
- `automation-engine.ts` - Extended automation features

### `commands/`

CLI command implementations:
- `database/` - Database commands
- `workflow/` - Workflow commands (in progress)
- `validate/` - Validation commands (in progress)

### `agent/`

Shell scripts for agent operations:
- `agent-cli.sh` - Main agent CLI
- `build.sh` - Build agent
- `test.sh` - Test agent
- And more...

### `archive/`

Obsolete scripts kept for reference:
- `phase2/` - Old migration scripts

## Writing New Scripts

### Import from lib

Always use the shared utilities:

```typescript
import {
  createLogger,
  execCommand,
  getProjectRoot,
  fileExists,
  confirm,
  prompt,
} from '../lib/index.js'

const logger = createLogger({ prefix: 'MyScript' })
```

### Standard Template

```typescript
#!/usr/bin/env tsx

/**
 * Script Name
 *
 * Description of what this script does.
 *
 * Usage:
 *   pnpm my-script
 */

import { createLogger, getProjectRoot } from '../lib/index.js'

const logger = createLogger()

async function main() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    logger.header('Script Name')

    // Script logic here

    logger.success('Complete!')
  } catch (error) {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
```

### Naming Conventions

- Analysis scripts: `analyze-{subject}.ts`
- Validation scripts: `validate-{subject}.ts`
- Setup scripts: `setup-{subject}.ts` or `{subject}.ts` if in `/setup/`
- Fix scripts: `fix-{subject}.ts`
- Generation scripts: `generate-{subject}.ts`

## Testing

Tests for scripts are located in `__tests__/`:

```bash
pnpm test scripts/__tests__
```
