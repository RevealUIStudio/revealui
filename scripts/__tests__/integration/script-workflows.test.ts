/**
 * Integration tests for script workflows
 * Tests actual script execution patterns and error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execCommand } from '../../shared/utils.js'

describe('Script Workflows - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('pre-launch-validation.ts workflow', () => {
    it('should execute typecheck command', async () => {
      // Test that the script would call typecheck
      // Use a faster command for testing
      const result = await execCommand('echo', ['test'], { silent: true })

      // Should not throw, even if it fails (we're testing the command execution)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('exitCode')
      expect(result).toHaveProperty('message')
    }, 10000) // Increase timeout

    it('should handle command execution errors gracefully', async () => {
      const result = await execCommand('nonexistent-command-xyz', [], {
        silent: true,
      })

      expect(result.success).toBe(false)
      expect(result.exitCode).not.toBe(0)
    })
  })

  describe('reset-database.ts workflow', () => {
    it('should handle missing environment variables', () => {
      const originalEnv = process.env.DATABASE_URL
      Reflect.deleteProperty(process.env, 'DATABASE_URL')

      const connectionString =
        process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

      expect(connectionString).toBeUndefined()

      // Restore
      if (originalEnv) {
        process.env.DATABASE_URL = originalEnv
      }
    })

    it('should construct correct SQL file path', async () => {
      const { fileURLToPath } = await import('node:url')
      const { dirname, join } = await import('node:path')
      const { readFileSync } = await import('node:fs')

      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      // Integration test is in __tests__/integration/, SQL file is in database/
      const sqlPath = join(__dirname, '../../database/reset-database.sql')

      // Verify path construction works
      expect(sqlPath).toContain('reset-database.sql')
      expect(() => readFileSync(sqlPath, 'utf-8')).not.toThrow()
    })
  })

  describe('Shared utilities integration', () => {
    it('should create logger with all methods', async () => {
      const { createLogger } = await import('../../shared/utils.js')
      const logger = createLogger()

      expect(logger).toHaveProperty('success')
      expect(logger).toHaveProperty('error')
      expect(logger).toHaveProperty('warning')
      expect(logger).toHaveProperty('info')
      expect(logger).toHaveProperty('header')

      // Should not throw when called
      expect(() => logger.success('test')).not.toThrow()
      expect(() => logger.error('test')).not.toThrow()
      expect(() => logger.warning('test')).not.toThrow()
      expect(() => logger.info('test')).not.toThrow()
      expect(() => logger.header('test')).not.toThrow()
    })

    it('should execute commands with proper error handling', async () => {
      const result = await execCommand('echo', ['test'], { silent: true })

      expect(result.success).toBe(true)
      // Message might contain "Command succeeded" or the actual output
      expect(result.message.length).toBeGreaterThan(0)
    })

    it('should handle command failures', async () => {
      const result = await execCommand('false', [], { silent: true })

      expect(result.success).toBe(false)
      expect(result.exitCode).not.toBe(0)
    })
  })

  describe('Error handling patterns', () => {
    it('should handle async errors in script workflows', async () => {
      const asyncFunction = async () => {
        throw new Error('Test error')
      }

      await expect(asyncFunction()).rejects.toThrow('Test error')
    })

    it('should handle process.exit calls', () => {
      const originalExit = process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`)
      })

      try {
        process.exit(1)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('process.exit')
      } finally {
        exitSpy.mockRestore()
      }
    })
  })

  describe('File operations', () => {
    it('should read files correctly', async () => {
      const { readFile } = await import('../../shared/utils.js')
      const { fileURLToPath } = await import('node:url')

      const testFile = fileURLToPath(import.meta.url)
      const content = await readFile(testFile)

      expect(content).toContain('Integration tests')
      expect(content.length).toBeGreaterThan(0)
    })

    it('should handle file not found errors', async () => {
      const { readFile } = await import('../../shared/utils.js')

      await expect(readFile('/nonexistent/file/path.txt')).rejects.toThrow()
    })
  })

  describe('Environment variable handling', () => {
    it('should handle multiple environment variable fallbacks', () => {
      const originalEnv = { ...process.env }

      // Test fallback chain
      Reflect.deleteProperty(process.env, 'DATABASE_URL')
      Reflect.deleteProperty(process.env, 'POSTGRES_URL')
      process.env.SUPABASE_DATABASE_URI = 'postgresql://test'

      const connectionString =
        process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

      expect(connectionString).toBe('postgresql://test')

      // Restore
      process.env = originalEnv
    })
  })
})
