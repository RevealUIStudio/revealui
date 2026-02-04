/**
 * Shared Generator Utilities
 *
 * Centralized utilities for generator scripts.
 * Provides file scanning, pattern matching, and validation building.
 *
 * @dependencies
 * - scripts/lib/generators/shared/file-scanner.ts - File scanning utilities
 * - scripts/lib/generators/shared/pattern-matcher.ts - Pattern matching utilities
 * - scripts/lib/generators/shared/validation-builder.ts - Validation result builder
 *
 * @example
 * ```typescript
 * import {
 *   scanFiles,
 *   matchJSDoc,
 *   ValidationResultBuilder
 * } from './shared/index.js'
 * ```
 */

// Re-export file scanner utilities
export * from './file-scanner.js'

// Re-export pattern matcher utilities
export * from './pattern-matcher.js'

// Re-export validation builder utilities
export * from './validation-builder.js'
