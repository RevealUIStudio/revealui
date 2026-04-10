/**
 * Extensibility Contracts
 *
 * Contracts for extending the admin type system with:
 * - Custom field types (from plugins)
 * - Plugin field extensions
 * - Custom validation rules
 *
 * @module @revealui/contracts/core/contracts/extensibility
 */

import { z } from 'zod/v4';
import type { CollectionConfig, Field } from './config.js';

// ============================================
// CUSTOM FIELD TYPE REGISTRY
// ============================================

/**
 * Configuration for a custom field type
 */
export interface CustomFieldTypeConfig {
  /** Zod schema for validating field config (optional) */
  schema?: z.ZodType<unknown>;

  /** Default value for this field type */
  defaultValue?: unknown;

  /** Custom validation function for field values */
  validate?: (value: unknown) => boolean | string;

  /** Description for documentation */
  description?: string;

  /** Whether this field can have nested fields */
  hasNestedFields?: boolean;

  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Registry of custom field types
 */
export interface CustomFieldTypeRegistry {
  [typeName: string]: CustomFieldTypeConfig;
}

// Global registry instance
const customFieldTypeRegistry: CustomFieldTypeRegistry = {};

/**
 * Register a custom field type
 *
 * Call this from plugins to add new field types.
 *
 * @example
 * ```typescript
 * // In your plugin
 * registerCustomFieldType('color-picker', {
 *   description: 'A color picker field',
 *   defaultValue: '#000000',
 *   validate: (value) => {
 *     if (typeof value !== 'string') return 'Color must be a string';
 *     if (!/^#[0-9a-f]{6}$/i.test(value)) return 'Invalid hex color';
 *     return true;
 *   },
 * });
 * ```
 */
export function registerCustomFieldType(typeName: string, config: CustomFieldTypeConfig): void {
  // Silently overwrite existing types - last registration wins
  customFieldTypeRegistry[typeName] = config;
}

/**
 * Get a registered custom field type
 */
export function getCustomFieldType(typeName: string): CustomFieldTypeConfig | undefined {
  return customFieldTypeRegistry[typeName];
}

/**
 * Get all registered custom field types
 */
export function getCustomFieldTypes(): CustomFieldTypeRegistry {
  return { ...customFieldTypeRegistry };
}

/**
 * Unregister a custom field type (mainly for testing)
 */
export function unregisterCustomFieldType(typeName: string): void {
  Reflect.deleteProperty(customFieldTypeRegistry, typeName);
}

/**
 * Clear all custom field types (mainly for testing)
 */
export function clearCustomFieldTypes(): void {
  for (const key of Object.keys(customFieldTypeRegistry)) {
    Reflect.deleteProperty(customFieldTypeRegistry, key);
  }
}

/**
 * Built-in field types in RevealUI admin
 */
export const BUILTIN_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'password',
  'code',
  'date',
  'checkbox',
  'select',
  'radio',
  'relationship',
  'upload',
  'array',
  'blocks',
  'group',
  'row',
  'collapsible',
  'tabs',
  'richText',
  'json',
  'point',
  'ui',
] as const;

export type BuiltinFieldType = (typeof BUILTIN_FIELD_TYPES)[number];

/**
 * Check if a field type is valid (built-in or custom)
 */
export function isValidFieldType(type: string): boolean {
  return BUILTIN_FIELD_TYPES.includes(type as BuiltinFieldType) || type in customFieldTypeRegistry;
}

/**
 * Get all valid field types (built-in + custom)
 */
export function getValidFieldTypes(): string[] {
  return [...BUILTIN_FIELD_TYPES, ...Object.keys(customFieldTypeRegistry)];
}

/**
 * Extended field type schema that includes custom types
 *
 * Use this schema when validating field configs that may include
 * custom field types from plugins.
 */
export const ExtendedFieldTypeSchema = z.string().refine((type) => isValidFieldType(type), {
  message: `Invalid field type. Valid types: ${getValidFieldTypes().join(', ')}`,
});

// ============================================
// PLUGIN FIELD EXTENSIONS
// ============================================

/**
 * Plugin field extension configuration
 *
 * Allows plugins to add fields to collections.
 */
export interface PluginFieldExtension {
  /** Plugin name (for debugging and conflict resolution) */
  pluginName: string;

  /** Priority for ordering when multiple plugins add fields (higher = later) */
  priority?: number;

  /** Fields to add to ALL collections */
  globalFields?: Field[];

  /** Fields to add to specific collections (by slug) */
  collectionFields?: Record<string, Field[]>;

  /** Custom field type definitions provided by this plugin */
  customFieldTypes?: Array<{
    name: string;
    config: CustomFieldTypeConfig;
  }>;

  /** Hook to modify collection config before finalization */
  beforeFinalize?: (config: CollectionConfig) => CollectionConfig;
}

// Registry of plugin extensions
const pluginExtensions: PluginFieldExtension[] = [];

/**
 * Register a plugin field extension
 *
 * @example
 * ```typescript
 * registerPluginExtension({
 *   pluginName: 'seo-plugin',
 *   globalFields: [
 *     { name: 'metaTitle', type: 'text', admin: { position: 'sidebar' } },
 *     { name: 'metaDescription', type: 'textarea' },
 *   ],
 *   collectionFields: {
 *     posts: [
 *       { name: 'canonicalUrl', type: 'text' },
 *     ],
 *   },
 * });
 * ```
 */
