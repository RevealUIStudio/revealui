# Unused Declarations Policy (HARDLINE)

**Status:** HARDLINE for every session (Claude, Grok, Cursor, any adapter). Owner
directive 2026-07-29. Thoroughness is non-negotiable. Laziness is rejected.

## Core rule

**NEVER silence an unused variable, parameter, or import by renaming it with a
leading underscore (`_line`, `_unused`, `_event`) when the honest fix is to
implement the value, redesign the API, or delete dead code.**

Biome and many linters *allow* underscore-prefixed names as unused. That
exception is **not** permission to skip work. This codebase treats
underscore-silence as a policy violation equal to biome-ignore on a TODO stub.

Unused declarations usually mean **incomplete implementation**, not "noise to
mute." Thorough agents implement. Lazy agents rename to `_x` and move on.

Companion: quality-over-speed (reduce scope, never quality).

---

## Mandatory decision tree

When you see `noUnusedVariables`, `noUnusedParameters`, TS6133, or any
"declared but never read" diagnostic, **before any edit**:

```
1. Should this value drive logic that is missing?
   └─ Signs: parameter is in the public API, named for a real concern (line,
             path, token, id), body only uses a sibling arg, or adjacent tests
             expect behavior from this input
   └─ Action: IMPLEMENT using the parameter. Empty short-circuit, validation,
              error paths, and detectors all count as real use. Do not prefix `_`.

2. Do you control the function signature?
   └─ Yes, and the param is unnecessary → REMOVE it from the signature and
      update every call site in the same change. Prefer a smaller honest API.
   └─ Yes, and the param is needed later in the same PR → implement now.

3. Is the import type-only?
   └─ Action: `import type { ... }` (not underscore rename).

4. Is it genuinely dead with no planned use?
   └─ Action: DELETE the declaration and call sites. No grace period.

5. Is the parameter forced by a host callback signature you cannot change?
   └─ Signs only: framework-mandated arity (e.g. Express `(err, req, res, next)`
      when you only need `next`), or an interface you implement but do not own
   └─ Action: prefix `_` **only then**, and add a one-line comment naming the
      host signature. This is the sole underscore carve-out for parameters.

6. Is it an intentional side-effect binding (IaC / must construct)?
   └─ Action: `_` prefix **only with** a comment explaining the side effect.
      Never use this for application logic params.
```

If none of 5–6 apply, **underscore is forbidden**.

---

## Explicitly rejected (every session)

- `_line`, `_req`, `_unused`, `_args` to quiet TS6133 / Biome when you own the API
- `// biome-ignore ... noUnusedVariables: TODO`
- "I'll wire it later" after renaming to `_`
- Deleting a stub that represents required behavior without implementing it
- Partial fixes that leave the thorough path for "someone else"

---

## What implement means

1. Search related types, tests, and call sites for intent.
2. Use the parameter in real control flow (validate, short-circuit, detect, log
   structured fields, pass through). Empty `line.trim()` guards are valid when
   they match the audit contract.
3. Typecheck + Biome + tests for the package before moving on.
4. Prefer one correct change over a silent underscore.

---

## Examples

### Wrong — silence the audit string
```ts
export function findHits(_line: string, tokens: Token[]): Hit[] {
  return detect(wordTexts(tokens));
}
```

### Right — use the line (empty short-circuit is real use)
```ts
export function findHits(line: string, tokens: Token[]): Hit[] {
  if (line.trim().length === 0) return [];
  return detect(wordTexts(tokens));
}
```

### Wrong — mute a stub
```ts
// biome-ignore lint/correctness/noUnusedVariables: TODO
const semanticMemory = new SemanticMemory()
```

### Right — implement
```ts
const semanticMemory = new SemanticMemory()
await semanticMemory.store('key', content, embedding)
```

### Allowed underscore (host-mandated only)
```ts
// Hono error handler arity is fixed by the framework; body only needs err.
app.onError((_req, err) => respond(err))
```

---

## Verification (mandatory before next task)

```bash
pnpm --filter <package> typecheck
pnpm exec biome check <file>
pnpm --filter <package> test   # if behavior changed
```

---

## Relationship

- **quality-over-speed** — thoroughness outranks session throughput
- **code-over-docs** — unused params that should affect behavior are incomplete product
- **durable-solutions** — underscore silence is a temporary shape; refuse it
