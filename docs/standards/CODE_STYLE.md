# Code Style & Formatting Standards

This document describes the code style, linting, and formatting standards for the RevealUI monorepo, including best practices for ensuring LLMs generate consistent code.

---

## Table of Contents

- [Overview](#overview)
- [Tooling](#tooling)
  - [ESLint Configuration](#eslint-configuration)
  - [Biome Configuration](#biome-configuration)
- [Commands](#commands)
- [Style Rules](#style-rules)
- [LLM Code Style Enforcement](#llm-code-style-enforcement)
  - [Best Practices](#best-practices)
  - [Advanced Techniques](#advanced-techniques)
- [Loop and Iteration Patterns](#loop-and-iteration-patterns)
- [Pre-Commit Guidelines](#pre-commit-guidelines)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The project uses **ESLint for type-aware linting** and **Biome for formatting + fast linting**. This separation provides:

- **ESLint**: Type-aware TypeScript rules that catch type safety issues
- **Biome**: Fast formatting and style rules that don't require type information

**Philosophy**: Simple, consistent code style that works across the entire monorepo.

---

## Tooling

### ESLint Configuration

#### Shared Config

Each package/app owns its `eslint.config.js` (or `eslint.config.mjs` if it is not ESM) and composes the shared config from `packages/dev`:

```javascript
// eslint.config.js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
]
```

For Next.js apps, add the Next plugin rules:

```javascript
import next from '@next/eslint-plugin-next'

const nextFiles = [
  'src/**/*.{ts,tsx,js,jsx}',
  'app/**/*.{ts,tsx,js,jsx}',
  'pages/**/*.{ts,tsx,js,jsx}',
]

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    ...next.configs['core-web-vitals'],
    files: nextFiles,
  },
]
```

#### What ESLint Checks

ESLint focuses on **type-aware TypeScript rules** that require type information:

- `@typescript-eslint/no-explicit-any`: Prevents `any` types
- `@typescript-eslint/no-unsafe-*`: Catches unsafe type operations
- Additional type-safe rules from the `recommended-type-checked` preset

#### Config Files

Config files are excluded from type-aware linting (they use basic syntax-only rules):
- `**/*.config.*`
- `**/eslint.config.*`
- `**/vite.config.*`
- `**/next.config.*`

### Biome Configuration

#### What Biome Handles

- **Formatting**: All code formatting (quotes, semicolons, indentation)
- **Style Rules**: Code style checks (use const, use template, etc.)
- **Accessibility**: a11y rules
- **Performance**: Performance-related linting
- **Security**: Security-related linting

#### Biome Rules

See `biome.json` in the root for full configuration. Key settings:

- **Module System**: ESM (ES Modules) - use `import`/`export`, NOT CommonJS
- **Quotes**: Single for strings, double for JSX
- **Semicolons**: `asNeeded` (only when required)
- **Line Width**: 100 characters
- **Indentation**: 2 spaces
- **Trailing Commas**: ES6 style
- **Arrow Functions**: Always parentheses around params

---

## Commands

### Running Linting

**From root** (lints all packages):
```bash
pnpm lint
```

**Biome-only in a specific package**:
```bash
cd apps/cms
pnpm lint
```

**ESLint in a specific package/app**:
```bash
pnpm --filter <pkg> lint:eslint
```

### Formatting

**Biome handles ALL formatting**. Do not use ESLint's `--fix` flag.

**Format all files**:
```bash
pnpm format
```

**Format and lint fix** (Biome formatting + lint fixes):
```bash
pnpm lint:fix
```

**ESLint fixes** (type-aware lint fixes):
```bash
pnpm lint:eslint:fix
```

### Standardized Commands

The repo standardizes on a single ESLint command from the root (Turbo runs per-package `lint:eslint` scripts):

```bash
pnpm lint:eslint
```

---

## Style Rules

### Module System

RevealUI uses **ESM (ES Modules)** exclusively - use `import`/`export`, NOT CommonJS.

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

### Formatting Rules

Based on `biome.json`:
- **Quotes**: Single for strings, double for JSX
- **Semicolons**: As needed (omitted when possible)
- **Indent**: 2 spaces
- **Line Width**: 100 characters
- **Trailing Commas**: ES6 style
- **Arrow Functions**: Always parentheses around params

### Quick Reference

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

---

## LLM Code Style Enforcement

### Best Practices

Your project uses a multi-layered approach to enforce code style:
1. **Biome** - Fast formatter and linter (30x faster than Prettier)
2. **ESLint** - Advanced TypeScript/React rules
3. **TypeScript** - Strict type checking
4. **`.cursorrules`** - LLM-specific instructions

#### 1. Comprehensive `.cursorrules` File

The `.cursorrules` file is your primary tool for LLM code style enforcement. It should include:

##### Include Specific Formatting Rules
```markdown
### Formatting Rules
- Use single quotes for strings
- Omit semicolons when not required
- 2 spaces indentation
- Max line width: 100 characters
```

##### Provide Code Examples
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

##### Document Anti-Patterns
Explicitly list what NOT to do:
- ❌ Don't use `any` type
- ❌ Don't use default exports
- ❌ Don't add unnecessary semicolons

##### Reference Your Tools
Mention your tooling so the LLM knows what to align with:
```markdown
### Formatting Rules (Biome Configuration)
- Configured in `biome.json`
- Run `pnpm format` to auto-format
```

#### 2. Keep Configuration Files in Sync

Ensure your `.cursorrules` matches your actual tooling:

| Tool | Config File | Command |
|------|-------------|---------|
| Biome | `biome.json` | `pnpm format` |
| ESLint | `eslint.config.js` | `pnpm lint` |
| TypeScript | `tsconfig.json` | `pnpm typecheck:all` |

**Action**: When you update `biome.json`, update `.cursorrules` too.

#### 3. Use Concrete Examples

Abstract rules are less effective than concrete examples:

##### ❌ Less Effective
```markdown
- Use proper TypeScript types
```

##### ✅ More Effective
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

#### 4. Document Project-Specific Patterns

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

#### 5. Reference File Structure

Help the LLM understand where code belongs:

```markdown
### File Organization
- Components: `apps/web/src/components/`
- Utilities: `apps/web/src/lib/`
- Types: `packages/core/src/types/`
- Collections: `apps/cms/src/lib/collections/`
```

#### 6. Add Validation Commands

Include commands the LLM should run after making changes:

```markdown
## When Making Changes
1. Ensure TypeScript compiles: `pnpm typecheck:all`
2. Run formatter: `pnpm format`
3. Run linter: `pnpm lint`
4. Verify build: `pnpm build`
```

### Advanced Techniques

#### 1. Use Pre-commit Hooks

Automatically format code before commits.

#### 2. Add Style Check to CI/CD

Your CI already checks linting. Consider adding:

```yaml
- name: Check formatting
  run: pnpm biome check --write --formatted .
```

#### 3. Create Style Examples File

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

#### 4. Use TypeScript Strict Mode

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

### Testing Your Setup

#### Verify LLM Follows Style

1. Ask the LLM to create a new component
2. Check if it matches your style:
   - ✅ Uses ESM (`import`/`export`), not CommonJS?
   - ✅ Uses single quotes?
   - ✅ No unnecessary semicolons?
   - ✅ Proper TypeScript types?
   - ✅ Named exports?

#### Iterate on `.cursorrules`

If the LLM generates code that doesn't match your style:
1. Add the specific pattern to `.cursorrules`
2. Include both correct and incorrect examples
3. Be more explicit about the rule

---

## Loop and Iteration Patterns

### When to Use `for...of` vs `.forEach()`

This section provides specific guidance on loops and iteration, which is especially important for LLM code generation.

#### Use `for...of` when:

1. **You need `await` (sequential async operations)**
   ```typescript
   // ✅ CORRECT - for...of handles await properly
   for (const field of fields) {
     await processField(field) // Waits for each field sequentially
   }

   // ❌ WRONG - forEach doesn't wait, fires all promises in parallel
   fields.forEach(async (field) => {
     await processField(field) // All promises fire at once!
   })
   ```

2. **You need early termination (`break` or `continue`)**
   ```typescript
   // ✅ CORRECT - can use continue/break
   for (const item of items) {
     if (shouldSkip(item)) continue
     if (shouldStop(item)) break
     process(item)
   }

   // ❌ WRONG - forEach doesn't support break/continue
   items.forEach((item) => {
     if (shouldSkip(item)) return // can't use continue
     // No way to break early
   })
   ```

3. **You need index or other control flow**
   ```typescript
   // ✅ CORRECT - can access index if needed
   for (const [index, item] of items.entries()) {
     if (index === 0) continue
     process(item)
   }
   ```

#### Use `.forEach()` when:

1. **Side effects without await (parallel async is fine)**
   ```typescript
   // ✅ CORRECT - pushing promises into array for Promise.all()
   const promises: Promise<void>[] = []
   fields.forEach((field) => {
     promises.push(processField(field)) // Fire all promises
   })
   await Promise.all(promises) // Wait for all at once
   ```

2. **Simple iteration without control flow needs**
   ```typescript
   // ✅ CORRECT - simple side effect
   items.forEach((item) => {
     console.log(item)
   })
   ```

3. **Functional style preference (when no async/control flow)**
   ```typescript
   // ✅ CORRECT - functional style for simple operations
   Object.entries(sort).forEach(([key, direction]) => {
     sortConditions.push(`"${key}" ${direction === '-1' ? 'DESC' : 'ASC'}`)
   })
   ```

#### Use `.map()`, `.filter()`, `.reduce()` when:

1. **Transforming arrays**
   ```typescript
   // ✅ CORRECT - map for transformation
   const names = users.map((user) => user.name)
   ```

2. **Filtering arrays**
   ```typescript
   // ✅ CORRECT - filter for filtering
   const adults = users.filter((user) => user.age >= 18)
   ```

3. **Accumulating values**
   ```typescript
   // ✅ CORRECT - reduce for accumulation
   const total = numbers.reduce((sum, num) => sum + num, 0)
   ```

### Recommended Default: `for...of`

**Reasoning:**
1. Works correctly with `await`
2. Supports `break`/`continue`
3. More performant than `forEach` in most cases
4. Clearer intent for sequential processing

### Common Refactoring Patterns

#### Before (Problematic):
```typescript
// ❌ WRONG - forEach with async
fields.forEach(async (field) => {
  await processField(field)
})
```

#### After (Correct):
```typescript
// ✅ CORRECT - for...of with await
for (const field of fields) {
  await processField(field)
}
```

#### Or (If Parallel is Desired):
```typescript
// ✅ CORRECT - map for parallel execution
const promises = fields.map((field) => processField(field))
await Promise.all(promises)
```

### Enforcement with Linting

Add to your ESLint config to catch common mistakes:

```json
{
  "rules": {
    "prefer-for-of": "error",
    "no-await-in-loop": "off",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.property.name='forEach'][arguments.0.params.length=2]",
        "message": "Avoid forEach with async/await. Use for...of instead."
      }
    ]
  }
}
```

---

## Pre-Commit Guidelines

Before committing:

1. **Format code**: `pnpm format` or `pnpm lint:fix`
2. **Run linting**: `pnpm lint`
3. **Fix any errors**: ESLint and Biome will report issues

---

## CI/CD Integration

The CI pipeline runs:

1. **Biome**: `pnpm lint:biome` (checks formatting and Biome linting)
2. **ESLint**: `pnpm lint:eslint` (type-aware checks for apps/packages source)

Both must pass for CI to succeed.

---

## Troubleshooting

### ESLint "Cannot find module 'dev/eslint'"

Ensure `dev` workspace package is installed:
```bash
pnpm install
```

### Type-aware rules not working

Ensure your package has a `tsconfig.json` and files are included in the `include` array.

### Formatting conflicts

Never use `eslint --fix`. Always use `biome format --write .` for formatting.

### Cache issues

Clear ESLint cache:
```bash
rm -rf .eslintcache
```

Clear Biome cache:
```bash
rm -rf node_modules/.cache/biome
```

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

---

## Package-Specific Notes

### Apps

- Use local `eslint.config.js`/`eslint.config.mjs` plus the shared `dev/eslint` config
- Next apps add `@next/eslint-plugin-next` rules (core web vitals)

### Packages

- Use the `lint:eslint` script (`eslint .`)
- Extend shared config from `dev/eslint`
- Package-specific ignores in local `eslint.config.*`

---

## Best Practices

1. **Always run `pnpm format` before committing**
2. **Fix linting errors before pushing**
3. **Don't disable rules without justification**
4. **Keep ignore patterns minimal** (prefer fixing issues over ignoring)

---

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

---

## Migration Notes

**Changed from**: Previously, some packages used `biome lint .` for linting.

**Changed to**: Each package/app owns an `eslint.config.*` and a `lint:eslint` script; the root `pnpm lint:eslint` runs them via Turbo.

**Formatting**: Biome still handles all formatting (unchanged).

---

## Related Documentation

- [OBSERVABILITY.md](./OBSERVABILITY.md) - Error handling and logging standards
- [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) - Documentation guidelines
- [MODULE_RESOLUTION_STRATEGY.md](./MODULE_RESOLUTION_STRATEGY.md) - Module resolution patterns
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
- [Testing Strategy](../testing/TESTING_STRATEGY.md) - Testing requirements
- [ESLint Config](../../packages/dev/src/eslint/eslint.config.js) - Shared ESLint configuration
- [Biome Config](../../biome.json) - Biome configuration
