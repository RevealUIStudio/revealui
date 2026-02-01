# Scripts Methodology

Guidelines for creating and maintaining scripts in RevealUI. All scripts support dual-mode operation for both human developers and AI agents.

## Architecture Overview

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

## Output Modes

### Human Mode (Default)

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

### Agent Mode (--json)

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

## Exit Codes

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

## Creating TypeScript CLIs

### Using BaseCLI

All TypeScript CLIs should extend `BaseCLI` for consistent behavior:

```typescript
import { BaseCLI, runCLI, type CommandDefinition } from './_base.js'
import { ok, fail, type ScriptOutput } from '../lib/output.js'
import type { ParsedArgs } from '../lib/args.js'

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

### Lifecycle Hooks

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

### Error Handling

Use typed errors for proper exit codes:

```typescript
import { notFound, validationError, configError } from '../lib/errors.js'

// These throw ScriptError with appropriate exit codes
if (!item) throw notFound('Item', id)
if (!valid) throw validationError('Invalid email format', 'email')
if (!process.env.API_KEY) throw configError('Missing environment variable', 'API_KEY')
```

## Creating Shell Scripts

### Using _helpers.sh

All shell scripts should source the helpers for consistent behavior:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

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

### Available Helper Functions

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

## File Locations

```
scripts/
├── lib/
│   ├── args.ts           # Argument parser
│   ├── output.ts         # Dual-mode output handler
│   ├── errors.ts         # Typed errors with codes
│   ├── logger.ts         # Colored terminal logging
│   ├── exec.ts           # Command execution
│   └── state/            # State management
│
├── cli/
│   ├── _base.ts          # Base CLI class
│   ├── workflow.ts       # Workflow management
│   ├── db.ts             # Database operations
│   ├── validate.ts       # Validation tools
│   └── setup.ts          # Setup operations
│
├── agent/
│   ├── _helpers.sh       # Shell script helpers
│   └── *.sh              # Shell scripts
│
└── __tests__/
    ├── *.test.ts         # Unit tests
    └── integration/      # E2E tests
```

## Quick Reference

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
