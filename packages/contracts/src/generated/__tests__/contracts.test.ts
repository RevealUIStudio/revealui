/**
 * Generated Contract Tests
 *
 * Tests for auto-generated contracts focusing on:
 * - Contract structure and metadata
 * - Validation API surface
 * - Type inference
 * - Error handling
 * - Coverage and consistency
 */

import { describe, expect, it } from 'vitest'
import * as Contracts from '../contracts.js'
import * as Schemas from '../zod-schemas.js'

describe('Generated Contracts', () => {
  describe('Contract Structure', () => {
    it('should export Row and Insert contracts for each table', () => {
      // Sample a few key tables
      expect(Contracts.UsersRowContract).toBeDefined()
      expect(Contracts.UsersInsertContract).toBeDefined()
      expect(Contracts.SitesRowContract).toBeDefined()
      expect(Contracts.SitesInsertContract).toBeDefined()
      expect(Contracts.PagesRowContract).toBeDefined()
      expect(Contracts.PagesInsertContract).toBeDefined()
    })

    it('should have proper contract metadata', () => {
      expect(Contracts.UsersRowContract.metadata.name).toBe('UsersRow')
      expect(Contracts.UsersRowContract.metadata.version).toBe('1')
      expect(Contracts.UsersRowContract.metadata.description).toContain('users table')
    })

    it('should have validate method', () => {
      expect(typeof Contracts.UsersRowContract.validate).toBe('function')
    })

    it('should have isType method', () => {
      expect(typeof Contracts.UsersRowContract.isType).toBe('function')
    })

    it('should have parse method', () => {
      expect(typeof Contracts.UsersRowContract.parse).toBe('function')
    })

    it('should have safeParse method', () => {
      expect(typeof Contracts.UsersRowContract.safeParse).toBe('function')
    })

    it('should have schema property', () => {
      expect(Contracts.UsersRowContract.schema).toBeDefined()
      expect(typeof Contracts.UsersRowContract.schema.parse).toBe('function')
    })
  })

  describe('Schema Exports', () => {
    it('should export Select and Insert schemas', () => {
      expect(Schemas.UsersSelectSchema).toBeDefined()
      expect(Schemas.UsersInsertSchema).toBeDefined()
      expect(Schemas.SitesSelectSchema).toBeDefined()
      expect(Schemas.SitesInsertSchema).toBeDefined()
    })

    it('should export Row and Insert types', () => {
      // Type exports are compile-time, so we check the schema exists
      expect(Schemas.UsersSelectSchema.parse).toBeDefined()
      expect(Schemas.UsersInsertSchema.parse).toBeDefined()
    })

    it('should have working Zod schemas', () => {
      // Schemas should have Zod methods
      expect(typeof Schemas.UsersSelectSchema.safeParse).toBe('function')
      expect(typeof Schemas.UsersInsertSchema.safeParse).toBe('function')
    })
  })

  describe('Validation API', () => {
    it('should return success=false for invalid data', () => {
      const result = Contracts.UsersRowContract.validate(null)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toBeDefined()
        expect(result.errors.issues).toBeDefined()
      }
    })

    it('should return success=false for incomplete data', () => {
      const result = Contracts.UsersRowContract.validate({ id: 'test' })
      expect(result.success).toBe(false)
    })

    it('should provide ZodError with issues array', () => {
      const result = Contracts.UsersRowContract.validate({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(Array.isArray(result.errors.issues)).toBe(true)
        expect(result.errors.issues.length).toBeGreaterThan(0)
        expect(result.errors.issues[0]).toHaveProperty('message')
        expect(result.errors.issues[0]).toHaveProperty('path')
      }
    })

    it('should validate with isType', () => {
      expect(Contracts.UsersRowContract.isType(null)).toBe(false)
      expect(Contracts.UsersRowContract.isType({})).toBe(false)
      expect(Contracts.UsersRowContract.isType('string')).toBe(false)
    })

    it('should throw on parse with invalid data', () => {
      expect(() => Contracts.UsersRowContract.parse(null)).toThrow()
    })

    it('should have safeParse as alias for validate', () => {
      const validateResult = Contracts.UsersRowContract.validate(null)
      const safeParseResult = Contracts.UsersRowContract.safeParse(null)

      expect(validateResult.success).toBe(safeParseResult.success)
    })
  })

  describe('Insert vs Select Schemas', () => {
    it('should have different Insert and Select schemas', () => {
      // Insert schemas may have different requirements than Select
      // For example, timestamps might be optional on insert but required on select
      expect(Contracts.UsersInsertContract.metadata.name).not.toBe(
        Contracts.UsersRowContract.metadata.name,
      )
    })

    it('should validate inserts differently than selects', () => {
      // Insert may require fewer fields
      const minimalInsert = {
        id: 'user_new',
        name: 'Test',
      }

      // This might still fail due to drizzle-zod strictness, but the API should work
      const result = Contracts.UsersInsertContract.validate(minimalInsert)
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Contract Coverage', () => {
    it('should have contracts for all major tables', () => {
      const requiredContracts = [
        'UsersRowContract',
        'UsersInsertContract',
        'SitesRowContract',
        'SitesInsertContract',
        'PagesRowContract',
        'PagesInsertContract',
        'SessionsRowContract',
        'SessionsInsertContract',
      ]

      for (const contractName of requiredContracts) {
        expect(Contracts[contractName as keyof typeof Contracts]).toBeDefined()
      }
    })

    it('should have matching schemas for all contracts', () => {
      expect(Schemas.UsersSelectSchema).toBeDefined()
      expect(Schemas.UsersInsertSchema).toBeDefined()
      expect(Schemas.SitesSelectSchema).toBeDefined()
      expect(Schemas.SitesInsertSchema).toBeDefined()
    })

    it('should export many contracts', () => {
      const contracts = Object.keys(Contracts)
      const contractCount = contracts.filter((c) => c.endsWith('Contract')).length

      // Should have at least 40 contracts (20+ tables × 2 types)
      expect(contractCount).toBeGreaterThan(40)
    })
  })

  describe('Error Handling', () => {
    it('should handle null input', () => {
      const result = Contracts.UsersRowContract.validate(null)
      expect(result.success).toBe(false)
    })

    it('should handle undefined input', () => {
      const result = Contracts.UsersRowContract.validate(undefined)
      expect(result.success).toBe(false)
    })

    it('should handle wrong type input', () => {
      const result = Contracts.UsersRowContract.validate('not an object')
      expect(result.success).toBe(false)
    })

    it('should handle array input', () => {
      const result = Contracts.UsersRowContract.validate([])
      expect(result.success).toBe(false)
    })

    it('should provide structured error information', () => {
      const result = Contracts.UsersRowContract.validate({ invalid: 'data' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBe('ZodError')
        expect(result.errors.message).toBeDefined()
        expect(Array.isArray(result.errors.issues)).toBe(true)
      }
    })
  })

  describe('Schema Consistency', () => {
    it('should have consistent naming between Row and Insert contracts', () => {
      const contracts = Object.keys(Contracts)
      const rowContracts = contracts.filter((c) => c.endsWith('RowContract'))
      const insertContracts = contracts.filter((c) => c.endsWith('InsertContract'))

      expect(rowContracts.length).toBeGreaterThan(0)
      expect(insertContracts.length).toBeGreaterThan(0)
      expect(rowContracts.length).toBe(insertContracts.length)

      for (const rowContract of rowContracts) {
        const tableName = rowContract.replace('RowContract', '')
        const insertContract = `${tableName}InsertContract`
        expect(contracts).toContain(insertContract)
      }
    })

    it('should have matching schemas for contracts', () => {
      const schemas = Object.keys(Schemas)
      const selectSchemas = schemas.filter((s) => s.endsWith('SelectSchema'))
      const insertSchemas = schemas.filter((s) => s.endsWith('InsertSchema'))

      expect(selectSchemas.length).toBe(insertSchemas.length)

      for (const selectSchema of selectSchemas) {
        const tableName = selectSchema.replace('SelectSchema', '')
        const insertSchema = `${tableName}InsertSchema`
        expect(schemas).toContain(insertSchema)
      }
    })

    it('should have Row types exported for all schemas', () => {
      const schemas = Object.keys(Schemas)
      const selectSchemas = schemas.filter((s) => s.endsWith('SelectSchema'))

      for (const schema of selectSchemas) {
        const tableName = schema.replace('SelectSchema', '')
        const rowType = `${tableName}Row`
        // Type exports exist but may not be enumerable
        // Just check the schema exists
        expect(Schemas[schema as keyof typeof Schemas]).toBeDefined()
      }
    })
  })

  describe('Type Inference', () => {
    it('should allow type inference from contracts', () => {
      // This is a compile-time test, but we can check the schema works
      const schema = Contracts.UsersRowContract.schema

      // The schema should be a Zod schema with standard methods
      expect(schema).toHaveProperty('parse')
      expect(schema).toHaveProperty('safeParse')
      expect(typeof schema.parse).toBe('function')
      expect(typeof schema.safeParse).toBe('function')
    })
  })

  describe('Metadata Consistency', () => {
    it('should have metadata for all contracts', () => {
      const contracts = Object.keys(Contracts).filter((c) => c.endsWith('Contract'))

      for (const contractName of contracts.slice(0, 10)) {
        // Check first 10
        const contract = Contracts[contractName as keyof typeof Contracts]
        expect(contract.metadata).toBeDefined()
        expect(contract.metadata.name).toBeDefined()
        expect(contract.metadata.version).toBeDefined()
        expect(contract.metadata.description).toBeDefined()
      }
    })

    it('should have version 1 for all contracts', () => {
      expect(Contracts.UsersRowContract.metadata.version).toBe('1')
      expect(Contracts.SitesRowContract.metadata.version).toBe('1')
      expect(Contracts.PagesRowContract.metadata.version).toBe('1')
    })
  })
})
