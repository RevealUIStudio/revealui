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

## Script Development Guide

### Architecture Overview

All scripts support dual-mode operation for both human developers and AI agents:

```
┌─────────────────────────────────────────────────┐
│                   CONSUMERS                     │
│     Human (Terminal)    │    Agent (Automation) │
└───────────────┬─────────┴────────────┬──────────┘
                │                      │
                ▼                      ▼
┌───────────────────────────────────────────────┐
│              UNIFIED CLI LAYER                │
│  ┌─────────────┐     ┌─────────────────────┐  │
│  │ Human Mode  │     │    Agent Mode       │  │
│  │ --human     │     │    --json           │  │
│  │ Colors, TTY │     │    Structured data  │  │
│  │ Interactive │     │    Exit codes       │  │
│  └─────────────┘     └─────────────────────┘  │
└───────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────┐
│              CORE LIBRARIES                   │
│  logger.ts │ exec.ts │ args.ts │ output.ts   │
└───────────────────────────────────────────────┘
```

### Output Modes

#### Human Mode (Default)

- Colored terminal output with ANSI codes
- Progress indicators and spinners
- Interactive prompts and confirmations
- Formatted tables and lists
- Verbose error messages with suggestions

```bash
# Human mode (default)
pnpm workflow:status wf-123

# Output:
# ══════════════════════════════
# | Workflow: deployment       |
# ══════════════════════════════
#
# [INFO] ID: wf-123
# [INFO] Status: running
# [INFO] Progress: 2/4 steps
```

#### Agent Mode (--json)

- Structured JSON output to stdout
- No ANSI colors or formatting
- Machine-parseable responses
- Differentiated exit codes
- Silent progress (metadata only)

```bash
# Agent mode
pnpm workflow:status wf-123 --json

# Output:
{
  "success": true,
  "data": {
    "id": "wf-123",
    "name": "deployment",
    "status": "running",
    "currentStepIndex": 2,
    "totalSteps": 4
  },
  "metadata": {
    "timestamp": "2025-01-29T10:30:00Z",
    "duration": 45
  }
}
```

### Exit Codes

All scripts use standardized exit codes for proper error differentiation:

| Code | Name | Description | Use Case |
|------|------|-------------|----------|
| 0 | SUCCESS | Operation completed successfully | All operations succeeded |
| 1 | GENERAL_ERROR | Unexpected error | Unhandled exceptions |
| 2 | CONFIG_ERROR | Configuration error | Missing env var, bad config |
| 3 | EXECUTION_ERROR | Command execution failed | External command failed |
| 4 | VALIDATION_ERROR | Input validation failed | Bad arguments, invalid data |
| 5 | TIMEOUT_ERROR | Operation timed out | Network/process timeout |
| 6 | NOT_FOUND | Resource not found | Missing file, workflow, etc. |
| 7 | PERMISSION_DENIED | Access denied | Auth failed, insufficient perms |
| 8 | CONFLICT | Resource conflict | Already exists, state conflict |
| 9 | CANCELLED | Operation cancelled | User cancelled, interrupted |
| 10 | DEPENDENCY_ERROR | Missing dependency | Required tool not installed |
| 11 | NETWORK_ERROR | Network failure | Connection failed, DNS error |
| 12 | RATE_LIMITED | Rate limit exceeded | API throttling |
| 13 | INVALID_STATE | Invalid state transition | Workflow state machine error |

## Writing New Scripts

### Creating TypeScript CLIs

#### Using BaseCLI

All TypeScript CLIs should extend `BaseCLI` for consistent behavior:

```typescript
import { BaseCLI, runCLI, type CommandDefinition } from './cli/_base.js'
import { ok, fail, type ScriptOutput } from './lib/output.js'
import type { ParsedArgs } from './lib/args.js'

class MyCLI extends BaseCLI {
  name = 'my-cli'
  description = 'Description of my CLI'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'list',
        description: 'List all items',
        args: [
          { name: 'limit', short: 'l', type: 'number', default: 10, description: 'Max items' },
        ],
        handler: (args) => this.list(args),
      },
      {
        name: 'delete',
        description: 'Delete an item',
        confirmPrompt: 'Are you sure?', // Requires confirmation in human mode
        args: [],
        handler: (args) => this.delete(args),
      },
    ]
  }

  private async list(args: ParsedArgs): Promise<ScriptOutput<ItemList>> {
    const limit = this.getFlag('limit', 10)
    const items = await fetchItems(limit)

    // Progress message (shown in human mode, suppressed in JSON mode)
    this.output.progress(`Found ${items.length} items`)

    // Return structured result
    return ok({ items, count: items.length })
  }

  private async delete(args: ParsedArgs): Promise<ScriptOutput<DeleteResult>> {
    const id = this.requirePositional(0, 'item ID')

    await deleteItem(id)
    return ok({ deleted: id })
  }
}

// Entry point
runCLI(MyCLI)
```

