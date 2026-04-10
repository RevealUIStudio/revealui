/**
 * Collection Contract
 *
 * Unified contract for Collection configurations that combines:
 * - TypeScript types (compile-time)
 * - Zod schemas (runtime validation)
 * - Validation functions
 * - Type guards
 *
 * This is the single source of truth for Collection definitions.
 *
 * @module @revealui/contracts/core/contracts/collection
 */

import { type Contract, type ContractType, createContract } from '../foundation/contract.js';
import type { CollectionConfig, Field } from './config.js';
import {
  type AuthConfig,
  COLLECTION_SCHEMA_VERSION,
  type CollectionStructure,
  CollectionStructureSchema,
  type UploadConfig,
} from './structure.js';

/**
 * Collection Contract
 *
 * This contract validates Collection configurations at runtime
 * and provides TypeScript types at compile time.
 *
 * @example
 * ```typescript
 * const PostsContract = CollectionContract
 *
 * // Validate a collection config
 * const result = PostsContract.validate(userInput)
 * if (result.success) {
 *   // result.data is fully typed as CollectionConfig
 *   console.log(result.data.slug)
 * }
 *
 * // Type guard
 * if (PostsContract.isType(unknownData)) {
 *   // unknownData is now typed as CollectionConfig
 *   console.log(unknownData.slug)
 * }
 * ```
 */
export const CollectionContract: Contract<CollectionStructure> = createContract({
  name: 'Collection',
  version: '1.0.0',
  schema: CollectionStructureSchema,
  description: 'Collection configuration contract',
  docsUrl: 'https://revealui.dev/docs/api-reference/collections',
  tags: ['collection', 'config', 'admin'],
});

/**
 * Type for Collection configuration
 * Extracted from the CollectionContract
 */
export type CollectionContractType = ContractType<typeof CollectionContract>;

/**
 * Validate a collection configuration
 *
 * @param data - Unknown data to validate
 * @returns Validation result with typed CollectionConfig on success
 *
 * @example
 * ```typescript
 * const result = validateCollection(userInput)
 * if (result.success) {
 *   const collection = result.data
 *   // collection is fully typed
 * }
 * ```
 */
export function validateCollection(data: unknown): ReturnType<typeof CollectionContract.validate> {
  return CollectionContract.validate(data);
}

/**
 * Type guard for collection configurations
 *
 * @param data - Unknown data to check
 * @returns True if data is a valid collection config
 *
 * @example
 * ```typescript
 * if (isCollectionConfig(unknownData)) {
 *   // unknownData is now typed as CollectionConfig
 *   console.log(unknownData.slug)
 * }
 * ```
 */
export function isCollectionConfig(data: unknown): data is CollectionContractType {
  return CollectionContract.isType(data);
}

/**
 * Parse collection configuration (throws on validation failure)
 *
 * @param data - Unknown data to parse
 * @returns Validated CollectionConfig
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const collection = parseCollection(userInput)
 *   // collection is fully typed
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function parseCollection(data: unknown): CollectionContractType {
  return CollectionContract.parse(data);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a basic collection config with defaults
 */
export function createCollectionConfig(
  slug: string,
  fields: Field[],
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields,
    timestamps: true,
    ...options,
  };
}

/**
 * Creates an auth-enabled collection config
 */
export function createAuthCollectionConfig(
  slug: string,
  fields: Field[],
  authOptions?: AuthConfig,
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields' | 'auth'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields: [{ name: 'email', type: 'email', required: true, unique: true }, ...fields],
    auth: authOptions ?? {},
    timestamps: true,
    ...options,
  };
}

/**
 * Creates an upload-enabled collection config
 */
export function createUploadCollectionConfig(
  slug: string,
  fields: Field[],
  uploadOptions?: UploadConfig,
  options?: Partial<Omit<CollectionConfig, 'slug' | 'fields' | 'upload'>>,
): CollectionConfig {
  return {
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    slug,
    fields,
    upload: uploadOptions ?? {},
    timestamps: true,
    ...options,
  };
}
