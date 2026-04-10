/**
 * Field Contract
 *
 * Unified contract for Field configurations that combines:
 * - TypeScript types (compile-time)
 * - Zod schemas (runtime validation)
 * - Validation functions
 * - Type guards
 *
 * This is the single source of truth for Field definitions.
 *
 * @module @revealui/contracts/core/contracts/field
 */

import { type Contract, type ContractType, createContract } from '../foundation/contract.js';
import type { Field } from './config.js';
import { type FieldStructure, FieldStructureSchema } from './structure.js';

/**
 * Field Contract
 *
 * This contract validates Field configurations at runtime
 * and provides TypeScript types at compile time.
 */
export const FieldContract: Contract<FieldStructure> = createContract({
  name: 'Field',
  version: '1.0.0',
  schema: FieldStructureSchema,
  description: 'Field configuration contract',
  docsUrl: 'https://revealui.dev/docs/api-reference/fields',
  tags: ['field', 'config', 'admin'],
});

/**
 * Type for Field configuration
 * Extracted from the FieldContract
 */
export type FieldContractType = ContractType<typeof FieldContract>;

/**
 * Validate a field configuration
 */
export function validateField(data: unknown): ReturnType<typeof FieldContract.validate> {
  return FieldContract.validate(data);
}

/**
 * Type guard for field configurations
 */
export function isFieldConfig(data: unknown): data is FieldContractType {
  return FieldContract.isType(data);
}

/**
 * Parse field configuration (throws on validation failure)
 */
export function parseField(data: unknown): FieldContractType {
  return FieldContract.parse(data);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for text fields
 */
export function isTextField(field: Field): boolean {
  return field.type === 'text';
}

/**
 * Type guard for number fields
 */
export function isNumberField(field: Field): boolean {
  return field.type === 'number';
}

/**
 * Type guard for relationship fields
 */
export function isRelationshipField(field: Field): boolean {
  return field.type === 'relationship';
}

/**
 * Type guard for array fields
 */
export function isArrayField(field: Field): boolean {
  return field.type === 'array';
}

/**
 * Type guard for group fields
 */
export function isGroupField(field: Field): boolean {
  return field.type === 'group';
}

/**
 * Type guard for layout fields (row, tabs, collapsible)
 */
export function isLayoutField(field: Field): boolean {
  return ['row', 'tabs', 'collapsible'].includes(field.type);
}

/**
 * Check if a field has nested fields
 */
export function hasNestedFields(field: Field): boolean {
  return (
    ['array', 'group', 'row', 'collapsible'].includes(field.type) ||
    (field.type === 'tabs' && !!field.tabs)
  );
}
