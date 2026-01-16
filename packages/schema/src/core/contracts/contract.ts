/**
 * Unified Contract System
 *
 * A Contract is a single source of truth that combines:
 * 1. TypeScript Type (compile-time safety)
 * 2. Zod Schema (runtime validation)
 * 3. Validation Functions (runtime validation)
 * 4. Type Guards (runtime type checking)
 * 5. Metadata (documentation, versioning)
 *
 * This unified approach ensures that types, schemas, and validation
 * never drift apart, providing both compile-time and runtime safety.
 *
 * @module @revealui/schema/core/contracts/contract
 */

import { z } from 'zod'
import type { ZodError } from 'zod'

/**
 * Validation result from contract validation
 */
export interface ContractValidationSuccess<T> {
  success: true
  data: T
  errors?: never
}

export interface ContractValidationFailure {
  success: false
  data?: never
  errors: ZodError
}

export type ContractValidationResult<T> = ContractValidationSuccess<T> | ContractValidationFailure

/**
 * Contract metadata for documentation and versioning
 */
export interface ContractMetadata {
  /** Contract name/identifier */
  name: string
  /** Contract version for migration support */
  version: string
  /** Human-readable description */
  description?: string
  /** Documentation URL */
  docsUrl?: string
  /** Tags for categorization */
  tags?: string[]
  /** Deprecation notice if applicable */
  deprecated?: boolean
  /** Deprecation message */
  deprecatedMessage?: string
}

/**
 * Unified Contract Interface
 *
 * A Contract binds together TypeScript types, Zod schemas, and validation
 * into a single source of truth.
 *
 * @template T - The TypeScript type this contract validates
 *
 * @example
 * ```typescript
 * const UserContract = createContract({
 *   name: 'User',
 *   version: '1.0.0',
 *   schema: z.object({
 *     id: z.string(),
 *     email: z.string().email(),
 *     name: z.string().min(1),
 *   }),
 * })
 *
 * // Type inference
 * type User = ContractType<typeof UserContract>
 *
 * // Runtime validation
 * const result = UserContract.validate(rawData)
 * if (result.success) {
 *   // result.data is fully typed as User
 *   console.log(result.data.email)
 * }
 *
 * // Type guard
 * if (UserContract.isType(unknownData)) {
 *   // unknownData is now typed as User
 *   console.log(unknownData.email)
 * }
 * ```
 */
export interface Contract<T> {
  /** Contract metadata */
  readonly metadata: ContractMetadata

  /**
   * Zod schema for runtime validation
   * This is the single source of truth for the data structure
   */
  readonly schema: z.ZodSchema<T>

  /**
   * Validate data against the contract
   * Returns a result object with success flag and typed data or errors
   *
   * @param data - Unknown data to validate
   * @returns Validation result with typed data on success, errors on failure
   */
  validate(data: unknown): ContractValidationResult<T>

  /**
   * Type guard function
   * Returns true if data matches the contract, false otherwise
   * When true, TypeScript narrows the type to T
   *
   * @param data - Unknown data to check
   * @returns True if data is valid, false otherwise
   */
  isType(data: unknown): data is T

  /**
   * Parse data and throw on validation failure
   * Use this when you're certain data should be valid
   *
   * @param data - Unknown data to parse
   * @returns Typed data
   * @throws ZodError if validation fails
   */
  parse(data: unknown): T

  /**
   * Safe parse - returns result without throwing
   * Alias for validate() for consistency with Zod API
   *
   * @param data - Unknown data to parse
   * @returns Validation result
   */
  safeParse(data: unknown): ContractValidationResult<T>
}

/**
 * Extract the TypeScript type from a Contract
 *
 * @template C - The contract type
 *
 * @example
 * ```typescript
 * type User = ContractType<typeof UserContract>
 * ```
 */
export type ContractType<C extends Contract<unknown>> = C extends Contract<infer T> ? T : never

/**
 * Options for creating a contract
 */
export interface CreateContractOptions<T> {
  /** Contract name/identifier */
  name: string
  /** Contract version */
  version: string
  /** Zod schema for validation */
  schema: z.ZodSchema<T>
  /** Optional description */
  description?: string
  /** Optional documentation URL */
  docsUrl?: string
  /** Optional tags */
  tags?: string[]
  /** Optional deprecation flag */
  deprecated?: boolean
  /** Optional deprecation message */
  deprecatedMessage?: string
}

/**
 * Create a unified contract from a Zod schema
 *
 * This factory function creates a Contract that binds together:
 * - TypeScript type inference from the schema
 * - Runtime validation via Zod
 * - Type guards for type narrowing
 * - Metadata for documentation
 *
 * @template T - The type inferred from the schema
 * @param options - Contract creation options
 * @returns A complete Contract instance
 *
 * @example
 * ```typescript
 * const UserContract = createContract({
 *   name: 'User',
 *   version: '1.0.0',
 *   schema: z.object({
 *     id: z.string(),
 *     email: z.string().email(),
 *     name: z.string().min(1),
 *   }),
 * })
 * ```
 */
export function createContract<T>(options: CreateContractOptions<T>): Contract<T> {
  const { name, version, schema, description, docsUrl, tags, deprecated, deprecatedMessage } =
    options

  const metadata: ContractMetadata = {
    name,
    version,
    description,
    docsUrl,
    tags,
    deprecated,
    deprecatedMessage,
  }

  return {
    metadata,
    schema,

    validate(data: unknown): ContractValidationResult<T> {
      const result = schema.safeParse(data)
      if (result.success) {
        return {
          success: true,
          data: result.data,
        } as ContractValidationSuccess<T>
      }
      return {
        success: false,
        errors: result.error,
      } as ContractValidationFailure
    },

    isType(data: unknown): data is T {
      return schema.safeParse(data).success
    },

    parse(data: unknown): T {
      return schema.parse(data)
    },

    safeParse(data: unknown): ContractValidationResult<T> {
      return this.validate(data)
    },
  }
}

/**
 * Contract registry for managing all contracts
 * Allows lookup and versioning of contracts
 */
class ContractRegistry {
  private contracts = new Map<string, Contract<unknown>>()

  /**
   * Register a contract
   */
  register<T>(contract: Contract<T>): void {
    const key = `${contract.metadata.name}@${contract.metadata.version}`
    this.contracts.set(key, contract as Contract<unknown>)
  }

  /**
   * Get a contract by name and version
   */
  get<T>(name: string, version: string): Contract<T> | undefined {
    const key = `${name}@${version}`
    return this.contracts.get(key) as Contract<T> | undefined
  }

  /**
   * Get the latest version of a contract
   */
  getLatest<T>(name: string): Contract<T> | undefined {
    let latest: Contract<unknown> | undefined
    let latestVersion = '0.0.0'

    for (const contract of this.contracts.values()) {
      if (contract.metadata.name === name) {
        if (contract.metadata.version > latestVersion) {
          latestVersion = contract.metadata.version
          latest = contract
        }
      }
    }

    return latest as Contract<T> | undefined
  }

  /**
   * List all registered contracts
   */
  list(): Contract<unknown>[] {
    return Array.from(this.contracts.values())
  }

  /**
   * Clear all contracts (useful for testing)
   */
  clear(): void {
    this.contracts.clear()
  }
}

/**
 * Global contract registry instance
 */
export const contractRegistry = new ContractRegistry()
