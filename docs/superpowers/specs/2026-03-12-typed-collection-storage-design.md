# Typed Collection Storage Design

## Problem

`packages/core/src/collections/operations/*` currently serves a high-level CMS API used throughout `apps/cms`, but it executes against runtime-selected table names derived from `config.slug`.

That creates two problems:

1. application runtime code cannot use `drizzle-orm` directly in this layer because Drizzle expects compile-time table definitions
2. the collection engine remains a quarantined dynamic SQL boundary in otherwise Drizzle-first runtime code

The current `sqlAdapter.ts` is acceptable as a temporary containment measure, but it is still redesign debt.

## Current Constraint

The collection API is widely used:

- page and post rendering paths
- admin hooks and utilities
- tenant creation and auth-adjacent hooks
- GDPR export/delete flows
- test helpers and integration paths

Because of that reach, a flag-day rewrite is not realistic.

## Goal

Move the collection engine toward typed storage boundaries that Drizzle can model directly, while preserving the existing high-level `revealui.find/create/update/delete` API during migration.

## Target Architecture

### 1. Keep the public collection API stable

Call sites should continue to use:

- `revealui.find`
- `revealui.findByID`
- `revealui.create`
- `revealui.update`
- `revealui.delete`

### 2. Introduce a typed collection registry

Instead of resolving arbitrary tables from `config.slug` at runtime, build a registry at startup:

- `collection slug -> typed table definition`
- `collection slug -> allowed columns`
- `collection slug -> JSON field mapping`
- `collection slug -> relationship metadata`

This registry becomes the bridge from config-driven CMS semantics to Drizzle-typed storage.

### 3. Split storage implementations

Use two explicit storage paths:

- `typedCollectionStorage`
  For first-party collections backed by known Drizzle tables.
- `dynamicCollectionStorage`
  Temporary fallback for legacy or untyped collections.

The existing `sqlAdapter.ts` should become the implementation detail of `dynamicCollectionStorage`, not the implicit default.

### 4. Prefer typed storage for first-party collections

Start with the collections that matter most operationally:

- `users`
- `pages`
- `posts`
- `sites`
- `media`

These are the collections with the highest runtime traffic and the clearest schema ownership.

## Migration Plan

### Phase 1: Registry

- add a startup-built collection registry in `packages/core`
- map known collection slugs to Drizzle tables
- keep unknown collections on dynamic storage

### Phase 2: Read Path

- move `find` and `findByID` for typed collections onto Drizzle
- preserve hook execution and relationship population behavior
- keep response shapes identical

### Phase 3: Write Path

- move `create`, `update`, and `delete` for typed collections onto Drizzle
- preserve field hooks, password hashing, and JSON field behavior
- keep dynamic fallback for collections not yet migrated

### Phase 4: Cut Down Dynamic Surface

- track which collection slugs still hit `dynamicCollectionStorage`
- reduce that list intentionally
- do not add new first-party collections to the dynamic path

## Exit Criteria

The dynamic SQL boundary can stop being considered active redesign debt only when:

- first-party CMS collections use typed Drizzle-backed storage
- `sqlAdapter.ts` is limited to legacy compatibility only
- new runtime collection features are forbidden from depending on dynamic SQL

## Non-Goals

- changing the public CMS API in this migration
- removing hooks, population, or access-control semantics
- eliminating raw SQL from migrations, setup SQL, or low-level DB tests
