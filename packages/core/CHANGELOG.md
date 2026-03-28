# @revealui/core

## 0.4.0

### Minor Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

### Patch Changes

- @revealui/contracts@1.3.1
- @revealui/security@0.2.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0
  - @revealui/cache@0.2.0
  - @revealui/resilience@0.2.0
  - @revealui/security@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of the RevealUI core framework.

  - CMS engine with collection CRUD, field traversal, and hook system (afterChange, afterRead, beforeChange, beforeValidate)
  - REST API layer with framework-agnostic handlers
  - Auth utilities (access control helpers)
  - Config system with `buildConfig` and deep merge
  - Rich text editor integration (Lexical with Bold, Italic, Underline, Link, Heading)
  - Client components for admin dashboard, collection list, and document forms
  - Universal Postgres adapter (PGlite/PostgreSQL)
  - Plugins: form builder, nested docs, redirects
  - Vercel Blob storage adapter
  - Next.js integration with `withRevealUI` config wrapper
  - Logger, LRU cache, error handling, and type guard utilities
  - License validation and feature flag system
  - Security: CSP headers, input validation, rate limiting

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/contracts@1.0.0
  - @revealui/utils@0.2.0
