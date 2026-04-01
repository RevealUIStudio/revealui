/**
 * RevealUI CMS Compatibility Layer
 *
 * This module provides adapter functions for CMS configuration compatibility.
 *
 * Compatibility is enforced through:
 * 1. Type assertions that fail at compile time if incompatible
 * 2. Adapter functions for explicit conversions
 * 3. Documentation of any differences
 *
 * @module @revealui/contracts/core/contracts/compat
 */

import type { CollectionConfig, Config, GlobalConfig, UnknownRecord } from './config.js';

// ============================================
// ADAPTER FUNCTIONS
// ============================================

/**
 * Normalize a RevealUI CollectionConfig for CMS compatibility
 *
 * This is useful when:
 * - Passing config to external CMS build functions
 * - Integrating with plugins that expect standard CMS types
 *
 * @example
 * ```typescript
 * import { buildConfig } from '@revealui/core';
 * import { Posts } from './collections/Posts.js';

 * export default buildConfig({
 *   collections: [toCMSCollectionConfig(Posts)],
 * });
 * ```
 */
export function toCMSCollectionConfig<T = UnknownRecord>(
  config: CollectionConfig<T>,
): CollectionConfig<T> {
  // Currently a pass-through since RevealUI configs are CMS-compatible
  // This function exists for:
  // 1. Explicit conversion intent
  // 2. Future compatibility shims
  // 3. Stripping RevealUI-specific properties if needed
  return config;
}

/**
 * Normalize a RevealUI GlobalConfig for CMS compatibility
 */
export function toCMSGlobalConfig(config: GlobalConfig): GlobalConfig {
  return config;
}

/**
 * Normalize a full RevealUI Config for CMS compatibility
 */
export function toCMSConfig(config: Config): Config {
  const result = {
    secret: config.secret,
    ...(config.collections
      ? { collections: config.collections.map((c) => toCMSCollectionConfig(c)) }
      : {}),
    ...(config.globals ? { globals: config.globals.map((g) => toCMSGlobalConfig(g)) } : {}),
    ...(config.db ? { db: config.db } : {}),
    ...(config.serverURL ? { serverURL: config.serverURL } : {}),
    ...(config.admin ? { admin: config.admin } : {}),
    ...(config.custom ? { custom: config.custom } : {}),
  } satisfies Config;

  return result;
}

/**
 * Import a CMS config and convert to RevealUI config format
 *
 * Use this when:
 * - Consuming configs from external sources
 * - Migrating existing CMS configs to RevealUI
 *
 * @example
 * ```typescript
 * // Existing CMS config
 * const legacyConfig = { slug: 'posts', fields: [...] };
 *
 * // Validate and convert to RevealUI config
 * const revealConfig = fromCMSCollectionConfig(legacyConfig);
 * ```
 */
export function fromCMSCollectionConfig(config: CollectionConfig): CollectionConfig {
  // CMS configs should be compatible by design
  // Add any RevealUI defaults or transformations here
  return config;
}

/**
 * Convert CMS GlobalConfig to RevealUI GlobalConfig
 */
export function fromCMSGlobalConfig(config: GlobalConfig): GlobalConfig {
  return config;
}

// ============================================
// REVEALUI EXTENSIONS
// ============================================

/**
 * RevealUI-specific extensions that can be added to configs
 *
 * These are RevealUI-exclusive features beyond standard CMS types.
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
export function hasRevealUIExtensions(config: CollectionConfig | GlobalConfig): boolean {
  return (
    'revealui' in config &&
    (config as RevealUICollectionConfig | RevealUIGlobalConfig).revealui !== undefined
  );
}

/**
 * Extract RevealUI extensions from a config
 */
export function getRevealUIExtensions(
  config: CollectionConfig | GlobalConfig,
): RevealUIExtensions | undefined {
  if (hasRevealUIExtensions(config)) {
    return (config as RevealUICollectionConfig | RevealUIGlobalConfig).revealui;
  }
  return undefined;
}

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
  if (slug.length === 0) return false;
  // Must start with a lowercase letter
  const first = slug.charCodeAt(0);
  if (first < 97 || first > 122) return false;
  for (let i = 1; i < slug.length; i++) {
    const c = slug.charCodeAt(i);
    const isLower = c >= 97 && c <= 122;
    const isDigit = c >= 48 && c <= 57;
    const isHyphen = c === 45;
    if (!(isLower || isDigit || isHyphen)) return false;
  }
  return true;
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
        `Suggested: "${toSlug(slug)}"`,
    );
  }
}
