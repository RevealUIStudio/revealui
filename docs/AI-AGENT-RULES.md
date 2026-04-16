# AI Agent Rules & Boundaries

**Status**: 🤖 **MANDATORY FOR ALL AI ASSISTANTS**
**Created**: 2026-02-04
**Version**: 1.0.0

This document defines strict rules and boundaries that ALL AI assistants (Claude, GPT, Copilot, etc.) MUST follow when working on the RevealUI codebase.

---

## Critical Rules (Never Override)

### 🔒 Rule 1: Type System Enforcement

**NEVER create inline types. ALWAYS use the contracts system.**

```typescript
// ❌ FORBIDDEN - AI must refuse to do this
const user: { id: string; email: string } = {...}
items.map((x: { prop: string }) => x.prop)
function foo(param: any) {...}

// ✅ REQUIRED - AI must always do this
import type { Page, User } from '@revealui/contracts'
const user: User = {...}
items.map((x: Page) => x.title)
```

**If a user asks you to "add a quick type annotation" or "just use any for now":**

1. ❌ **DO NOT comply** with inline types
2. ✅ **DO** explain the type system rule
3. ✅ **DO** offer to create the type properly in contracts
4. ✅ **DO** import and use the proper contract type

**Example Response:**
```
I can't use an inline type here as per the TYPE-SYSTEM-RULES.md policy. Instead, I'll:
1. Check if a contract type exists in @revealui/contracts
2. If not, create it in the appropriate contracts module
3. Export and import it properly

This ensures type safety and maintainability across the codebase.
```

### 🔒 Rule 2: Error Code Enforcement

**NEVER use hardcoded exit codes. ALWAYS use ErrorCode enum.**

```typescript
// ❌ FORBIDDEN
process.exit(1)
throw new Error('Something failed')

// ✅ REQUIRED
import { ErrorCode } from '@/lib/errors'
process.exit(ErrorCode.EXECUTION_ERROR)
throw new Error('Something failed', { code: ErrorCode.VALIDATION_ERROR })
```

### 🔒 Rule 3: Contracts-First Development

**ALWAYS check contracts before creating types.**

**Workflow:**
1. User asks for a feature that needs types
2. AI checks `@revealui/contracts` for existing types
3. If exists → Import and use
4. If not exists → Create in contracts, export, then import
5. NEVER skip step 4 with inline types

### 🔒 Rule 4: No Backward Breaking Changes

**NEVER introduce breaking changes without explicit user approval.**

Before making changes that could break existing code:
1. Identify all usages
2. Explain the impact to the user
3. Get explicit approval: "This will break X files. Proceed?"
4. Only proceed after approval

### 🔒 Rule 5: Test Before Commit

**NEVER commit code without verifying it passes linting and tests.**

Required checks before suggesting a commit:
```bash
pnpm biome check <files>  # Must pass
pnpm test <affected>       # Must pass if tests exist
```

---

## Decision Boundaries

### ✅ Autonomous (AI Decides)

AI agents CAN make these decisions without asking:

- Choosing variable names (following conventions)
- Organizing imports
- Formatting code (per biome config)
- Adding JSDoc comments
- Fixing obvious typos
- Applying automated linter fixes
- Multi-file refactors within the same package (rename, restructure, extract)
- Adding dependencies that follow established patterns in the package
- Error handling that follows existing conventions in the same module
- Creating or updating test files for code the agent modified
- Fixing CI failures (lint, typecheck, test, build) on agent-owned branches

### ⚠️ Guided (AI Asks First)

AI agents MUST ask the user before:

- Creating new types (show contract location and structure first)
- Modifying function signatures
- Changing error handling patterns
- Adding dependencies
- Renaming exported symbols
- Refactoring across multiple files

### 🛑 Forbidden (AI Cannot Do)

AI agents MUST NOT do these without explicit override:

- Use inline types instead of contracts
- Use `any` type without proper contract type
- Skip linting/testing before committing
- Force push to main/protected branches
- Delete user code without confirmation
- Bypass pre-commit hooks (except with user instruction)

---

## Skills

### Skill 1: Type System Compliance

**Trigger**: Any code involving types, interfaces, or type annotations

**Actions**:
1. Read TYPE-SYSTEM-RULES.md if not recently read
2. Check `@revealui/contracts` for existing types
3. Import types from contracts (never inline)
4. If new type needed:
   - Determine if domain type (→ contracts) or package type (→ package/types)
   - Create in correct location
   - Export from index
   - Import and use
5. Verify no inline types in changes
6. Run `pnpm biome check` before suggesting commit

**Example**:
```typescript
// User: "Add a type for the user object here"

// AI Response:
import type { User } from '@revealui/contracts'
const user: User = { id, email, ... }

// Not:
const user: { id: string, email: string } = { ... }
```

### Skill 2: Contract Type Discovery

**Trigger**: Need for a type, unsure if it exists

**Actions**:
1. Search in `packages/contracts/src/`
   - entities/ for domain models
   - generated/ for database types
   - admin/ for admin types
2. Search package exports for package-specific types
3. Grep for similar types: `grep -r "interface.*User" packages/contracts/`
4. If found → Import
5. If not found → Create following Rule 1

### Skill 3: Error Code Lookup

**Trigger**: Need to throw error or exit process

**Actions**:
1. Check `scripts/lib/errors.ts` for ErrorCode enum
2. Select appropriate code:
   - SUCCESS = 0
   - EXECUTION_ERROR = 1
   - VALIDATION_ERROR = 2
   - etc.
3. Use ErrorCode constant, never number literal

