/**
 * RevealUI Framework Extension Types
 *
 * Defines RevealUI-specific extensions for the runtime engine.
 *
 * @module @revealui/core/types/extensions
 */

import type { CollectionConfig, Field } from '@revealui/contracts/admin';
import type { ComponentType } from 'react';
import type { Access, RevealUIAccessResult } from './access.js';
import type { RevealUIFieldValidator, RevealUIValidationRule } from './hooks.js';
import type { RevealUIPermission, RevealUITenant, RevealUIUser, User } from './user.js';

// =============================================================================
// COMPONENT TYPES
// =============================================================================

/**
 * Custom React component type for RevealUI fields and admin
 */
export type CustomComponent<P = Record<string, unknown>> = ComponentType<P>;

/**
 * RevealUI component interface (for component registration)
 */
export interface RevealUIComponentConfig<P = Record<string, unknown>> {
  Component: ComponentType<P>;
  props?: P;
}

/**
 * RevealUI component type - a React component that receives RevealUI context
 */
export type RevealUIComponent<P = Record<string, unknown>> = ComponentType<
  P & {
    revealUI?: {
      tenant?: { id: string; name: string };
      user?: { id: string; email: string };
      permissions?: string[];
      theme?: string;
    };
    children?: React.ReactNode;
  }
>;

// =============================================================================
// FRAMEWORK CONTEXT
// =============================================================================

/** Framework context */
export interface RevealUIContext {
  tenant?: RevealUITenant;
  user?: User;
  permissions: string[];
  auditLog?: boolean;
  theme?: string;
}

/** Framework-specific context */
export interface RevealUIFrameworkContext {
  tenant?: {
    id: string;
    name: string;
    domain: string;
  };
  user?: RevealUIUser;
  permissions: RevealUIPermission[];
  theme?: string;
}

// =============================================================================
// EXTENDED COLLECTION CONFIG
// =============================================================================

/** Extended collection config with RevealUI features */
export interface RevealUICollectionConfig extends Omit<CollectionConfig, 'access'> {
  revealUI?: {
    tenantScoped?: boolean;
    auditLog?: boolean;
    permissions?: string[];
  };
  access?: {
    create?: Access;
    read?: Access;
    update?: Access;
    delete?: Access;
    revealUI?: {
      tenantRead?: RevealUIAccessResult;
      tenantWrite?: RevealUIAccessResult;
      superAdminOnly?: boolean;
    };
  };
}

// =============================================================================
// EXTENDED FIELD
// =============================================================================

/** Extended field with RevealUI features
 *
 * Uses intersection type to ensure all properties from Field
 * (including type, name, label, required from FieldStructure) are properly inferred.
 */
export type RevealUIField = Field & {
  revealUI?: {
    searchable?: boolean;
    auditLog?: boolean;
    tenantScoped?: boolean;
    permissions?: string[];
    validation?: RevealUIValidationRule[];
  };
};

// =============================================================================
// ENHANCED FIELDS
// =============================================================================

export type RevealUIFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'password'
  | 'code'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'relationship'
  | 'upload'
  | 'array'
  | 'blocks'
  | 'group'
  | 'row'
  | 'collapsible'
  | 'tabs'
  | 'richText'
  | 'json'
  | 'point'
  | 'ui';

export interface RevealUIEnhancedField {
  name: string;
  type: RevealUIFieldType;
  label?: string;
  required?: boolean;
  revealUI?: {
    searchable?: boolean;
    permissions?: RevealUIPermission[];
    tenantScoped?: boolean;
    auditLog?: boolean;
    validation?: RevealUIValidationRule[];
  };
  admin?: {
    description?: string;
    position?: string;
    readOnly?: boolean;
    hidden?: boolean;
    condition?: (
      data: Record<string, unknown>,
      siblingData: Record<string, unknown>,
      context: RevealUIContext,
    ) => boolean;
  };
  validate?: RevealUIFieldValidator;
}
