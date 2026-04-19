---
'@revealui/core': patch
---

Fix the instance-level `create()` method to honor `options.overrideAccess`.

The low-level `collections/operations/create.ts` already short-circuits its `access.create` check when `overrideAccess: true` is passed, but the instance-level `instance/methods/create.ts` did not — so bootstrap, migrations, and other trusted internal callers would hit *"Access denied: you do not have permission to create in this collection"* at the instance level *before* ever reaching the low-level guard. Paired with #382 (which fixed the low-level overrideAccess propagation) and #384 (which fixed the read-after-write transaction wrap), this completes the chain that lets the bootstrap flow create the first admin user against a fresh database.

Change is a one-line condition in `instance/methods/create.ts`: the access check now only fires when `!options.overrideAccess`. Mirrors the pattern in `collections/operations/create.ts:31`.

Complementary change in the low-level `collections/operations/create.ts`: the post-INSERT `findByID` read-back now passes `overrideAccess: true`. Without this, the just-created doc would immediately face a second access-control check that had no `req` context (bootstrap has no authenticated user) and would therefore deny.

Regression tests added in `instance/methods/__tests__/create.test.ts` verify both directions — access denied when `overrideAccess` is unset, check skipped when `overrideAccess: true`. The low-level `collections/operations/__tests__/create.test.ts` assertions on the `findByID` call signature were updated to include the new `overrideAccess: true` parameter.
