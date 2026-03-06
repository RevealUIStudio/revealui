# @revealui/contracts

## 1.1.0

### Minor Changes

- Add vision/multipart message support to ChatRequestContract.

  Introduces `TextPart`, `ImagePart`, and `ContentPart` schemas so message content can be either a plain string or an array of content parts (text + image_url). This aligns with the OpenAI vision API format and enables inference-snaps multimodal models (Gemma 3, Qwen 2.5 VL) to be used through the chat endpoint.

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
