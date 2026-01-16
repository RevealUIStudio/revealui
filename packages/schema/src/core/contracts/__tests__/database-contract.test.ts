/**
 * Tests for Database Contract Integration
 *
 * Verifies that:
 * - DB types convert to Contracts
 * - Contracts validate DB data
 * - Type safety across layers
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createContract } from '../contract.js'
import {
  contractToDbInsert,
  databaseContractRegistry,
  dbRowToContract,
  isDbRowMatchingContract,
  safeDbRowToContract,
} from '../database-contract.js'

// Create a test contract
const UserContract = createContract({
  name: 'User',
  version: '1.0.0',
  schema: z.object({
    id: z.string(),
    email: z.string().email().optional(),
    name: z.string(),
  }),
})

describe('Database Contract Integration', () => {
  describe('dbRowToContract', () => {
    it('should convert valid database row to contract', () => {
      const dbRow = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const result = dbRowToContract(UserContract, dbRow)
      expect(result.id).toBe('user-123')
      expect(result.email).toBe('user@example.com')
      expect(result.name).toBe('Test User')
    })

    it('should throw on invalid data', () => {
      const invalidRow = {
        id: 'user-123',
        // Missing required 'name' field
      }

      expect(() => dbRowToContract(UserContract, invalidRow)).toThrow()
    })
  })

  describe('safeDbRowToContract', () => {
    it('should return success result for valid data', () => {
      const dbRow = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const result = safeDbRowToContract(UserContract, dbRow)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('user-123')
      }
    })

    it('should return error result for invalid data', () => {
      const invalidRow = {
        id: 'user-123',
        // Missing required 'name' field
      }

      const result = safeDbRowToContract(UserContract, invalidRow)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toBeDefined()
      }
    })
  })

  describe('contractToDbInsert', () => {
    it('should convert contract data to database insert type', () => {
      const contractData = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const dbInsert = contractToDbInsert<typeof contractData, any>(contractData)
      expect(dbInsert).toEqual(contractData)
    })
  })

  describe('isDbRowMatchingContract', () => {
    it('should return true for matching data', () => {
      const dbRow = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      expect(isDbRowMatchingContract(UserContract, dbRow)).toBe(true)
    })

    it('should return false for non-matching data', () => {
      const invalidRow = {
        id: 'user-123',
        // Missing required 'name' field
      }

      expect(isDbRowMatchingContract(UserContract, invalidRow)).toBe(false)
    })
  })

  describe('databaseContractRegistry', () => {
    it('should register and retrieve contracts', () => {
      databaseContractRegistry.register('users', UserContract)
      const retrieved = databaseContractRegistry.get('users')
      expect(retrieved).toBe(UserContract)
    })

    it('should validate rows using registered contracts', () => {
      databaseContractRegistry.register('users', UserContract)

      const validRow = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      }

      const result = databaseContractRegistry.validateRow('users', validRow)
      expect(result).toBeDefined()
      expect(result?.success).toBe(true)
    })

    it('should return null for unregistered tables', () => {
      const result = databaseContractRegistry.validateRow('nonexistent', {})
      expect(result).toBeNull()
    })
  })
})
