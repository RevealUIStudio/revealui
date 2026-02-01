# TypeScript Strict Mode Migration Guide

This document covers the TypeScript strict mode configuration and migration strategy for the RevealUI monorepo.

**Last Updated:** 2026-01-31

---

## Table of Contents

1. [Current State](#current-state)
2. [Why Strict Mode Matters](#why-strict-mode-matters)
3. [Migration Strategy](#migration-strategy)
4. [Implementation Checklist](#implementation-checklist)
5. [Testing Strategy](#testing-strategy)
6. [Risk Mitigation](#risk-mitigation)
7. [Success Metrics](#success-metrics)
8. [Timeline](#timeline)
9. [Best Practices](#best-practices)

---

## Current State

### Packages with Strict Mode Disabled

**`packages/ai`**
```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false
  }
}
```

**Reason:** Complex AI and vector memory types make strict mode migration challenging.

### All Other Packages

All other packages in the monorepo have strict mode enabled.

## Why Strict Mode Matters

### Benefits

1. **Type Safety** - Catch potential bugs at compile time
2. **Better IDE Support** - Improved autocomplete and refactoring
3. **Maintainability** - Clearer code contracts and interfaces
4. **Onboarding** - Easier for new developers to understand code

### Current Issues in packages/ai

- **Implicit Any Types** - Many AI/vector functions have `any` parameters
- **Null/Undefined Handling** - Optional chaining and null checks missing
- **Function Return Types** - Some functions lack explicit return type annotations
- **Type Assertions** - Overuse of type assertions (`as Type`) to bypass checks

## Migration Strategy

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 8-12 hours
**Target:** Q2 2026

### Phase 1: Audit and Categorize (2 hours)

Run TypeScript with strict mode enabled and categorize errors:

```bash
cd packages/ai
npx tsc --noEmit --strict --listFiles > /tmp/ai-strict-errors.txt 2>&1
```

**Expected error categories:**
1. Implicit any parameters
2. Null/undefined issues
3. Missing return types
4. Unsafe type assertions
5. Indexing issues (`element implicitly has 'any' type`)

**Deliverable:** Document categorizing all errors by file and type.

### Phase 2: Fix Low-Hanging Fruit (2-3 hours)

**Priority order:**
1. Add explicit return types to all exported functions
2. Replace `any` with proper types for simple cases
3. Add null checks where TypeScript identifies potential null access
4. Fix indexing issues with proper type guards

**Example fixes:**
```typescript
// Before
function embedText(text) {
  return vectorService.embed(text)
}

// After
function embedText(text: string): Promise<number[]> {
  return vectorService.embed(text)
}
```

### Phase 3: Define Complex Types (3-4 hours)

**Focus areas:**

1. **Vector Memory Types**
   - `EmbeddingVector`, `VectorSearchResult`, `MemoryChunk`
   - Create proper interfaces instead of `any`

2. **LLM Response Types**
   - OpenAI/Anthropic response shapes
   - Streaming response handlers

3. **Observability Types**
   - Span contexts, trace metadata
   - Instrumentation data structures

**Strategy:**
- Create `src/types/` directory for shared types
- Use branded types for IDs (`type MemoryId = string & { __brand: 'MemoryId' }`)
- Leverage utility types (`Partial`, `Pick`, `Omit`)

### Phase 4: Enable Strict Null Checks (2-3 hours)

Enable incrementally:
```json
{
  "compilerOptions": {
    "strict": false,
    "strictNullChecks": true,
    "noImplicitAny": false
  }
}
```

**Common patterns to fix:**
```typescript
// Before
const memory = await getMemory(id)
return memory.content  // Error: memory might be null

// After
const memory = await getMemory(id)
if (!memory) throw new Error('Memory not found')
return memory.content
```

### Phase 5: Enable Full Strict Mode (1 hour)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

Run tests, fix any remaining issues, verify all checks pass.

## Implementation Checklist

### Before Starting
- [ ] Ensure AI package has comprehensive test coverage (currently approximately 60%)
- [ ] Create a separate branch for migration
- [ ] Run baseline tests to ensure all pass

### During Migration
- [ ] Phase 1: Audit complete, errors categorized
- [ ] Phase 2: Low-hanging fruit fixed
- [ ] Phase 3: Complex types defined
- [ ] Phase 4: Strict null checks enabled
- [ ] Phase 5: Full strict mode enabled
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Code review completed

### After Migration
- [ ] Update documentation with new type patterns
- [ ] Add contributing guidelines about strict mode
- [ ] Monitor for any runtime issues in production
- [ ] Remove technical debt issue from backlog

## Testing Strategy

### Test Coverage Requirements
- Maintain or improve current coverage (approximately 60% to 70%+)
- Add tests for newly typed functions
- Focus on edge cases revealed by strict mode

### Verification Steps
```bash
# 1. Type check passes
pnpm --filter @revealui/ai typecheck

# 2. Unit tests pass
pnpm --filter @revealui/ai test

# 3. Integration tests pass
pnpm test

# 4. Build succeeds
pnpm --filter @revealui/ai build
```

## Risk Mitigation

### Potential Issues

1. **Breaking changes** in type signatures
   - Mitigation: Semantic versioning, changelog updates
2. **Performance overhead** from runtime type guards
   - Mitigation: Benchmark critical paths, optimize guards
3. **Development velocity slowdown** during migration
   - Mitigation: Time-box each phase, allow for flexibility

### Rollback Plan
- Keep pre-migration branch available
- If issues arise, temporarily disable strict mode
- Complete migration in smaller increments

## Success Metrics

### Quantitative
- [ ] 0 TypeScript errors with `--strict` flag
- [ ] Test coverage greater than or equal to 70%
- [ ] Build time unchanged (within 5%)
- [ ] No production incidents related to type changes

### Qualitative
- [ ] Developers report better IDE experience
- [ ] Fewer runtime type errors in production
- [ ] Easier onboarding for new team members

## Timeline

| Phase | Duration | Target Completion |
|-------|----------|-------------------|
| Phase 1: Audit | 2 hours | Week 1 |
| Phase 2: Low-hanging fruit | 2-3 hours | Week 1-2 |
| Phase 3: Complex types | 3-4 hours | Week 2-3 |
| Phase 4: Strict null checks | 2-3 hours | Week 3 |
| Phase 5: Full strict mode | 1 hour | Week 4 |
| Testing and Review | 2 hours | Week 4 |
| **Total** | **12-15 hours** | **Q2 2026** |

## Best Practices

### DO ✅

1. Consider migrating during a low-velocity sprint
2. Use pair programming for complex type definitions
3. Document patterns in a "Type Patterns" guide for the team
4. Test incrementally after each phase

### DON'T ❌

1. Rush the migration - type safety requires careful consideration
2. Over-use type assertions to bypass errors
3. Ignore test coverage - maintain or improve it during migration

## Resources

- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/tsconfig#strict)
- [Type Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

---

## Related Documentation

- [Development Overview](./README.md) - Development navigation hub
- [Module Resolution](./MODULE_RESOLUTION.md) - Path aliases and module resolution
- [Standards Guide](../standards/STANDARDS.md) - Code standards and best practices
- [Master Index](../INDEX.md) - Complete documentation index

---

**Last Updated:** 2026-01-31
**Part of:** Development Guide consolidation
