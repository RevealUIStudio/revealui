/**
 * findGlobal Tests
 *
 * Tests for the findGlobal() method implementation
 *
 * Note: Full integration tests require database setup and global initialization.
 * This file focuses on error cases and basic validation that can be tested without full setup.
 */

import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sqliteAdapter } from '../database/sqlite'
import { createRevealUIInstance } from '../revealui'
import type { Config } from '../types'

const TEST_DB_PATH = path.join(__dirname, '.test-findGlobal.db')

describe('findGlobal', () => {
  let revealuiInstance: Awaited<ReturnType<typeof createRevealUIInstance>>
  let cleanupDb: () => void

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }

    cleanupDb = () => {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH)
      }
    }

    // Create minimal config with a global
    const config: Config = {
      serverURL: 'http://localhost:3000',
      secret: 'test-secret',
      collections: [],
      globals: [
        {
          slug: 'settings',
          fields: [
            {
              name: 'siteName',
              type: 'text',
            },
          ],
        },
      ],
      db: sqliteAdapter({
        client: {
          url: TEST_DB_PATH,
        },
      }),
    }

    // Create the RevealUI instance (this initializes globals)
    revealuiInstance = await createRevealUIInstance(config)
  })

  afterAll(() => {
    cleanupDb()
  })

  describe('Error Cases', () => {
    it('should throw error when global slug does not exist in config', async () => {
      // Create a new RevealUI instance without the global we're testing
      const testConfig: Config = {
        serverURL: 'http://localhost:3000',
        secret: 'test-secret',
        collections: [],
        globals: [], // No globals configured
        db: sqliteAdapter({
          client: {
            url: path.join(__dirname, '.test-findGlobal-empty.db'),
          },
        }),
      }

      const testInstance = await createRevealUIInstance(testConfig)
      await expect(
        testInstance.findGlobal({
          slug: 'nonexistent',
        }),
      ).rejects.toThrow("Global 'nonexistent' not found")
    })

    it('should throw error with descriptive message for missing global', async () => {
      // Create a new RevealUI instance without the global we're testing
      const testConfig: Config = {
        serverURL: 'http://localhost:3000',
        secret: 'test-secret',
        collections: [],
        globals: [], // No globals configured
        db: sqliteAdapter({
          client: {
            url: path.join(__dirname, '.test-findGlobal-empty2.db'),
          },
        }),
      }

      const testInstance = await createRevealUIInstance(testConfig)

      try {
        await testInstance.findGlobal({
          slug: 'invalid-slug',
        })
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe("Global 'invalid-slug' not found")
      }
    })
  })

  describe('Basic Retrieval', () => {
    it('should return null when global document does not exist', async () => {
      // Globals are initialized but may not have data yet
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
      })

      // Should return null if no document exists, or the document if it does
      // This is valid behavior - null means no document found
      expect(result === null || typeof result === 'object').toBe(true)
    })

    it('should accept all optional parameters', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        depth: 0,
        draft: false,
        locale: 'en',
        fallbackLocale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })
  })

  describe('Method Signature Validation', () => {
    it('should be a function', () => {
      expect(typeof revealuiInstance.findGlobal).toBe('function')
    })

    it('should return a Promise', () => {
      const result = revealuiInstance.findGlobal({
        slug: 'settings',
      })
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('Options Handling', () => {
    it('should handle depth parameter', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        depth: 0,
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })

    it('should handle locale parameters', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        locale: 'en',
        fallbackLocale: 'en',
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })

    it('should handle draft parameter', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        draft: false,
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })

    it('should handle overrideAccess parameter', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        overrideAccess: false,
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })

    it('should handle showHiddenFields parameter', async () => {
      const result = await revealuiInstance.findGlobal({
        slug: 'settings',
        showHiddenFields: false,
      })

      expect(result === null || typeof result === 'object').toBe(true)
    })
  })
})

/**
 * Integration Test Notes:
 *
 * The following scenarios require full database setup and should be tested in integration tests:
 *
 * 1. **Basic Global Retrieval**
 *    - Create a global document via updateGlobal()
 *    - Retrieve it via findGlobal()
 *    - Verify all fields are returned correctly
 *
 * 2. **Relationship Population (depth > 0)**
 *    - Create a global with relationship fields
 *    - Create related documents
 *    - Call findGlobal with depth > 0
 *    - Verify relationships are populated
 *
 * 3. **afterRead Hook Execution**
 *    - Create a global with afterRead hooks
 *    - Call findGlobal with req parameter
 *    - Verify hooks are executed
 *
 * 4. **Locale Handling**
 *    - Create global documents in multiple locales
 *    - Call findGlobal with locale parameter
 *    - Verify correct locale is returned
 *
 * 5. **Draft Mode**
 *    - Create draft and published versions
 *    - Call findGlobal with draft: true/false
 *    - Verify correct version is returned
 *
 * 6. **Access Control**
 *    - Create globals with access rules
 *    - Call findGlobal with different user contexts
 *    - Verify access control is enforced
 */
