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
 * @module @revealui/schema/core/contracts/field
 */

import { type Contract, type ContractType, createContract } from './contract'
import { type FieldStructure, FieldStructureSchema } from './structure'

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
  tags: ['field', 'config', 'cms'],
})

/**
 * Type for Field configuration
 * Extracted from the FieldContract
 */
export type FieldContractType = ContractType<typeof FieldContract>

/**
 * Validate a field configuration
 */
export function validateField(data: unknown): ReturnType<typeof FieldContract.validate> {
  return FieldContract.validate(data)
}

/**
 * Type guard for field configurations
 */
export function isFieldConfig(data: unknown): data is FieldContractType {
  return FieldContract.isType(data)
}

/**
 * Parse field configuration (throws on validation failure)
 */
export function parseField(data: unknown): FieldContractType {
  return FieldContract.parse(data)
}
