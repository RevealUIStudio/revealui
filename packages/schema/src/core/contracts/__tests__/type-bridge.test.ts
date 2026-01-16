/**
 * Tests for Type Bridge Utilities
 *
 * Verifies that:
 * - Drizzle types convert to Contract types
 * - Contract types convert to Drizzle types
 * - Type safety across layers
 */

import type { Database } from '@revealui/db/types'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type Contract, createContract } from '../contract.js'
import {
  batchContractToDbInsert,
  batchDbRowsToContract,
  createContractToDbMapper,
  createDbRowMapper,
  createTableContractRegistry,
  isDbRowAndContract,
} from '../type-bridge.js'

// Create test contracts
const UserContract = createContract({
  name: 'User',
  version: '1.0.0',
  schema: z.object({
    id: z.string(),
    email: z.string().email().optional(),
    name: z.string(),
  }),
})

describe('Type Bridge Utilities', () => {
  describe('createDbRowMapper', () => {
    it('should create a mapper function', () => {
      const mapper = createDbRowMapper(UserContract)
      expect(typeof mapper).toBe('function')
    })

    it('should map valid database rows', () => {
      const mapper = createDbRowMapper(UserContract)
      const dbRow = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const result = mapper(dbRow)
      expect(result.id).toBe('user-123')
      expect(result.name).toBe('Test User')
    })

    it('should use custom mapper function', () => {
      const mapper = createDbRowMapper(UserContract, (row: any) => ({
        ...row,
        name: row.name.toUpperCase(),
      }))

      const dbRow = {
        id: 'user-123',
        name: 'test user',
      }

      const result = mapper(dbRow)
      expect(result.name).toBe('TEST USER')
    })
  })

  describe('createContractToDbMapper', () => {
    it('should create a mapper function', () => {
      const mapper = createContractToDbMapper()
      expect(typeof mapper).toBe('function')
    })

    it('should map contract data to database insert', () => {
      const mapper = createContractToDbMapper()
      const contractData = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const result = mapper(contractData)
      expect(result).toEqual(contractData)
    })

    it('should use custom mapper function', () => {
      const mapper = createContractToDbMapper((data) => ({
        ...data,
        name: data.name.toLowerCase(),
      }))

      const contractData = {
        id: 'user-123',
        name: 'TEST USER',
      }

      const result = mapper(contractData)
      expect(result.name).toBe('test user')
    })
  })

  describe('batchDbRowsToContract', () => {
    it('should batch convert database rows', () => {
      const dbRows = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ]

      const results = batchDbRowsToContract(UserContract, dbRows)
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('user-1')
      expect(results[1].id).toBe('user-2')
    })
  })

  describe('batchContractToDbInsert', () => {
    it('should batch convert contract data', () => {
      const contractData = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ]

      const results = batchContractToDbInsert(contractData)
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('user-1')
    })
  })

  describe('isDbRowAndContract', () => {
    it('should return true for matching data', () => {
      const value = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      expect(isDbRowAndContract(UserContract, value)).toBe(true)
    })

    it('should return false for non-matching data', () => {
      const value = {
        id: 'user-123',
        // Missing required 'name' field
      }

      expect(isDbRowAndContract(UserContract, value)).toBe(false)
    })
  })

  describe('createTableContractRegistry', () => {
    it('should create a registry with type-safe access', () => {
      // Create a contract that matches a subset of the database schema
      // This is a valid use case - contracts can be more restrictive than DB types
      const UserContractForTest = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email().optional(),
          name: z.string(),
        }),
      })

      // Type assertion is needed because contracts can be more restrictive than DB types
      // This is safe because the contract will validate at runtime
      const registry = createTableContractRegistry<Database>({
        users: UserContractForTest as Contract<Database['public']['Tables']['users']['Row']>,
      })

      expect(registry).toBeDefined()
      expect(typeof registry.validate).toBe('function')
      expect(typeof registry.getContract).toBe('function')
    })

    it('should validate rows using table contracts', () => {
      const UserContractForTest = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email().optional(),
          name: z.string(),
        }),
      })

      const registry = createTableContractRegistry<Database>({
        users: UserContractForTest as Contract<Database['public']['Tables']['users']['Row']>,
      })

      // Create a valid database row (with all required fields)
      const validRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Database['public']['Tables']['users']['Row']

      const result = registry.validate('users', validRow)
      expect(result).toBeDefined()
      if (result) {
        expect(result.success).toBe(true)
      }
    })

    it('should return undefined for unregistered tables', () => {
      // Empty registry is valid - not all tables need contracts
      const registry = createTableContractRegistry<Database>({})
      const contract = registry.getContract('users')
      expect(contract).toBeUndefined()
    })
  })
})
