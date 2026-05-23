---
"@revealui/core": minor
---

Enforce row-level access (`WhereClause`) in `findByID`, `update`, and `delete`.

When a collection's `access.read/update/delete` returns a `WhereClause` (the
documented row-ownership mechanism, e.g. `{ author: { equals: user.id } }`),
these operations previously coerced it to "allow" and acted on any id —
returning, updating, or deleting rows the filter was meant to scope out. They
now confirm the target row matches the filter (reusing the same AND-merge
`find` uses, across both storage adapters) before returning or mutating it, and
deny otherwise. `find` was already correct; boolean access rules are unaffected.
