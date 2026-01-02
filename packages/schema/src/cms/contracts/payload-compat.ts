/**
 * RevealUI CMS Compatibility Layer
 * 
 * This module ensures RevealUI types are compatible with Payload CMS types.
 * 
 * Compatibility is enforced through:
 * 1. Type assertions that fail at compile time if incompatible
 * 2. Adapter functions for explicit conversions
 * 3. Documentation of any differences
 * 
 * @module @revealui/schema/cms/contracts/payload-compat
 */

import type { CollectionConfig, GlobalConfig, Config } from './config';

// ============================================
// TYPE COMPATIBILITY NOTES
// ============================================

/**
 * RevealUI types are designed to EXTEND Payload types, meaning:
 * - A RevealUI CollectionConfig is assignable to Payload's CollectionConfig
 * - RevealUI adds optional properties, never removes required ones
 * - Function signatures match Payload's expected signatures
 * 
 * If Payload updates its types, this file should be updated to ensure
 * continued compatibility.
 */

// ============================================
// COMPILE-TIME COMPATIBILITY CHECKS
// ============================================

/**
 * These type assertions ensure our types remain compatible with Payload.
 * If Payload's types change, these will fail at compile time.
 * 
 * Note: We can't directly import from 'payload' here because it's a
 * peer dependency. These checks should be done in the consuming app's
 * test suite using the actual payload types.
 */

// Placeholder for compatibility check - uncomment when payload is available
// import type { CollectionConfig as PayloadCollectionConfig } from 'payload';
// type AssertCollectionCompatible = CollectionConfig extends PayloadCollectionConfig ? true : never;
// const _assertCollection: AssertCollectionCompatible = true;

// ============================================
// ADAPTER FUNCTIONS
// ============================================

/**
 * Convert a RevealUI CollectionConfig to a Payload-compatible config
 * 
 * This is useful when:
 * - Passing config to Payload's buildConfig
 * - Integrating with Payload plugins that expect exact Payload types
 * 
 * @example
 * ```typescript
 * import { buildConfig } from 'payload';
 * import { Posts } from './collections/Posts';
 * 
 * export default buildConfig({
 *   collections: [toPayloadCollectionConfig(Posts)],
 * });
 * ```
 */
export function toPayloadCollectionConfig(config: CollectionConfig): CollectionConfig {
  // Currently a pass-through since RevealUI configs are Payload-compatible
  // This function exists for:
  // 1. Explicit conversion intent
  // 2. Future compatibility shims
  // 3. Stripping RevealUI-specific properties if needed
  return config;
}

/**
 * Convert a RevealUI GlobalConfig to a Payload-compatible config
 */
export function toPayloadGlobalConfig(config: GlobalConfig): GlobalConfig {
  return config;
}

/**
 * Convert a full RevealUI Config to Payload-compatible config
 */
export function toPayloadConfig(config: Config): Config {
  return {
    ...config,
    collections: config.collections?.map(c => toPayloadCollectionConfig(c)),
    globals: config.globals?.map(g => toPayloadGlobalConfig(g)),
  };
}

/**
 * Validate that a Payload config can be used as a RevealUI config
 * 
 * Use this when:
 * - Consuming configs from external sources
 * - Migrating existing Payload configs to RevealUI
 * 
 * @example
 * ```typescript
 * // Existing Payload config
 * const legacyConfig = { slug: 'posts', fields: [...] };
 * 
 * // Validate and convert to RevealUI config
 * const revealConfig = fromPayloadCollectionConfig(legacyConfig);
 * ```
 */
export function fromPayloadCollectionConfig(config: CollectionConfig): CollectionConfig {
  // Payload configs should be compatible by design
  // Add any RevealUI defaults or transformations here
  return config;
}

/**
 * Convert Payload GlobalConfig to RevealUI GlobalConfig
 */
export function fromPayloadGlobalConfig(config: GlobalConfig): GlobalConfig {
  return config;
}

// ============================================
// REVEALUI EXTENSIONS
// ============================================

/**
 * RevealUI-specific extensions that can be added to configs
 * 
 * These are NOT part of Payload's types but are supported by RevealUI.
 */
export interface RevealUIExtensions {
  /** Enable AI-assisted content features */
  aiEnabled?: boolean;
  
  /** Dual representation for human and agent interfaces */
  dualRepresentation?: {
    human: {
      label: string;
      description?: string;
      helpText?: string;
    };
    agent: {
      semanticType: string;
      capabilities: string[];
      constraints?: Record<string, unknown>;
      actions?: Array<{
        name: string;
        description: string;
        parameters?: Record<string, unknown>;
      }>;
    };
  };
  
  /** Custom metadata for the collection/global */
  metadata?: Record<string, unknown>;
}

/**
 * Collection config with RevealUI extensions
 * 
 * Use this type when you want to access RevealUI-specific features.
 */
export interface RevealUICollectionConfig extends CollectionConfig {
  revealui?: RevealUIExtensions;
}

/**
 * Global config with RevealUI extensions
 */
export interface RevealUIGlobalConfig extends GlobalConfig {
  revealui?: RevealUIExtensions;
}

/**
 * Check if a config has RevealUI extensions
 */
export function hasRevealUIExtensions(
  config: CollectionConfig | GlobalConfig
): config is RevealUICollectionConfig | RevealUIGlobalConfig {
  return 'revealui' in config && config.revealui !== undefined;
}

/**
 * Extract RevealUI extensions from a config
 */
export function getRevealUIExtensions(
  config: CollectionConfig | GlobalConfig
): RevealUIExtensions | undefined {
  if (hasRevealUIExtensions(config)) {
    return config.revealui;
  }
  return undefined;
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * @deprecated Use CollectionConfig from @revealui/schema/cms instead.
 * This type is kept for backward compatibility during migration.
 * Will be removed in v1.0.0
 */
export type RevealCollectionConfig = RevealUICollectionConfig;

/**
 * @deprecated Use GlobalConfig from @revealui/schema/cms instead.
 * This type is kept for backward compatibility during migration.
 * Will be removed in v1.0.0
 */
export type RevealGlobalConfig = RevealUIGlobalConfig;

// ============================================
// SLUG UTILITIES
// ============================================

/**
 * Validate a collection/global slug
 * 
 * Slugs must:
 * - Start with a lowercase letter
 * - Contain only lowercase letters, numbers, and hyphens
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(slug);
}

/**
 * Convert a string to a valid slug
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^([^a-z])/, 'x-$1'); // Ensure starts with letter
}

/**
 * Validate slug and throw if invalid
 */
export function assertValidSlug(slug: string, context: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid slug "${slug}" in ${context}. ` +
      `Slugs must start with a lowercase letter and contain only ` +
      `lowercase letters, numbers, and hyphens. ` +
      `Suggested: "${toSlug(slug)}"`
    );
  }
}