#### Lifecycle Hooks

Override lifecycle hooks for initialization and cleanup:

```typescript
class DatabaseCLI extends BaseCLI {
  private db!: Database

  async beforeRun(): Promise<void> {
    this.db = await connectToDatabase()
  }

  async afterRun(): Promise<void> {
    await this.db.close()
  }
}
```

#### Error Handling

Use typed errors for proper exit codes:

```typescript
import { notFound, validationError, configError } from './lib/errors.js'

// These throw ScriptError with appropriate exit codes
if (!item) throw notFound('Item', id)
if (!valid) throw validationError('Invalid email format', 'email')
if (!process.env.API_KEY) throw configError('Missing environment variable', 'API_KEY')
```

### Creating Shell Scripts

#### Using _helpers.sh

All shell scripts should source the helpers for consistent behavior:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/agent/_helpers.sh"

# Parse common flags (--json, --no-color, --verbose, --force)
parse_common_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Handle help
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  show_help
  exit $EXIT_SUCCESS
fi

# Main logic
main() {
  log_info "Starting operation..."

  if ! some_command; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "EXECUTION_ERROR" "Command failed"
    else
      log_error "Command failed"
    fi
    exit $EXIT_EXECUTION_ERROR
  fi

  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"result": "completed"}'
  else
    log_success "Operation completed!"
  fi
}

main
```

#### Available Helper Functions

**Logging (human mode only):**
- `log_info "message"` - Blue [INFO] prefix
- `log_success "message"` - Green [OK] prefix
- `log_warning "message"` - Yellow [WARN] prefix
- `log_error "message"` - Red [ERROR] prefix (to stderr)
- `log_debug "message"` - Dim [DEBUG] prefix (verbose only)
- `log_header "title"` - Boxed section header
- `log_divider` - Horizontal line

**JSON Output:**
- `json_success '{"data": "value"}'` - Success response
- `json_error "CODE" "message"` - Error response
- `json_string "key" "value"` - Key-value pair
- `json_number "key" 42` - Numeric value
- `json_bool "key" true` - Boolean value
- `json_array_start "key"` / `json_array_end` - Arrays
- `json_array_item "value"` - Array items

**Utilities:**
- `command_exists "cmd"` - Check if command is available
- `confirm "message" "Y"` - Prompt for confirmation (skipped in JSON/force mode)

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

## Testing Requirements

### Unit Tests

Every new library module should have corresponding tests:

```
scripts/lib/args.ts       → scripts/__tests__/args.test.ts
scripts/lib/output.ts     → scripts/__tests__/output.test.ts
scripts/lib/errors.ts     → scripts/__tests__/errors.test.ts
```

### CLI Tests

Test CLI commands with both output modes:

```typescript
describe('MyCLI', () => {
  it('outputs valid JSON with --json flag', async () => {
    const result = await runCLI(['list', '--json'])
    expect(() => JSON.parse(result.stdout)).not.toThrow()
  })

  it('returns correct exit code for errors', async () => {
    const result = await runCLI(['get', 'not-found', '--json'])
    expect(result.exitCode).toBe(6) // NOT_FOUND
  })
})
```

### Integration Tests

For workflows and complex operations, create E2E tests:

```typescript
describe('Workflow E2E', () => {
  it('complete lifecycle: create → start → approve → complete', async () => {
    const workflow = await machine.create('test', steps)
    await machine.transition(workflow.id, { type: 'START' })
    // ... continue through workflow
    expect(finalState.status).toBe('completed')
  })
})
```

### Running Tests

Tests for scripts are located in `__tests__/`:

```bash
pnpm test scripts/__tests__
```

## Best Practices

### Do

- Always support `--json` flag for agent compatibility
- Use typed errors with appropriate exit codes
- Provide progress messages for long operations
- Add confirmation prompts for destructive actions
- Include help text with examples
- Test both output modes

### Don't

- Output raw text in JSON mode
- Use colors without TTY detection
- Require interactive input in JSON mode
- Mix stdout/stderr incorrectly
- Hard-code exit codes (use ErrorCode enum)
- Skip cleanup in error paths

## Workflow Examples

### Human Developer Workflow

```bash
# Interactive setup
pnpm setup:env

# View workflow status with colors
pnpm workflow:status

# Delete with confirmation
pnpm workflow:delete wf-123

# Verbose output for debugging
pnpm workflow:status wf-123 --verbose
```

### Agent Automation Workflow

```bash
# All commands with --json flag
pnpm workflow:status wf-123 --json | jq .

# Check exit codes
pnpm workflow:status nonexistent --json
echo "Exit code: $?"  # 6 (NOT_FOUND)

# Skip confirmations
pnpm workflow:delete wf-123 --json --force

# Parse specific fields
pnpm workflow:list --json | jq '.data.workflows[].id'
```

---

**Last Updated**: 2026-01-31
**Consolidated**: 2026-01-31 (Merged METHODOLOGY.md into this README)
