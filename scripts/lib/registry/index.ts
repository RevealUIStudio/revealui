/**
 * Script Registry Module
 *
 * Exports all registry-related functionality for script discovery and metadata extraction.
 *
 * @dependencies
 * - scripts/lib/registry/script-metadata.ts - Script metadata type definitions
 * - scripts/lib/registry/script-registry.ts - Script registry implementation
 * - scripts/lib/registry/script-scanner.ts - AST-based metadata extraction
 */

export * from './script-metadata.js'
export * from './script-registry.js'
export * from './script-scanner.js'
