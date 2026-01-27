# Code Style Guidelines: Loops and Iteration

## Current Situation

The codebase uses both `for...of` loops and `.forEach()` array methods. This document clarifies when to use each and how to enforce consistency.

---

## When to Use `for...of` vs `.forEach()`

### Use `for...of` when:

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

### Use `.forEach()` when:

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

### Use `.map()`, `.filter()`, `.reduce()` when:

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

---

## Field Traversal Code Analysis

Looking at `packages/revealui/src/cms/core/fieldTraversal.ts`:

```typescript
// ✅ CORRECT - for...of is the right choice here because:
for (const field of fields) {
  if (callback) {
    const shouldContinue = callback(field, fieldPath)
    if (shouldContinue === false) {
      continue // ← Need continue (can't do this with forEach)
    }
  }
  await processField(field, fieldPath, result, mode) // ← Need await (forEach doesn't wait)
  result.traversed++
  result.found.push(field)
}
```

**Why `for...of` is correct:**
1. Uses `await` for sequential processing (line 67)
2. Uses `continue` for early termination (line 61)
3. Needs sequential error handling (try/catch per item)

**If we used `.forEach()` instead:**
```typescript
// ❌ WRONG - This would be incorrect
fields.forEach(async (field) => {
  if (callback && callback(field, fieldPath) === false) {
    return // Can't use continue, but return doesn't stop the loop
  }
  await processField(field, fieldPath, result, mode) // Doesn't wait!
  result.traversed++ // Race condition!
})
```

---

## Comparison with Existing Code

Looking at `packages/revealui/src/cms/fields/hooks/afterRead/traverseFields.ts`:

```typescript
// ✅ CORRECT - uses forEach because it pushes promises (parallel execution)
fields.forEach((field, fieldIndex) => {
  fieldPromises.push(
    promise({ ... }) // Push promise, don't await
  )
})
// Later: await Promise.all(fieldPromises) - executes in parallel
```

**Why `.forEach()` is correct here:**
1. No `await` in the loop
2. Pushes promises into array for `Promise.all()` (parallel execution desired)
3. No need for `break`/`continue`

---

## Enforcing Consistent Style

### Option 1: Biome Linting Rules (Recommended)

Add rules to `biome.json`:

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useForOf": "error" // Prefer for...of over traditional for loops
      },
      "suspicious": {
        "noArrayIndexKey": "warn", // Warn about array index in keys
        "noForEach": "off" // Allow forEach (we need it for parallel async)
      }
    }
  }
}
```

However, Biome doesn't have a rule to prefer forEach over for...of (and we don't want that anyway - for...of is better for async).

### Option 2: ESLint Rules (if using ESLint)

```json
{
  "rules": {
    "prefer-for-of": "error", // Prefer for...of over traditional for
    "no-await-in-loop": "off", // We need await in loops for sequential processing
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

### Option 3: Custom Lint Rule (Advanced)

Create a custom ESLint rule to detect problematic patterns:

```javascript
// eslint-plugin-revealui/require-for-of-for-async.js
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require for...of instead of forEach when using await",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.property?.name === 'forEach' &&
          node.arguments[0]?.async === true
        ) {
          context.report({
            node,
            message: "Use for...of instead of forEach when using await",
          });
        }
      },
    };
  },
};
```

---

## Recommended Default Style

### Default Preference: `for...of`

**Reasoning:**
1. Works correctly with `await`
2. Supports `break`/`continue`
3. More performant than `forEach` in most cases
4. Clearer intent for sequential processing

### When to Use `.forEach()`:

1. **Parallel async execution** (pushing promises for `Promise.all()`)
2. **Simple side effects** without async/control flow
3. **Functional style** preference for simple operations

### Always Use Array Methods When:

1. **Transforming**: Use `.map()`
2. **Filtering**: Use `.filter()`
3. **Accumulating**: Use `.reduce()`
4. **Finding**: Use `.find()` or `.findIndex()`
5. **Checking**: Use `.some()` or `.every()`

---

## Example Refactoring

### Before (Problematic):
```typescript
// ❌ WRONG - forEach with async
fields.forEach(async (field) => {
  await processField(field)
})
```

### After (Correct):
```typescript
// ✅ CORRECT - for...of with await
for (const field of fields) {
  await processField(field)
}
```

### Or (If Parallel is Desired):
```typescript
// ✅ CORRECT - forEach pushing promises
const promises = fields.map((field) => processField(field))
await Promise.all(promises)

// Or:
const promises: Promise<void>[] = []
fields.forEach((field) => {
  promises.push(processField(field))
})
await Promise.all(promises)
```

---

## Summary

**For field traversal code:**
- ✅ `for...of` was the **correct** choice
- ✅ Uses `await` for sequential processing
- ✅ Uses `continue` for early termination
- ✅ Proper error handling

**Enforcement Strategy:**
- Document the guidelines (this file)
- Add linting rules to catch common mistakes
- Code review to ensure consistency
- Consider custom lint rule for async forEach patterns

**No changes needed** to the field traversal implementation - it's using the correct pattern!
