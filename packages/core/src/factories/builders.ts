import { createRevealUIInstance } from '../instance/RevealUIInstance.js';
import type {
  RevealConfig,
  RevealUIAccessRule,
  RevealUIBlock,
  RevealUICollectionConfig,
  RevealUIField,
  RevealUIInstance,
} from '../types/index.js';

/**
 * Factory Functions
 *
 * Helper functions for creating RevealUI configuration objects.
 */

/**
 * Creates a RevealUI instance (wrapper around createRevealUIInstance for backward compatibility)
 */
export async function createRevealUI(config: RevealConfig): Promise<RevealUIInstance> {
  return createRevealUIInstance(config);
}

/**
 * Creates a collection configuration with defaults
 */
export function createRevealUICollection(options: {
  slug: string;
  fields: RevealUIField[];
  revealUI?: RevealUICollectionConfig['revealUI'];
  access?: RevealUICollectionConfig['access'];
}): RevealUICollectionConfig {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      tenantScoped: false,
      auditLog: false,
      permissions: ['read', 'update'],
      ...(options.revealUI || {}),
    },
    access: options.access,
  };
}

/**
 * Creates a field configuration with defaults
 */
export function createRevealUIField(options: {
  name: string;
  type: RevealUIField['type'];
  label?: string;
  required?: boolean;
  revealUI?: RevealUIField['revealUI'];
  admin?: RevealUIField['admin'];
  validate?: RevealUIField['validate'];
}): RevealUIField {
  return {
    name: options.name,
    type: options.type,
    label: options.label,
    required: options.required,
    revealUI: {
      searchable: false,
      permissions: ['read', 'update'],
      tenantScoped: false,
      auditLog: false,
      validation: [],
      ...options.revealUI,
    },
    admin: options.admin,
    validate: options.validate,
  };
}

/**
 * Creates a block configuration with defaults
 */
export function createRevealUIBlock(options: {
  slug: string;
  fields: RevealUIField[];
  revealUI?: RevealUIBlock['revealUI'];
  labels?: RevealUIBlock['labels'];
}): RevealUIBlock {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      category: 'content',
      icon: 'block',
      permissions: ['read', 'update'],
      tenantScoped: false,
      ...options.revealUI,
    },
    labels: options.labels,
  };
}

/**
 * Creates an access rule configuration
 */
export function createRevealUIAccessRule(options: {
  tenant?: string;
  user?: string;
  permissions?: RevealUIAccessRule['permissions'];
  condition?: RevealUIAccessRule['condition'];
}): RevealUIAccessRule {
  return {
    tenant: options.tenant,
    user: options.user,
    permissions: options.permissions,
    condition: options.condition,
  };
}
