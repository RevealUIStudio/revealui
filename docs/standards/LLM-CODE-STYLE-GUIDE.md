# LLM Code Style Enforcement Guide

This guide outlines best practices for ensuring LLMs (like Cursor's AI) generate code that matches your project's style consistently.

## Overview

Your project uses a multi-layered approach to enforce code style:
1. **Biome** - Fast formatter and linter (30x faster than Prettier)
2. **ESLint** - Advanced TypeScript/React rules
3. **TypeScript** - Strict type checking
4. **`.cursorrules`** - LLM-specific instructions

## Best Practices

### 1. Comprehensive `.cursorrules` File

The `.cursorrules` file is your primary tool for LLM code style enforcement. It should include:

#### ✅ Include Specific Formatting Rules
```markdown
### Formatting Rules
- Use single quotes for strings
- Omit semicolons when not required
- 2 spaces indentation
- Max line width: 100 characters
```

#### ✅ Provide Code Examples
Show correct patterns, not just rules:
```typescript
// ✅ Correct
export function Component({ prop }: Props) {
  return <div>{prop}</div>
}

// ❌ Incorrect
export default function Component(props: any) {
  return <div>{props.prop}</div>;
}
```

#### ✅ Document Anti-Patterns
Explicitly list what NOT to do:
- ❌ Don't use `any` type
- ❌ Don't use default exports
- ❌ Don't add unnecessary semicolons

#### ✅ Reference Your Tools
Mention your tooling so the LLM knows what to align with:
```markdown
### Formatting Rules (Biome Configuration)
- Configured in `biome.json`
- Run `pnpm format` to auto-format
```

### 2. Keep Configuration Files in Sync

Ensure your `.cursorrules` matches your actual tooling:

| Tool | Config File | Command |
|------|-------------|---------|
| Biome | `biome.json` | `pnpm format` |
| ESLint | `eslint.config.js` | `pnpm lint` |
| TypeScript | `tsconfig.json` | `pnpm typecheck` |

**Action**: When you update `biome.json`, update `.cursorrules` too.

### 3. Use Concrete Examples

Abstract rules are less effective than concrete examples:

#### ❌ Less Effective
```markdown
- Use proper TypeScript types
```

#### ✅ More Effective
```markdown
### TypeScript Types
- Use explicit types for function parameters
- Prefer `interface` over `type` for object shapes
- Use `unknown` instead of `any` when type is truly unknown

Example:
```typescript
interface User {
  id: string
  name: string
}

function getUser(id: string): Promise<User> {
  // ...
}
```
```

### 4. Document Project-Specific Patterns

Your project has specific patterns that should be documented:

```markdown
### Next.js 16 Patterns
- `params` and `searchParams` are Promises - always await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes

Example:
```typescript
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // ...
}
```
```

### 5. Reference File Structure

Help the LLM understand where code belongs:

```markdown
### File Organization
- Components: `apps/web/src/components/`
- Utilities: `apps/web/src/lib/`
- Types: `packages/core/src/types/`
- Collections: `apps/cms/src/lib/collections/`
```

### 6. Add Validation Commands

Include commands the LLM should run after making changes:

```markdown
## When Making Changes
1. Ensure TypeScript compiles: `pnpm typecheck`
2. Run formatter: `pnpm format`
3. Run linter: `pnpm lint`
4. Verify build: `pnpm build`
```

## Advanced Techniques

### 1. Use Pre-commit Hooks

Automatically format code before commits:

### 2. Add Style Check to CI/CD

Your CI already checks linting. Consider adding:

```yaml
- name: Check formatting
  run: pnpm biome check --write --formatted .
```

### 3. Create Style Examples File

Create a `STYLE-EXAMPLES.md` with common patterns:

```markdown
# Style Examples

## React Component
```typescript
interface Props {
  title: string
}

export function Component({ title }: Props) {
  return <h1>{title}</h1>
}
```

## API Route Handler
```typescript
export async function GET(req: NextRequest) {
  // ...
}
```
```

### 4. Use TypeScript Strict Mode

Your project already uses strict mode. This helps catch style issues:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## Testing Your Setup

### Verify LLM Follows Style

1. Ask the LLM to create a new component
2. Check if it matches your style:
   - ✅ Uses ESM (`import`/`export`), not CommonJS?
   - ✅ Uses single quotes?
   - ✅ No unnecessary semicolons?
   - ✅ Proper TypeScript types?
   - ✅ Named exports?

### Iterate on `.cursorrules`

If the LLM generates code that doesn't match your style:
1. Add the specific pattern to `.cursorrules`
2. Include both correct and incorrect examples
3. Be more explicit about the rule

## Quick Reference

### Your Current Style Rules

Based on `biome.json`:
- **Module System**: ESM (ES Modules) - use `import`/`export`, NOT CommonJS
- **Quotes**: Single for strings, double for JSX
- **Semicolons**: As needed (omitted when possible)
- **Indent**: 2 spaces
- **Line Width**: 100 characters
- **Trailing Commas**: ES6 style
- **Arrow Functions**: Always parentheses around params

#### Module System Examples

✅ **Correct (ESM)**:
```typescript
import { useState } from 'react'
import { Button } from '@/components/Button'

export function Component() {
  return <Button />
}
```

❌ **Incorrect (CommonJS)**:
```typescript
const { useState } = require('react')
const { Button } = require('@/components/Button')

module.exports = { Component }
```

### Commands

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Type check
pnpm typecheck

# All checks
pnpm format && pnpm lint && pnpm typecheck
```

## Troubleshooting

### LLM Generates Wrong Style

1. **Check `.cursorrules`** - Is the rule documented?
2. **Add examples** - Concrete examples work better than abstract rules
3. **Be explicit** - "Use single quotes" is better than "follow style guide"
4. **Reference config** - Point to `biome.json` for formatting rules

### Inconsistent Formatting

1. Run `pnpm format` to auto-fix
2. Update `.cursorrules` with the specific pattern
3. Consider adding a pre-commit hook

### TypeScript Errors

1. Ensure strict mode is enabled
2. Document type patterns in `.cursorrules`
3. Provide type examples for common cases

## Summary

The best way to enforce code style with LLMs:

1. ✅ **Comprehensive `.cursorrules`** with specific rules and examples
2. ✅ **Keep it in sync** with your actual tooling (Biome, ESLint)
3. ✅ **Use concrete examples** instead of abstract rules
4. ✅ **Document anti-patterns** explicitly
5. ✅ **Reference your config files** (biome.json, eslint.config.js)
6. ✅ **Add validation commands** the LLM should run
7. ✅ **Use pre-commit hooks** for automatic formatting
8. ✅ **Iterate and improve** based on what the LLM generates

Your current setup is good! The enhanced `.cursorrules` file should help ensure more consistent code generation.

## Related Documentation

- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
- [Code Style Guidelines](./CODE-STYLE-GUIDELINES.md) - General code style
- [Testing Strategy](./testing/TESTING-STRATEGY.md) - Testing requirements
- [Error Handling](./ERROR_HANDLING.md) - Error handling patterns
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
