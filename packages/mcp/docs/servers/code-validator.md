# AI Code Standards Enforcer

**Prevents AI-generated technical debt before it enters the codebase**

## Problem Statement

AI assistants (including Claude) have a pattern of generating code with anti-patterns like `console.log`, `any` types, and `TODO` comments without issue references, then later identifying these same patterns as technical debt that needs cleanup.

This creates a cycle of:
1. AI generates code with console.log
2. Code gets committed
3. AI audits codebase, finds 11k-62k console statements
4. AI recommends cleanup (60-80 hours of work)

**Solution:** Validate code at creation time, not cleanup time.

---

## Architecture

### Three-Layer Defense

```
┌─────────────────────────────────────────────┐
│  Layer 1: MCP Tool (Real-time validation)  │
│  Claude calls validate_code before Write   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Layer 2: Pre-commit Hook (Safety net)     │
│  Validates staged files before commit      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Layer 3: CI/CD (Final gate)               │
│  Validates all code in pull requests       │
└─────────────────────────────────────────────┘
```

### Components

1. **Validation Rules** (`.revealui/code-standards.json`)
   - Defines what patterns are violations
   - Severity levels (error, warning, info)
   - Exemptions (test files, scripts, etc.)
   - Suggested fixes

2. **Core Validator** (`packages/dev/src/code-validator`)
   - Pattern matching engine
   - Context extraction
   - Auto-fix capabilities
   - Exemption handling

3. **MCP Server** (`packages/mcp/src/servers/code-validator.ts`)
   - Exposes `validate_code` tool to Claude
   - Integrates with Model Context Protocol
   - Real-time validation during code generation

4. **Pre-commit Hook** (`scripts/git-hooks/pre-commit`)
   - Validates staged files before commit
   - Safety net for anything MCP layer missed
   - Can be bypassed with `--no-verify` (emergencies only)

5. **CLI Tool** (`scripts/validation/validate-code.ts`)
   - Manual validation
   - Testing and debugging
   - CI/CD integration

---

## Installation

### 1. Install Git Hook (Required)

```bash
pnpm hooks:install
```

This creates a symlink from `.git/hooks/pre-commit` to `scripts/git-hooks/pre-commit`.

### 2. Configure Claude Code MCP (Optional but Recommended)

Add to your Claude Code MCP configuration:

**`~/.config/claude-code/mcp_config.json`** (or equivalent):

```json
{
  "mcpServers": {
    "revealui-code-validator": {
      "command": "tsx",
      "args": ["./packages/mcp/src/servers/code-validator.ts"],
      "cwd": "/path/to/RevealUI",
      "description": "Code validation server - prevents technical debt",
      "enabled": true
    }
  }
}
```

Or copy from `.revealui/mcp-config.json`.

### 3. Install Dependencies

```bash
# Install minimatch (core validator dependency)
pnpm install

# Build packages/dev
pnpm --filter dev build
```

---

## Usage

### Manual Validation

```bash
# Validate a single file
pnpm validate:code src/foo.ts

# Validate from stdin (useful for pipes)
cat src/foo.ts | pnpm validate:code:stdin

# Auto-fix violations
pnpm validate:code:fix src/foo.ts
```

### MCP Tool (for Claude)

When MCP is configured, Claude can call:

```typescript
// Claude calls this before Write/Edit
const result = await validate_code({
  code: "console.log('debug')",
  filePath: "src/foo.ts",
  autoFix: false
})

if (!result.valid) {
  // Claude sees violations and can fix them before writing
}
```

### Pre-commit Hook (Automatic)

The hook runs automatically on `git commit`:

```bash
# Normal commit (hook validates)
git commit -m "feat: add feature"

# Emergency bypass (use sparingly!)
git commit --no-verify -m "hotfix: emergency"
```

---

## Validation Rules

Current rules (see `.revealui/code-standards.json`):

### 1. No console.log (ERROR)
**Pattern:** `console.(log|debug|info|warn|error)`

