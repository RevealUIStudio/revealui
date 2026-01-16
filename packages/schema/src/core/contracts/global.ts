/**
 * Global Contract
 *
 * Unified contract for Global configurations that combines:
 * - TypeScript types (compile-time)
 * - Zod schemas (runtime validation)
 * - Validation functions
 * - Type guards
 *
 * This is the single source of truth for Global definitions.
 *
 * @module @revealui/schema/core/contracts/global
 */

import { type Contract, type ContractType, createContract } from './contract'
import { type GlobalStructure, GlobalStructureSchema } from './structure'

/**
 * Global Contract
 *
 * This contract validates Global configurations at runtime
 * and provides TypeScript types at compile time.
 */
export const GlobalContract: Contract<GlobalStructure> = createContract({
  name: 'Global',
  version: '1.0.0',
  schema: GlobalStructureSchema,
  description: 'Global configuration contract',
  docsUrl: 'https://revealui.dev/docs/api-reference/globals',
  tags: ['global', 'config', 'cms'],
})

/**
 * Type for Global configuration
 * Extracted from the GlobalContract
 */
export type GlobalContractType = ContractType<typeof GlobalContract>

/**
 * Validate a global configuration
 */
export function validateGlobal(data: unknown): ReturnType<typeof GlobalContract.validate> {
  return GlobalContract.validate(data)
}

/**
 * Type guard for global configurations
 */
export function isGlobalConfig(data: unknown): data is GlobalContractType {
  return GlobalContract.isType(data)
}

/**
 * Parse global configuration (throws on validation failure)
 */
export function parseGlobal(data: unknown): GlobalContractType {
  return GlobalContract.parse(data)
}
