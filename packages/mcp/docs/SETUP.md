# MCP Setup Guide - Code Validator

Complete guide to configure the Model Context Protocol (MCP) server for real-time code validation.

## What is MCP?

Model Context Protocol allows Claude Code to call tools and services. Our code validator MCP server exposes a `validate_code` tool that I can call before writing files to prevent technical debt.

## Prerequisites

✅ **Already installed:**
- MCP SDK: `@modelcontextprotocol/sdk` (installed)
- Code validator: `packages/dev/src/code-validator/` (built)
- MCP server: `packages/mcp/src/servers/code-validator.ts` (ready)

## Configuration Files Created

✅ **Config files at:**
- `~/.claude/config.json` (Claude Code CLI)
- `~/.config/Claude/claude_desktop_config.json` (Claude Desktop)

## Configuration Contents

```json
{
  "mcpServers": {
    "revealui-code-validator": {
      "command": "tsx",
      "args": ["<your-project-root>/packages/mcp/src/servers/code-validator.ts"],
      "cwd": "<your-project-root>",
      "env": {},
      "disabled": false
    }
  }
}
```

## How to Use

### Step 1: Restart Claude Code

If you're using Claude Code CLI, restart it:
```bash
# Exit current session
exit

# Start new session
claude
```

If using Claude Desktop, restart the application.

### Step 2: Verify MCP Server

Check that the server is loaded:
```bash
# Test server manually
tsx packages/mcp/src/servers/code-validator.ts

# Should start and wait for input (Ctrl+C to exit)
```

### Step 3: I Will Use It Automatically

Once configured, when I generate code:

**Before (without MCP):**
```
1. I generate code with console.log
2. I call Write tool
3. Code written (with violations)
4. Later: I audit and recommend cleanup
```

**After (with MCP):**
```
1. I generate code
2. I call validate_code MCP tool
3. Validator returns violations
4. I fix the code
5. I call validate_code again
6. Validator returns pass
7. I call Write tool
8. Clean code written ✅
```

## MCP Tools Available

### `validate_code`

Validates code content against RevealUI standards.

**Input:**
```json
{
  "code": "console.log('test')",
  "filePath": "src/foo.ts",
  "autoFix": false
}
```

**Output:**
```json
{
  "valid": false,
  "violations": [
    {
      "ruleId": "no-console-log",
      "severity": "error",
      "message": "Use logger instead of console.*",
      "line": 1,
      "column": 1,
      "suggestedFix": "import { logger } from '@revealui/core/logger'..."
    }
  ],
  "errors": 1,
  "warnings": 0,
  "summary": "1 errors, 0 warnings, 0 info"
}
```

### `get_standards`

Returns the current code standards configuration.

**Input:** (none)

**Output:**
```json
{
  "rules": [...],
  "autoFix": {...},
  "reporting": {...}
}
```

## Troubleshooting

### Server Not Starting

```bash
# Check tsx is available
which tsx

# Check MCP SDK installed
pnpm list @modelcontextprotocol/sdk

# Test server manually
tsx packages/mcp/src/servers/code-validator.ts
```

### Config Not Found

```bash
# Check config exists
cat ~/.claude/config.json

# Or
cat ~/.config/Claude/claude_desktop_config.json

# If missing, recreate from template:
cat .revealui/mcp-config.json
```

### Wrong Working Directory

The config must use **absolute paths**:
```json
{
  "command": "tsx",
  "args": ["/absolute/path/to/RevealUI/packages/mcp/src/servers/code-validator.ts"],
  "cwd": "/absolute/path/to/RevealUI"
}
```

### MCP Server Errors

Check the server logs:
```bash
# Run server with debug output
tsx packages/mcp/src/servers/code-validator.ts 2>&1 | tee mcp-debug.log
```

## Testing MCP Integration

### Manual Test

Create a test file:
```typescript
// test-mcp.ts
export function bad() {
  console.log('test')
  return true
}
```

Ask Claude to validate it:
> "Can you validate this code: test-mcp.ts"

I should call `validate_code` and report violations.

### Expected Behavior

When you ask me to write code, I should:
1. Generate the code
2. Call `validate_code` automatically
3. Fix any violations
4. Call Write tool with clean code

You'll see messages like:
```
Validating code against standards...
✓ Code passes all standards
Writing to src/foo.ts...
```

## Benefits of MCP Integration

### Real-time Validation
- I validate **before** writing files
- Violations caught at generation time
- No cleanup needed later

### Faster Development
- No manual validation needed
- No back-and-forth to fix issues
- Clean code on first write

### Consistent Quality
- Every file I write is validated
- Standards enforced automatically
- Technical debt prevented at source

## Disabling MCP Server

To disable temporarily:

**Option 1: In config**
```json
{
  "mcpServers": {
    "revealui-code-validator": {
      ...
      "disabled": true  // Set to true
    }
  }
}
```

**Option 2: Remove from config**
Delete the `revealui-code-validator` entry entirely.

## Related Documentation

- [Code Validation Guide](./CODE_VALIDATION.md) - Complete validator documentation
- [MCP Specification](https://modelcontextprotocol.io/) - Official MCP docs
- [Validation Rules](.revealui/code-standards.json) - Current rules

---

**Status:** ✅ Configured and Ready
**Server:** `packages/mcp/src/servers/code-validator.ts`
**Config:** `~/.claude/config.json` or `~/.config/Claude/claude_desktop_config.json`
**Last Updated:** 2026-02-04
