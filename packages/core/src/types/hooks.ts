/**
 * RevealUI Hook Types
 *
 * Defines hook-related interfaces and types specific to RevealUI.
 *
 * @module @revealui/core/types/hooks
 */

import type { Field } from '@revealui/contracts/admin';
import type { RevealDataObject, RevealDocument } from './query.js';
import type { RevealRequest } from './request.js';

// =============================================================================
// REVEALUI HOOK CONTEXT
// =============================================================================

/** RevealUI's extended hook context */
export interface RevealUIHookContext {
  revealui: unknown;
  collection?: string;
  global?: string;
  operation: 'create' | 'read' | 'update' | 'delete';
  previousDoc?: RevealDocument;
  req?: RevealRequest;
  locale?: string;
  fallbackLocale?: string;
  tenant?: string;
  user?: unknown;
}

// =============================================================================
// FIELD HOOKS
// =============================================================================

/** Field-level hook function signature */
export type RevealUIFieldHook<T = unknown> = (args: {
  value: T;
  context?: RevealUIHookContext;
  req?: RevealRequest;
  operation?: 'create' | 'update' | 'read' | 'delete';
  data?: RevealDataObject;
  siblingData?: RevealDataObject;
  originalDoc?: RevealDocument;
  previousDoc?: RevealDocument;
  previousValue?: T;
  field?: Field;
  path?: string[];
  collection?: string;
}) => T | Promise<T>;

// =============================================================================
// VALIDATION
// =============================================================================

/** RevealUI validation rule */
export interface RevealUIValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message?: string;
  validate?: (
    value: unknown,
    context: RevealUIHookContext,
  ) => boolean | string | Promise<boolean | string>;
}

/** Field validator function */
export type RevealUIFieldValidator = (
  value: unknown,
  args: {
    data: RevealDataObject;
    siblingData: RevealDataObject;
    operation: 'create' | 'update';
    req: RevealRequest;
  },
) => string | true | Promise<string | true>;