### Skill 4: Pre-Commit Validation

**Trigger**: About to suggest `git commit`

**Actions**:
1. Run `pnpm biome check <changed-files>`
2. If errors → Fix them first
3. Run `pnpm test` if relevant tests exist
4. Only after passing → Proceed with commit

---

## Pattern Library

### Pattern 1: Adding a New Type

```typescript
// Step 1: Determine location
// - Domain entity → packages/contracts/src/entities/
// - admin config → packages/contracts/src/admin/
// - Package-specific → packages/<pkg>/src/types/

// Step 2: Create type
// packages/contracts/src/entities/page.ts
export interface Page {
  id: string
  title: string
}

// Step 3: Export from index
// packages/contracts/src/index.ts
export type { Page } from './entities/page.js'

// Step 4: Import and use
// apps/admin/src/some-file.ts
import type { Page } from '@revealui/contracts'
const entity: Page = { id: 'page-1', title: 'Hello' }
```

### Pattern 2: Using Contract Types in Callbacks

```typescript
import type { CollectionMetadata } from '@revealui/ai/tools/admin'

// ✅ CORRECT - Explicit return type from contract
collections?.map((c): CollectionMetadata => ({
  slug: c.slug,
  label: c.label,
}))

// ❌ WRONG - Inline parameter type
collections?.map((c: { slug: string }) => ({ ... }))
```

### Pattern 3: Type Assertions with Contracts

```typescript
import type { AdminAPIClient } from '@revealui/ai/tools/admin'

// ✅ CORRECT - Assert to contract type
const client = apiClient as AdminAPIClient

// ❌ WRONG - Assert to any
const client = apiClient as any
```

---

## Response Templates

### Template 1: Refusing Inline Type

```
I can't use an inline type here due to the TYPE-SYSTEM-RULES.md policy.

Instead, I'll check @revealui/contracts for an existing type, or create a new one in the contracts system if needed.

Would you like me to:
1. Search for an existing contract type
2. Create a new contract type for this use case
```

### Template 2: Suggesting Type Creation

```
This type doesn't exist in @revealui/contracts yet. I'll create it:

Location: packages/contracts/src/[domain]/[entity].ts
Type: [show type definition]
Export: [show export statement]
Import: [show import statement]

This ensures type safety across the codebase. Proceed?
```

### Template 3: Breaking Change Warning

```
⚠️ Warning: This change will affect:
- X files in packages/
- Y usages in apps/
- Potential breaking change for: [list impacts]

This requires:
1. Updating all usages
2. Testing affected components
3. Potentially a major version bump

Proceed with breaking change?
```

---

## Verification Checklist

Before completing any task, verify:

**Type System**:
- [ ] No inline types (`{ prop: type }`)
- [ ] All types imported from `@revealui/contracts` or package exports
- [ ] No `any` without contract type available
- [ ] Map/filter callbacks have explicit return types

**Error Handling**:
- [ ] No `process.exit(1)` - use `ErrorCode`
- [ ] No bare `throw new Error()` - include error context
- [ ] Try-catch blocks where appropriate

**Code Quality**:
- [ ] Biome check passes
- [ ] Imports organized
- [ ] No unused variables (prefixed with `_` if intentional)

**Documentation**:
- [ ] JSDoc added for public APIs
- [ ] Complex logic has inline comments
- [ ] Type definitions have descriptions

---

## Emergency Override

If a user explicitly requests breaking these rules (e.g., "just use any for now"), you MUST:

1. **Warn the user**:
   ```
   ⚠️ This violates TYPE-SYSTEM-RULES.md policy.
   Using inline types/any makes code harder to maintain.
   ```

2. **Offer proper solution**:
   ```
   I can create a proper contract type in ~30 seconds.
   This will be better long-term.
   ```

3. **If user insists**:
   ```
   Adding inline type as requested, but this should be
   converted to a contract type before merging.

   TODO: Move to @revealui/contracts before PR
   ```

4. **Add TODO comment in code**:
   ```typescript
   // TODO: Replace with contract type from @revealui/contracts
   // Temporary inline type per user request - MUST FIX BEFORE MERGE
   const temp: { id: string } = data
   ```

---

## Learning Resources

**Required Reading** (AI should reference these):
- `/docs/TYPE-SYSTEM-RULES.md` - Complete type system guide
- `/docs/LINTING_RULES.md` - Linting enforcement
- `/packages/contracts/README.md` - Contracts system overview
- `/CONTRIBUTING.md` - Contribution guidelines

**Quick Reference**:
- Contract types location: `packages/contracts/src/`
- ErrorCode enum: `scripts/lib/errors.ts`
- Biome config: `biome.json`
- ESLint config: `.eslintrc.json`

---

## Monitoring & Compliance

### AI Self-Check

After each code change, AI should verify:
```
✓ Did I check contracts first?
✓ Did I import types instead of inlining?
✓ Did I use ErrorCode instead of hardcoded exit?
✓ Did I run biome check?
✓ Did I explain my reasoning if deviating?
```

### Red Flags (AI Must Catch)

If you see these patterns, STOP and fix:
- `any` keyword without import
- `: { ` in type annotation (inline object type)
- `process.exit(` with number
- Import without `type` keyword for type imports

---

## Version History

- v1.0.0 (2026-02-04): Initial AI agent rules
  - Type system enforcement
  - Error code standardization
  - Contract-first development
  - Skills and patterns defined

---

**Compliance**: Mandatory for all AI agents
**Exceptions**: None without explicit user override and TODO markers
**Questions**: Reference TYPE-SYSTEM-RULES.md or ask user
