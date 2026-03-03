# @revealui/contracts

## 1.0.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI type contracts and Zod schemas.

  - CMS type contracts: `CollectionConfig`, `GlobalConfig`, `Field`, `Block`, access and hook types
  - Agent type contracts and definitions
  - Block types for rich text CMS content
  - Validation utilities: `defineCollection`, `defineGlobal`, `defineField`, `validateWithErrors`
  - Extensibility: `registerCustomFieldType`, `registerPluginExtension`
  - Generated entity types for all database tables (Users, Sessions, Pages, Posts, Media, etc.)
  - Zod schemas for runtime validation with TypeScript type inference

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/db@0.2.0
