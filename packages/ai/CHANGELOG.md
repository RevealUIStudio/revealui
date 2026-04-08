# @revealui/ai

## 0.2.7

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5

## 0.2.6

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3
  - @revealui/db@0.3.4

## 0.2.4

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.2.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Add `restDb` parameter to IngestionPipeline constructor for dual-database support (Neon + Supabase vector store).

  BREAKING: `IngestionPipeline` now takes 3 arguments `(db, restDb, embeddingFn)` instead of 2 `(db, embeddingFn)`.