**Message:** Use logger instead of console.* - console statements create technical debt

**Fix:**
```typescript
// ❌ Bad
console.log('User created', userId)

// ✅ Good
import { logger } from '@revealui/core/logger'
logger.info('User created', { userId })
```

**Exemptions:** Test files, scripts, examples

---

### 2. No any types (WARNING)
**Pattern:** `: any` (explicit any types)

**Message:** Avoid explicit 'any' types - use proper TypeScript types

**Fix:**
```typescript
// ❌ Bad
function foo(data: any) { }

// ✅ Good
function foo(data: User) { }
function foo(data: unknown) { } // if truly unknown
```

**Exemptions:** Test files, scripts

---

### 3. TODO requires issue reference (WARNING)
**Pattern:** `// TODO` without `#123` or URL

**Message:** TODO comments must reference an issue

**Fix:**
```typescript
// ❌ Bad
// TODO fix this later

// ✅ Good
// TODO #123: Implement error handling
// TODO https://github.com/org/repo/issues/456
```

**Exemptions:** Test files, examples

---

### 4. No debugger statements (ERROR)
**Pattern:** `debugger`

**Message:** Remove debugger statements before committing

**Fix:** Remove the `debugger;` statement

**Exemptions:** Test files

---

### 5. No skipped tests (WARNING)
**Pattern:** `describe.skip(` or `it.skip(`

**Message:** Tests should not be skipped without issue reference

**Fix:** Either fix the test or add comment explaining why it's skipped

```typescript
// ❌ Bad
it.skip('should work', () => { })

// ✅ Good
// TODO #789: Re-enable after fixing flaky test
it.skip('should work', () => { })
```

---

## Exemptions

### By File Path (Glob Patterns)

```json
{
  "exemptions": {
    "paths": [
      "**/*.test.ts",       // Test files
      "**/*.spec.ts",       // Test files
      "**/scripts/**",      // Scripts directory
      "**/examples/**",     // Example code
      "**/__tests__/**"     // Test directories
    ]
  }
}
```

### By Comment

```typescript
// console.log allowed in this section
console.log('This is OK') // ai-validator-ignore

function debug() {
  // any-allowed: Legacy code being migrated
  const data: any = getLegacyData()
}
```

Supported exemption comments:
- `ai-validator-ignore` - Ignore all rules for this line
- `console-allowed` - Allow console.* for this line
- `any-allowed` - Allow any types for this line
- `skip-allowed` - Allow .skip tests for this line

---

## Configuration

### Adding New Rules

Edit `.revealui/code-standards.json`:

```json
{
  "rules": [
    {
      "id": "my-new-rule",
      "name": "Rule description",
      "pattern": "regex pattern",
      "severity": "error",
      "message": "What's wrong and why",
      "suggestedFix": "How to fix it",
      "exemptions": {
        "paths": ["**/test/**"],
        "comments": ["my-rule-ignore"]
      }
    }
  ]
}
```

### Severity Levels

- **error** - Blocks commit (exit code 1)
- **warning** - Allows commit but shows warning
- **info** - Informational only

### Auto-Fix Rules

```json
{
  "autoFix": {
    "enabled": true,
    "rules": [
      {
        "id": "no-console-log",
        "find": "console\\.log\\(([^)]*)\\)",
        "replace": "// FIXME: Replace with logger.info($1)"
      }
    ]
  }
}
```

---

## Testing

### Test the Validator

```bash
# Create test file
cat > /tmp/test.ts << 'EOF'
console.log('test')
const foo: any = {}
// TODO fix this
EOF

# Validate it
pnpm validate:code /tmp/test.ts

# Expected output:
# ✗ Code violations found
#
# ERROR [no-console-log] No console.log statements
#   at line 1:1
#   Use logger instead of console.*
#
# WARNING [no-any-type] No explicit any types
#   at line 2:11
#   Avoid explicit 'any' types
```

### Test Pre-commit Hook

