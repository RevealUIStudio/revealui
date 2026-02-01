# Code Examples

Practical, runnable code examples demonstrating RevealUI features and CLI tools.

## Overview

This directory contains real-world code examples you can run and learn from:

- **Package Script Validation** - Programmatic script validation
- **Custom CLI Integration** - Building custom CLIs with BaseCLI
- **Performance Monitoring** - Integrating telemetry and metrics
- **Workflow Automation** - Automated development workflows
- **Testing Utilities** - Test helpers and patterns

## Running Examples

All examples are self-contained and can be run directly:

```bash
# From project root
cd examples/code-examples

# Run an example
tsx <example-name>.ts
```

## Available Examples

### 1. Script Validation API
**File:** `script-validation-api.ts`

Demonstrates how to programmatically validate package.json scripts:

```bash
tsx script-validation-api.ts
```

**Use cases:**
- Custom CI/CD validation
- Build-time checks
- IDE integrations

### 2. Custom CLI Tool
**File:** `custom-cli.ts`

Shows how to build a custom CLI using the BaseCLI pattern:

```bash
tsx custom-cli.ts --help
tsx custom-cli.ts validate
tsx custom-cli.ts analyze --json
```

**Use cases:**
- Project-specific tools
- Internal automation
- Team workflows

### 3. Performance Monitoring
**File:** `performance-monitoring.ts`

Demonstrates integrating performance monitoring:

```bash
tsx performance-monitoring.ts
```

**Use cases:**
- Custom dashboards
- CI performance tracking
- Build analytics

### 4. Automated Workflow
**File:** `automated-workflow.ts`

Complete example of an automated development workflow:

```bash
tsx automated-workflow.ts
```

**Use cases:**
- Pre-commit checks
- Release automation
- Daily maintenance

### 5. Testing Utilities
**File:** `testing-utilities.ts`

Reusable test helpers and patterns:

```bash
tsx testing-utilities.ts
```

**Use cases:**
- Test setup/teardown
- Mock utilities
- Assertion helpers

## Example Structure

Each example includes:
- **Comments** explaining what's happening
- **Error handling** showing best practices
- **Output** to demonstrate results
- **Reusable code** you can copy

## Integration Examples

### Custom Package Template

Create a custom package template:

```typescript
// custom-template.json
{
  "name": "@yourorg/package-name",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "test": "vitest run",
    // Your custom scripts
    "custom:task": "tsx scripts/custom.ts"
  }
}
```

### Git Hook Integration

Use validation in git hooks:

```bash
#!/bin/sh
# .husky/pre-commit

# Validate package scripts
tsx examples/code-examples/script-validation-api.ts --strict

# Exit if validation fails
if [ $? -ne 0 ]; then
  echo "❌ Script validation failed"
  exit 1
fi
```

### CI/CD Integration

Add to GitHub Actions:

```yaml
# .github/workflows/validate.yml
- name: Validate Package Scripts
  run: tsx examples/code-examples/script-validation-api.ts --json > validation-results.json

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: validation-results
    path: validation-results.json
```

## Next Steps

- **Modify examples** to fit your needs
- **Combine examples** to create workflows
- **Share improvements** via PR

## Resources

- [Script Standards](../../scripts/STANDARDS.md)
- [CLI Demos](../cli-demos/README.md)
- [Tutorial](../../docs/TUTORIAL.md)
- [Migration Guide](../../docs/MIGRATION_GUIDE.md)

---

**Last Updated:** Phase 6 - Documentation & Polish
