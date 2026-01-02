/**
 * RevealUI User Types
 * 
 * Defines user interfaces and related authentication types.
 * 
 * @module @revealui/cms/types/user
 */

import type { RevealValue } from './query';

// =============================================================================
// CORE USER
// =============================================================================

/** Core user interface */
export interface RevealUser {
  id: string | number;
  email: string;
  roles?: string[];
  firstName?: string;
  lastName?: string;
  password?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoggedInTenant?: string;
  purchases?: unknown[];
  tenants?: unknown[];
  // Allow additional properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Alias for consistency */
export type User = RevealUser;

// =============================================================================
// EXTENDED USER
// =============================================================================

/** Extended user with RevealUI features */
export interface RevealUIUser extends RevealUser {
  tenants?: string[];
  revealUI?: {
    preferences?: Record<string, unknown>;
    lastLogin?: string;
    isSuperAdmin?: boolean;
  };
}

// =============================================================================
// TENANT
// =============================================================================

/** Tenant configuration */
export interface RevealUITenant {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, unknown>;
}

// =============================================================================
// PERMISSIONS
// =============================================================================

export type RevealUIPermission = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'admin';

export interface Permission {
  create?: boolean | Record<string, unknown>;
  read?: boolean | Record<string, unknown>;
  update?: boolean | Record<string, unknown>;
  delete?: boolean | Record<string, unknown>;
}