```bash
# Create a file with violations
echo "console.log('test')" > src/test.ts

# Stage it
git add src/test.ts

# Try to commit (should fail)
git commit -m "test"

# Expected: Hook blocks commit with violation details
```

### Test MCP Server

```bash
# Start MCP server manually
tsx packages/mcp/src/servers/code-validator.ts

# Use MCP client to call validate_code
# (Or configure Claude Code and let Claude call it)
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Code Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - run: pnpm install
      - run: pnpm --filter dev build

      # Validate all TypeScript files
      - run: |
          find . -name "*.ts" -o -name "*.tsx" | \
          while read file; do
            pnpm validate:code "$file" || exit 1
          done
```

---

## Workflow for Claude

When Claude Code has MCP configured:

### Before (Without Validator)
```
1. Claude generates code with console.log
2. Claude calls Write tool
3. Code written to disk with violations
4. Later: Claude audits, finds violations, recommends cleanup
```

### After (With Validator)
```
1. Claude generates code
2. Claude calls validate_code MCP tool
3. Validator returns violations
4. Claude fixes violations
5. Claude calls validate_code again (passes)
6. Claude calls Write tool
7. Clean code written to disk
```

---

## Metrics & Reporting

### Validation Result Format

```json
{
  "valid": false,
  "violations": [
    {
      "ruleId": "no-console-log",
      "ruleName": "No console.log statements",
      "severity": "error",
      "message": "Use logger instead of console.*",
      "line": 42,
      "column": 5,
      "lineContent": "  console.log('debug')",
      "context": [
        "   40 | function processUser() {",
        "   41 |   const user = getUser()",
        " > 42 |   console.log('debug')",
        "   43 |   return user",
        "   44 | }"
      ],
      "suggestedFix": "import { logger } from '@revealui/core/logger'\nlogger.info('message', { data })"
    }
  ],
  "errors": 1,
  "warnings": 0,
  "info": 0,
  "stats": {
    "linesScanned": 156,
    "rulesApplied": 5,
    "exemptionsApplied": 2
  }
}
```

---

## Troubleshooting

### Hook Not Running

```bash
# Check hook is installed
ls -la .git/hooks/pre-commit

# Should show symlink to scripts/git-hooks/pre-commit
# If not, reinstall:
pnpm hooks:install
```

### Validator Not Found

```bash
# Ensure packages/dev is built
pnpm --filter dev build

# Check validator exports
ls -la packages/dev/src/code-validator/
```

### MCP Server Not Connecting

```bash
# Test MCP server manually
tsx packages/mcp/src/servers/code-validator.ts

# Check Claude Code MCP config
cat ~/.config/claude-code/mcp_config.json

# Ensure correct paths in config
```

### False Positives

Add exemption comment:

```typescript
// ai-validator-ignore
console.log('This console.log is intentional')
```

Or add path exemption to `.revealui/code-standards.json`.

---

## Future Enhancements

### Planned Features

1. **Auto-fix on pre-commit**
   - `git commit --fix` to automatically fix violations

2. **IDE Integration**
   - VS Code extension
   - Real-time validation as you type

3. **Statistics Dashboard**
   - Track violations over time
   - Measure reduction in technical debt

4. **Custom Rule Plugins**
   - Allow packages to define their own rules
   - Plugin system for extensibility

5. **AI Training Feedback Loop**
   - Send validation results back to Claude
   - Learn from violations to improve future code generation

---

## Related Documentation

- [Code Standards](../STANDARDS.md) - Overall coding standards
- [MCP Guide](../MCP.md) - MCP server configuration
- [Git Hooks](../../scripts/git-hooks/README.md) - Git hooks documentation
- [Master Plan](../../../../docs/MASTER_PLAN.md) - Current project status and roadmap

---

## Contributing

To add new validation rules:

1. Add rule to `.revealui/code-standards.json`
2. Test with `pnpm validate:code`
3. Add exemptions as needed
4. Document in this file
5. Submit PR

---

**Last Updated:** 2026-02-04
**Version:** 1.0.0