export function registerPluginExtension(extension: PluginFieldExtension): void {
  // Register any custom field types from this plugin
  if (extension.customFieldTypes) {
    for (const { name, config } of extension.customFieldTypes) {
      registerCustomFieldType(name, config);
    }
  }

  pluginExtensions.push(extension);

  // Sort by priority
  pluginExtensions.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/**
 * Get all registered plugin extensions
 */
export function getPluginExtensions(): PluginFieldExtension[] {
  return [...pluginExtensions];
}

/**
 * Clear all plugin extensions (mainly for testing)
 */
export function clearPluginExtensions(): void {
  pluginExtensions.length = 0;
}

/**
 * Apply plugin field extensions to a collection config
 *
 * This is called during config finalization to add plugin-provided fields.
 *
 * @param config - The base collection config
 * @returns The config with plugin fields added
 */
export function applyPluginExtensions(config: CollectionConfig): CollectionConfig {
  let result: CollectionConfig = { ...config, fields: [...config.fields] };
  const { slug } = config;

  for (const extension of pluginExtensions) {
    // Add global fields
    if (extension.globalFields) {
      result = {
        ...result,
        fields: [...result.fields, ...extension.globalFields],
      };
    }

    // Add collection-specific fields
    if (extension.collectionFields && slug in extension.collectionFields) {
      const collectionSpecificFields = extension.collectionFields[slug];
      if (collectionSpecificFields) {
        result = {
          ...result,
          fields: [...result.fields, ...collectionSpecificFields],
        };
      }
    }

    // Apply beforeFinalize hook
    if (extension.beforeFinalize) {
      result = extension.beforeFinalize(result);
    }
  }

  return result;
}

// ============================================
// CUSTOM VALIDATION RULES
// ============================================

/**
 * Custom validation rule configuration
 */
export interface CustomValidationRule {
  /** Rule name (for error messages) */
  name: string;

  /** Validation function */
  validate: (value: unknown, options?: unknown) => boolean | string;

  /** Default error message */
  message?: string;

  /** Description for documentation */
  description?: string;
}

/**
 * Registry of custom validation rules
 */
export interface ValidationRuleRegistry {
  [ruleName: string]: CustomValidationRule;
}

// Global validation rules registry
const validationRules: ValidationRuleRegistry = {};

/**
 * Register a custom validation rule
 *
 * @example
 * ```typescript
 * registerValidationRule({
 *   name: 'slug-format',
 *   validate: (value) => {
 *     if (typeof value !== 'string') return 'Must be a string';
 *     if (!/^[a-z0-9-]+$/.test(value)) {
 *       return 'Slug must contain only lowercase letters, numbers, and hyphens';
 *     }
 *     return true;
 *   },
 *   description: 'Validates URL-safe slug format',
 * });
 * ```
 */
export function registerValidationRule(rule: CustomValidationRule): void {
  validationRules[rule.name] = rule;
}

/**
 * Get a validation rule by name
 */
export function getValidationRule(name: string): CustomValidationRule | undefined {
  return validationRules[name];
}

/**
 * Get all registered validation rules
 */
export function getValidationRules(): ValidationRuleRegistry {
  return { ...validationRules };
}

/**
 * Run a validation rule against a value
 */
export function runValidationRule(
  ruleName: string,
  value: unknown,
  options?: unknown,
): boolean | string {
  const rule = validationRules[ruleName];
  if (!rule) {
    return `Unknown validation rule: ${ruleName}`;
  }
  return rule.validate(value, options);
}

// ============================================
// TYPE EXTENSION UTILITIES
// ============================================

/**
 * Merge field arrays, handling conflicts by name
 *
 * Later fields override earlier fields with the same name.
 */
export function mergeFields(base: Field[], additions: Field[]): Field[] {
  const fieldMap = new Map<string, Field>();

  // Add base fields
  for (const field of base) {
    const { name } = field;
    if (name) {
      fieldMap.set(name, field);
    }
  }

  // Override/add additional fields
  for (const field of additions) {
    const { name } = field;
    if (name) {
      fieldMap.set(name, field);
    }
  }

  // Rebuild array, preserving order of base with additions at end
  const result: Field[] = [];
  const addedNames = new Set<string>();

  for (const field of base) {
    const { name } = field;
    if (name) {
      const mappedField = fieldMap.get(name);
      if (mappedField) {
        result.push(mappedField);
        addedNames.add(name);
        continue;
      }
    }
    result.push(field);
  }

  // Add any new fields not in base
  for (const field of additions) {
    const { name } = field;
    if (name && !addedNames.has(name)) {
      result.push(field);
    }
  }

  return result;
}

/**
 * Deep merge two collection configs
 */
export function mergeCollectionConfigs(
  base: CollectionConfig,
  overrides: Partial<CollectionConfig>,
): CollectionConfig {
  const baseAccess = base.access ?? {};
  const baseHooks = base.hooks ?? {};
  const baseAdmin = base.admin ?? {};

  const result: CollectionConfig = {
    ...base,
    ...overrides,
    fields: overrides.fields ? mergeFields(base.fields, overrides.fields) : base.fields,
  };

  if (overrides.access) {
    result.access = { ...baseAccess, ...overrides.access };
  }

  if (overrides.hooks) {
    result.hooks = {
      ...baseHooks,
      ...overrides.hooks,
      // Merge hook arrays
      beforeChange: [...(baseHooks.beforeChange ?? []), ...(overrides.hooks.beforeChange ?? [])],
      afterChange: [...(baseHooks.afterChange ?? []), ...(overrides.hooks.afterChange ?? [])],
    };
  }

  if (overrides.admin) {
    result.admin = { ...baseAdmin, ...overrides.admin };
  }

  return result;
}
