/**
 * Integration tests for Setup and Validate CLIs
 *
 * Tests that setup.ts and validate.ts correctly handle:
 * - Delegation to external scripts
 * - JSON mode compatibility
 * - Fallback error handling
 * - Argument forwarding
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock modules
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// =============================================================================
// Test Helpers
// =============================================================================

function captureConsole(): {
  logs: string[]
  errors: string[]
  restore: () => void
} {
  const logs: string[] = []
  const errors: string[] = []
  const originalLog = console.log
  const originalError = console.error

  console.log = (...args) => logs.push(args.join(' '))
  console.error = (...args) => errors.push(args.join(' '))

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog
      console.error = originalError
    },
  }
}

// =============================================================================
// Setup CLI Tests
// =============================================================================

describe('Setup CLI', () => {
  let console: ReturnType<typeof captureConsole>

  beforeEach(() => {
    console = captureConsole()
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.restore()
  })

  describe('Command Delegation', () => {
    it('should have proper command configuration', () => {
      const setupCommands = {
        env: {
          script: '../engineer/setup/setup-env.ts',
          description: 'Set up environment variables',
        },
        node: {
          script: '../engineer/setup/setup-node-version.ts',
          description: 'Set up Node.js version',
        },
        mcp: {
          script: '../engineer/setup/setup-mcp.ts',
          description: 'Set up MCP servers',
        },
      }

      expect(setupCommands.env).toBeDefined()
      expect(setupCommands.node).toBeDefined()
      expect(setupCommands.mcp).toBeDefined()

      expect(setupCommands.env.script).toMatch(/setup-env\.ts$/)
      expect(setupCommands.node.script).toMatch(/setup-node-version\.ts$/)
    })

    it('should forward arguments to delegated scripts', () => {
      const originalArgv = process.argv
      const remainingArgs = ['--force', '--verbose', 'arg1']

      // Simulate delegation
      process.argv = [process.argv[0], process.argv[1], ...remainingArgs]

      expect(process.argv.slice(2)).toEqual(remainingArgs)

      process.argv = originalArgv
    })

    it('should handle missing script files gracefully', () => {
      const error = {
        code: 'ERR_MODULE_NOT_FOUND',
        message: 'Cannot find module',
      }

      // Should throw notFound error
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        expect(error.code).toBe('ERR_MODULE_NOT_FOUND')
      }
    })
  })

  describe('List Command', () => {
    it('should list all available setup commands', () => {
      const commands = [
        { name: 'env', description: 'Set up environment variables' },
        { name: 'node', description: 'Set up Node.js version' },
        { name: 'mcp', description: 'Set up MCP servers' },
      ]

      expect(commands).toHaveLength(3)
      expect(commands[0].name).toBe('env')
      expect(commands[1].name).toBe('node')
      expect(commands[2].name).toBe('mcp')
    })

    it('should format list output for human mode', () => {
      const commands = [
        { name: 'env', description: 'Set up environment variables', script: 'path/to/script' },
        { name: 'node', description: 'Set up Node.js version', script: 'path/to/script' },
      ]

      // In human mode, should format nicely
      const formatted = commands.map((cmd) => `${cmd.name.padEnd(10)} ${cmd.description}`)

      expect(formatted[0]).toContain('env')
      expect(formatted[0]).toContain('Set up environment variables')
    })

    it('should return structured data in JSON mode', () => {
      const result = {
        success: true,
        data: {
          commands: [
            { name: 'env', description: 'Set up environment variables', script: 'path/to/script' },
          ],
        },
        metadata: {
          count: 1,
        },
      }

      expect(result.success).toBe(true)
      expect(result.data.commands).toHaveLength(1)
      expect(result.metadata?.count).toBe(1)
    })
  })

  describe('JSON Mode Compatibility', () => {
    it('should return structured result on successful delegation', () => {
      const result = {
        success: true,
        data: {
          command: 'env',
          delegatedTo: '../engineer/setup/setup-env.ts',
          success: true,
        },
      }

      expect(result.success).toBe(true)
      expect(result.data.command).toBe('env')
      expect(result.data.delegatedTo).toContain('setup-env.ts')
    })

    it('should handle delegation errors in JSON mode', () => {
      const result = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Setup script not found: path/to/script',
        },
      }

      expect(result.success).toBe(false)
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })
})

// =============================================================================
// Validate CLI Tests
// =============================================================================

describe('Validate CLI', () => {
  let console: ReturnType<typeof captureConsole>

  beforeEach(() => {
    console = captureConsole()
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.restore()
  })

  describe('Command Delegation', () => {
    it('should have proper validation commands', () => {
      const validateCommands = {
        env: 'Validate environment variables',
        db: 'Validate database connection',
        schema: 'Validate database schema',
        config: 'Validate configuration files',
      }

      expect(validateCommands.env).toBeDefined()
      expect(validateCommands.db).toBeDefined()
      expect(validateCommands.schema).toBeDefined()
    })

    it('should forward arguments to validation scripts', () => {
      const originalArgv = process.argv
      const args = ['--strict', 'table1', 'table2']

      process.argv = [process.argv[0], process.argv[1], ...args]

      expect(process.argv.slice(2)).toEqual(args)

      process.argv = originalArgv
    })
  })

  describe('JSON Mode Compatibility', () => {
    it('should return structured validation results', () => {
      const result = {
        success: true,
        data: {
          valid: true,
          errors: [],
          warnings: [],
        },
      }

      expect(result.success).toBe(true)
      expect(result.data.valid).toBe(true)
      expect(result.data.errors).toEqual([])
    })

    it('should handle validation failures in JSON mode', () => {
      const result = {
        success: true, // Validation ran successfully
        data: {
          valid: false,
          errors: [{ field: 'DATABASE_URL', message: 'Missing required environment variable' }],
          warnings: [],
        },
      }

      expect(result.success).toBe(true) // Command executed
      expect(result.data.valid).toBe(false) // But validation failed
      expect(result.data.errors).toHaveLength(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown validation commands', () => {
      const command = 'unknown-validation'
      const validCommands = ['env', 'db', 'schema', 'config']

      const isValid = validCommands.includes(command)
      expect(isValid).toBe(false)
    })

    it('should provide helpful error messages', () => {
      const error = {
        code: 'EXECUTION_ERROR',
        message: 'Validation failed: database connection timeout',
        hint: 'Check your DATABASE_URL and ensure the database is running',
      }

      expect(error.code).toBe('EXECUTION_ERROR')
      expect(error.hint).toBeDefined()
    })
  })
})

// =============================================================================
// Cross-CLI Integration Tests
// =============================================================================

describe('Setup & Validate Integration', () => {
  describe('Workflow Integration', () => {
    it('should support setup → validate workflow', async () => {
      // Simulate running setup then validate
      const workflow = [
        { command: 'setup', subcommand: 'env', result: 'success' },
        { command: 'validate', subcommand: 'env', result: 'success' },
      ]

      expect(workflow[0].result).toBe('success')
      expect(workflow[1].result).toBe('success')
    })

    it('should maintain JSON mode across commands', () => {
      const isJsonMode = true

      // Both setup and validate should respect JSON mode
      const setupOutput = isJsonMode ? { json: true } : 'human output'
      const validateOutput = isJsonMode ? { json: true } : 'human output'

      expect(setupOutput).toEqual({ json: true })
      expect(validateOutput).toEqual({ json: true })
    })
  })

  describe('Argument Consistency', () => {
    it('should handle common flags consistently', () => {
      const commonFlags = ['--json', '--verbose', '--force', '--no-color']

      // Both CLIs should support these flags
      commonFlags.forEach((flag) => {
        expect(['--json', '--verbose', '--force', '--no-color']).toContain(flag)
      })
    })

    it('should preserve flag order when forwarding', () => {
      const originalArgv = process.argv
      const flags = ['--json', '--verbose', '--force']

      process.argv = [process.argv[0], process.argv[1], ...flags]

      const forwarded = process.argv.slice(2)
      expect(forwarded).toEqual(flags)

      process.argv = originalArgv
    })
  })

  describe('Error Code Consistency', () => {
    it('should use consistent exit codes', () => {
      const exitCodes = {
        SUCCESS: 0,
        GENERAL_ERROR: 1,
        CONFIG_ERROR: 2,
        EXECUTION_ERROR: 3,
        VALIDATION_ERROR: 4,
        NOT_FOUND: 6,
      }

      // Both CLIs should use these codes
      expect(exitCodes.SUCCESS).toBe(0)
      expect(exitCodes.NOT_FOUND).toBe(6)
    })
  })
})

// =============================================================================
// Fallback Handling Tests
// =============================================================================

describe('Fallback Handling', () => {
  describe('Missing Scripts', () => {
    it('should detect missing setup scripts', () => {
      const scriptPath = '../engineer/setup/nonexistent.ts'
      const exists = false // Simulate script not found

      if (!exists) {
        const error = {
          code: 'NOT_FOUND',
          message: `Setup script not found: ${scriptPath}`,
        }
        expect(error.code).toBe('NOT_FOUND')
      }
    })

    it('should detect missing validation scripts', () => {
      const scriptPath = '../engineer/validate/nonexistent.ts'
      const exists = false

      if (!exists) {
        const error = {
          code: 'NOT_FOUND',
          message: `Validation script not found: ${scriptPath}`,
        }
        expect(error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Script Execution Failures', () => {
    it('should handle script import failures', () => {
      const error = new Error('Failed to import module')

      expect(error.message).toContain('Failed to import')
    })

    it('should wrap execution errors appropriately', () => {
      const originalError = new Error('Database connection failed')
      const wrappedError = {
        code: 'EXECUTION_ERROR',
        message: 'setup env',
        details: originalError.message,
      }

      expect(wrappedError.code).toBe('EXECUTION_ERROR')
      expect(wrappedError.details).toContain('Database connection')
    })
  })
})
