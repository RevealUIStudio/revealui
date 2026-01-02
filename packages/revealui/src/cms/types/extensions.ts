/**
 * RevealUI Framework Extension Types
 *
 * Defines RevealUI-specific extensions for the CMS framework.
 *
 * @module @revealui/cms/types/extensions
 */

import type { Field, CollectionConfig } from '@revealui/schema/cms'
import type { RevealUITenant, RevealUIPermission, User, RevealUIUser } from './user'
import type { RevealUIValidationRule, RevealUIFieldValidator, RevealUIHookContext } from './hooks'
import type { Access, RevealUIAccessResult } from './access'
import type { ReactNode, ComponentType } from 'react'

// =============================================================================
// COMPONENT TYPES
// =============================================================================

/**
 * Custom React component type for RevealUI fields and admin
 */
export type CustomComponent<P = Record<string, unknown>> = ComponentType<P>

/**
 * RevealUI component interface (for component registration)
 */
export interface RevealUIComponentConfig<P = Record<string, unknown>> {
  Component: ComponentType<P>
  props?: P
}

/**
 * RevealUI component type - a React component that receives RevealUI context
 */
export type RevealUIComponent<P = Record<string, unknown>> = ComponentType<
  P & {
    revealUI?: {
      tenant?: { id: string; name: string }
      user?: { id: string; email: string }
      permissions?: string[]
      theme?: string
    }
    children?: React.ReactNode
  }
>

// =============================================================================
// FRAMEWORK CONTEXT
// =============================================================================

/** Framework context */
export interface RevealUIContext {
  tenant?: RevealUITenant
  user?: User
  permissions: string[]
  auditLog?: boolean
  theme?: string
}

/** Framework-specific context */
export interface RevealUIFrameworkContext {
  tenant?: {
    id: string
    name: string
    domain: string
  }
  user?: RevealUIUser
  permissions: RevealUIPermission[]
  theme?: string
}

// =============================================================================
// EXTENDED COLLECTION CONFIG
// =============================================================================

/** Extended collection config with RevealUI features */
export interface RevealUICollectionConfig extends Omit<CollectionConfig, 'access'> {
  revealUI?: {
    tenantScoped?: boolean
    auditLog?: boolean
    permissions?: string[]
  }
  access?: {
    create?: Access
    read?: Access
    update?: Access
    delete?: Access
    revealUI?: {
      tenantRead?: RevealUIAccessResult
      tenantWrite?: RevealUIAccessResult
      superAdminOnly?: boolean
    }
  }
}

// =============================================================================
// EXTENDED FIELD
// =============================================================================

/** Extended field with RevealUI features */
export interface RevealUIField extends Field {
  revealUI?: {
    searchable?: boolean
    auditLog?: boolean
    tenantScoped?: boolean
    permissions?: string[]
    validation?: RevealUIValidationRule[]
  }
}

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
  | 'ui'

export interface RevealUIEnhancedField {
  name: string
  type: RevealUIFieldType
  label?: string
  required?: boolean
  revealUI?: {
    searchable?: boolean
    permissions?: RevealUIPermission[]
    tenantScoped?: boolean
    auditLog?: boolean
    validation?: RevealUIValidationRule[]
  }
  admin?: {
    description?: string
    position?: string
    readOnly?: boolean
    hidden?: boolean
    condition?: (
      data: Record<string, unknown>,
      siblingData: Record<string, unknown>,
      context: RevealUIContext
    ) => boolean
  }
  validate?: RevealUIFieldValidator
}
