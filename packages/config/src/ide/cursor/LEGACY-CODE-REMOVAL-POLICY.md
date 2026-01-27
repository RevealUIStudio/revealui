# Legacy Code Removal Policy

**Status**: 🔴 **TOP PRIORITY - ENFORCED PROJECT-WIDE**  
**Effective Date**: January 2025  
**Applies To**: All agent developer interactions

## Core Principle

**ALL IMPLEMENTATIONS MUST BE CURRENT. LEGACY/DEPRECATED CODE MUST BE REFACTORED TO USE NEW IMPLEMENTATIONS AND OLD CODE REMOVED.**

This is not optional. This is a **MANDATORY REQUIREMENT** for every code change, feature addition, and bug fix.

## Policy Rules

### 1. No Backward Compatibility Support

- ❌ **DO NOT** maintain old code paths "for backward compatibility"
- ❌ **DO NOT** add compatibility layers or adapters
- ❌ **DO NOT** keep deprecated functions "just in case"
- ✅ **DO** refactor all call sites to use new implementations
- ✅ **DO** remove old code immediately after migration
- ✅ **DO** update all references in a single change

### 2. Immediate Refactoring Required

When new implementations are created:

1. **Find all usages** of old/deprecated code
2. **Refactor all call sites** to use new implementation
3. **Remove old code** in the same PR/commit
4. **No grace period** - old code must be removed immediately

### 3. Deprecation = Removal

- Deprecation warnings are **NOT** acceptable long-term
- Deprecated code must be removed within the same development cycle
- If code is marked `@deprecated`, it must be removed in the next change

### 4. Migration Strategy

When migrating to new implementations:

```typescript
// ❌ BAD: Keeping old code
export function oldFunction() { /* ... */ }
export function newFunction() { /* ... */ } // Old still exists

// ✅ GOOD: Remove old, use new
export function newFunction() { /* ... */ } // Old removed
```

### 5. Agent Developer Requirements

**Every agent interaction MUST:**

1. **Check for legacy code** before making changes
2. **Refactor to new implementations** if legacy code is found
3. **Remove old code** as part of the change
4. **Update all references** to use current implementations
5. **Document the migration** in commit message

## Examples

### Example 1: API Route Migration

```typescript
// ❌ BAD: Keeping old route
export async function GET_OLD() { /* ... */ }
export async function GET() { /* ... */ }

// ✅ GOOD: Only new route exists
export async function GET() { /* ... */ }
```

### Example 2: Service Migration

```typescript
// ❌ BAD: Old service still exists
class OldNodeIdService { /* ... */ }
class NodeIdService { /* ... */ }

// ✅ GOOD: Only new service exists
class NodeIdService { /* ... */ }
```

### Example 3: Utility Function Migration

```typescript
// ❌ BAD: Old utility kept
export function getNodeIdOld() { /* ... */ }
export function getNodeId() { /* ... */ }

// ✅ GOOD: All call sites updated, old removed
export function getNodeId() { /* ... */ }
```

## Enforcement

### Code Review Checklist

Every PR must answer:

- [ ] Are there any deprecated/legacy functions in this change?
- [ ] Have all old implementations been removed?
- [ ] Have all call sites been updated to use new implementations?
- [ ] Is there any "backward compatibility" code that should be removed?

### Automated Checks

- Linter should flag `@deprecated` tags
- TypeScript should error on deprecated imports
- Tests should fail if old code paths are used

## Project-Specific Examples

### CRDT Implementation

**Old (REMOVED)**:
- `getNodeIdFromSession()` with simple hash
- `EpisodicMemory` without `embeddingMetadata`

**New (CURRENT)**:
- `NodeIdService` with SHA-256 + DB fallback
- `EpisodicMemory` with full `embeddingMetadata` support

**Action Required**: All code must use `NodeIdService`, old hash-based approach removed.

### Memory Storage

**Old (REMOVED)**:
- Storing only embedding vector
- Reconstructing metadata from vector

**New (CURRENT)**:
- Storing full `Embedding` object in `embeddingMetadata`
- Direct access to model, dimension, generatedAt

**Action Required**: All code must use `embeddingMetadata`, old reconstruction logic removed.

## Migration Priority

1. **Critical Paths**: Auth, payments, data storage
2. **Core Services**: Database, memory, CRDT operations
3. **API Routes**: All endpoints must use current implementations
4. **Utilities**: Helper functions, validators, formatters

## Agent Instructions

**When working on any task:**

1. **First**: Search for deprecated/legacy code in the area
2. **Second**: Identify new implementations that should be used
3. **Third**: Refactor all code to use new implementations
4. **Fourth**: Remove all old/deprecated code
5. **Fifth**: Verify no references to old code remain

**If you find legacy code, you MUST:**

- Refactor it as part of your current task
- Do not create a separate "migration" task
- Do not leave old code "for later"
- Remove it immediately

## Success Criteria

A codebase is "current" when:

- ✅ No `@deprecated` tags exist
- ✅ No "old" or "legacy" prefixes in function/class names
- ✅ No compatibility layers or adapters
- ✅ All code uses latest implementations
- ✅ No references to removed code paths

## Questions?

**Q: What if refactoring is too large for one PR?**  
**A**: Break it into smaller PRs, but each PR must remove old code and add new code. No PR should leave old code in place.

**Q: What about third-party dependencies?**  
**A**: This applies to our code only. Third-party deprecations are handled through dependency updates.

**Q: What if old code is still in use?**  
**A**: Find all usages, refactor them all, then remove old code. This is the only acceptable approach.

---

**Remember**: Legacy code is technical debt. Technical debt must be paid immediately, not deferred.
