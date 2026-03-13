# Typed Collection Storage Migration Plan

## Objective

Reduce runtime dynamic SQL in `packages/core/src/collections/operations/*` by moving first-party collections onto typed Drizzle-backed storage while preserving the public collection API.

## Work Items

1. Build collection registry
   - add slug -> Drizzle table mappings
   - add per-collection allowed column metadata
   - keep unknown collections on dynamic fallback

2. Migrate typed read paths
   - move `find`
   - move `findByID`
   - verify relationship population and hook behavior stays unchanged

3. Migrate typed write paths
   - move `create`
   - move `update`
   - move `delete`
   - preserve password hashing and JSON field semantics

4. Add visibility
   - log or count which collection slugs still use dynamic storage
   - fail review for new first-party collections added to the dynamic path

## Suggested Order

1. `sites`
2. `pages`
3. `posts`
4. `media`
5. `users`

That order keeps the highest-value CMS surfaces early while leaving the most security-sensitive collection (`users`) for after the typed path is proven.

## Guardrails

- keep `sqlAdapter.ts` as the only dynamic SQL entrypoint during migration
- do not add new inline SQL back into collection operations
- keep `revealui.find/create/update/delete` signatures stable

## Done When

- first-party CMS collections use typed storage
- the dynamic adapter is compatibility-only
- new runtime collection work defaults to Drizzle-backed storage
