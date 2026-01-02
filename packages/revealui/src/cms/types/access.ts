/**
 * RevealUI Access Control Types
 * 
 * Defines access control interfaces and types.
 * 
 * @module @revealui/cms/types/access
 */

import type { RevealRequest } from './request';
import type { RevealDataObject, RevealWhere, WhereClause } from './query';
import type { RevealUITenant, RevealUIPermission, RevealUser } from './user';

// =============================================================================
// ACCESS TYPES
// =============================================================================

export interface AccessArgs {
  req: RevealRequest;
  id?: string | number;
  data?: RevealDataObject;
  /** Current tenant context (for multi-tenant setups) */
  tenant?: RevealUITenant;
}

/**
 * RevealUI-specific access args with full framework context
 */
export interface RevealUIAccessArgs {
  req: RevealRequest;
  id?: string | number;
  data?: RevealDataObject;
  /** Current tenant context (for multi-tenant setups) */
  tenant?: RevealUITenant;
  /** User context */
  user?: RevealUser;
}

export type AccessResult = boolean | WhereClause | Promise<boolean | WhereClause>;
export type AccessFunction = (args: AccessArgs) => AccessResult;

export type Access =
  | AccessFunction
  | {
      read?: AccessFunction;
      create?: AccessFunction;
      update?: AccessFunction;
      delete?: AccessFunction;
      admin?: AccessFunction;
      unlock?: AccessFunction;
    };

/** Field-level access control */
export type FieldAccess<T = unknown, U = unknown> = (
  args: AccessArgs & { data?: T; siblingData?: U }
) => AccessResult;

// =============================================================================
// REVEALUI ACCESS EXTENSIONS
// =============================================================================

export type RevealUIAccessResult =
  | boolean
  | ((args: { req: RevealRequest; user: RevealUser; tenant: RevealUITenant }) => boolean);

export interface RevealUIAccessContext {
  tenant?: {
    id: string;
    name: string;
    domain: string;
  };
  user?: RevealUser;
  operation: 'create' | 'read' | 'update' | 'delete' | 'publish';
  data?: Record<string, unknown>;
}

export type RevealUIFilterResult = boolean | RevealWhere;

export interface RevealUIAccessRule {
  tenant?: string;
  user?: string;
  permissions?: RevealUIPermission[];
  condition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}
