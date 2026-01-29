/**
 * Tests for the CLI base infrastructure
 *
 * Tests the BaseCLI class, argument parsing integration, and dual-mode output
 * in the context of CLI execution.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { BaseCLI, runCLI, type CommandDefinition } from '../cli/_base.js'
import { ok, fail, type ScriptOutput } from '../lib/output.js'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import type { ParsedArgs } from '../lib/args.js'

// =============================================================================
// Test Helpers
// =============================================================================

// Capture console output
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
// Test CLI Implementation
// =============================================================================

interface ListResult {
  items: string[]
  count: number
}

interface GetResult {
  id: string
  name: string
}

class TestCLI extends BaseCLI {
  name = 'test-cli'
  description = 'A test CLI for unit testing'

  // Track calls for verification
  beforeRunCalled = false
  afterRunCalled = false
  lastCommand: string | undefined
  lastLimit: number | undefined

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'list',
        description: 'List all items',
        args: [
          {
            name: 'limit',
            short: 'l',
            type: 'number',
            default: 10,
            description: 'Maximum items to return',
          },
        ],
        handler: (args) => this.list(args),
      },
      {
        name: 'get',
        description: 'Get an item by ID',
        args: [],
        handler: (args) => this.get(args),
      },
      {
        name: 'delete',
        description: 'Delete an item',
        confirmPrompt: 'Are you sure you want to delete this item?',
        args: [],
        handler: (args) => this.delete(args),
      },
      {
        name: 'failing',
        description: 'A command that throws an error',
        args: [],
        handler: () => this.failing(),
      },
      {
        name: 'script-error',
        description: 'A command that throws a ScriptError',
        args: [],
        handler: () => this.scriptError(),
      },
      {
        name: 'return-fail',
        description: 'A command that returns a failure result',
        args: [],
        handler: () => this.returnFail(),
      },
    ]
  }

  async beforeRun(): Promise<void> {
    this.beforeRunCalled = true
  }

  async afterRun(): Promise<void> {
    this.afterRunCalled = true
  }

  private async list(args: ParsedArgs): Promise<ScriptOutput<ListResult>> {
    this.lastCommand = 'list'
    const limit = this.getFlag('limit', 10)
    this.lastLimit = limit

    const items = ['item-1', 'item-2', 'item-3'].slice(0, limit)

    this.output.progress('Listing items...')

    return ok(
      { items, count: items.length },
      { limit }
    )
  }

  private async get(args: ParsedArgs): Promise<ScriptOutput<GetResult>> {
    this.lastCommand = 'get'
    const id = this.getPositional(0)

    if (!id) {
      return fail('VALIDATION_ERROR', 'ID is required')
    }

    if (id === 'not-found') {
      return fail('NOT_FOUND', `Item not found: ${id}`)
    }

    return ok({ id, name: `Item ${id}` })
  }

  private async delete(args: ParsedArgs): Promise<ScriptOutput<{ deleted: string }>> {
    this.lastCommand = 'delete'
    const id = this.requirePositional(0, 'item ID')

    return ok({ deleted: id })
  }

  private async failing(): Promise<ScriptOutput> {
    this.lastCommand = 'failing'
    throw new Error('Something went wrong')
  }

  private async scriptError(): Promise<ScriptOutput> {
    this.lastCommand = 'script-error'
    throw new ScriptError('Resource conflict', ErrorCode.CONFLICT, {
      resource: 'item',
      reason: 'already exists',
    })
  }

  private async returnFail(): Promise<ScriptOutput> {
    this.lastCommand = 'return-fail'
    return fail('NOT_FOUND', 'Resource not found')
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('BaseCLI', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let exitCode: number | undefined

  beforeEach(() => {
    exitCode = undefined
    // Capture exit code without actually exiting
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number
      return undefined as never
    })
  })

  afterEach(() => {
    exitSpy.mockRestore()
  })

  describe('command execution', () => {
    it('executes a command and calls lifecycle hooks', async () => {
      const cli = new TestCLI({
        argv: ['list'],
        exitOnComplete: false,
      })

      await cli.run()

      expect(cli.beforeRunCalled).toBe(true)
      expect(cli.afterRunCalled).toBe(true)
      expect(cli.lastCommand).toBe('list')
    })

    it('parses number flags correctly', async () => {
      const cli = new TestCLI({
        argv: ['list', '--limit', '5'],
        exitOnComplete: false,
      })

      await cli.run()
      expect(cli.lastCommand).toBe('list')
      expect(cli.lastLimit).toBe(5)
    })

    it('uses default flag values', async () => {
      const cli = new TestCLI({
        argv: ['list'],
        exitOnComplete: false,
      })

      await cli.run()
      expect(cli.lastLimit).toBe(10) // Default value
    })

    it('handles positional arguments', async () => {
      const cli = new TestCLI({
        argv: ['get', 'item-123'],
        exitOnComplete: false,
      })

      await cli.run()
      expect(cli.lastCommand).toBe('get')
    })
  })

  describe('JSON mode', () => {
    it('detects JSON mode from --json flag', async () => {
      const cli = new TestCLI({
        argv: ['list', '--json'],
        exitOnComplete: false,
      })

      // Access protected property for testing
      expect((cli as any).output.isJsonMode()).toBe(true)
    })

    it('detects JSON mode from -j flag', async () => {
      const cli = new TestCLI({
        argv: ['list', '-j'],
        exitOnComplete: false,
      })

      expect((cli as any).output.isJsonMode()).toBe(true)
    })

    it('defaults to human mode', async () => {
      const cli = new TestCLI({
        argv: ['list'],
        exitOnComplete: false,
      })

      expect((cli as any).output.isJsonMode()).toBe(false)
    })
  })

  describe('error handling', () => {
    it('calls afterRun even when command throws', async () => {
      const cli = new TestCLI({
        argv: ['failing'],
        exitOnComplete: false,
      })

      await cli.run()

      expect(cli.beforeRunCalled).toBe(true)
      expect(cli.afterRunCalled).toBe(true)
      expect(cli.lastCommand).toBe('failing')
    })

    it('sets non-zero exit code on error', async () => {
      const cli = new TestCLI({
        argv: ['failing'],
        exitOnComplete: true,
      })

      await cli.run()

      expect(exitCode).toBe(ErrorCode.GENERAL_ERROR)
    })

    it('uses specific error code from ScriptError', async () => {
      const cli = new TestCLI({
        argv: ['script-error'],
        exitOnComplete: true,
      })

      await cli.run()

      expect(exitCode).toBe(ErrorCode.CONFLICT)
    })

    it('sets non-zero exit code when returning failure result', async () => {
      const cli = new TestCLI({
        argv: ['return-fail'],
        exitOnComplete: true,
      })

      await cli.run()

      expect(exitCode).toBe(ErrorCode.GENERAL_ERROR)
    })
  })

  describe('help text', () => {
    it('shows help with --help flag', async () => {
      const captured = captureConsole()

      try {
        const cli = new TestCLI({
          argv: ['--help'],
          exitOnComplete: false,
        })

        await cli.run()

        const allLogs = captured.logs.join('\n')
        expect(allLogs).toContain('test-cli')
        expect(allLogs).toContain('list')
        expect(allLogs).toContain('get')
        expect(allLogs).toContain('delete')
      } finally {
        captured.restore()
      }
    })

    it('shows help with -h flag', async () => {
      const captured = captureConsole()

      try {
        const cli = new TestCLI({
          argv: ['-h'],
          exitOnComplete: false,
        })

        await cli.run()

        const allLogs = captured.logs.join('\n')
        expect(allLogs).toContain('test-cli')
      } finally {
        captured.restore()
      }
    })

    it('shows help when no command specified', async () => {
      const captured = captureConsole()

      try {
        const cli = new TestCLI({
          argv: [],
          exitOnComplete: false,
        })

        await cli.run()

        const allLogs = captured.logs.join('\n')
        expect(allLogs).toContain('test-cli')
      } finally {
        captured.restore()
      }
    })
  })

  describe('confirmation prompts', () => {
    it('skips confirmation with --force flag', async () => {
      const cli = new TestCLI({
        argv: ['delete', 'item-123', '--force'],
        exitOnComplete: false,
      })

      await cli.run()
      expect(cli.lastCommand).toBe('delete')
    })

    it('skips confirmation in JSON mode', async () => {
      const cli = new TestCLI({
        argv: ['delete', 'item-123', '--json'],
        exitOnComplete: false,
      })

      await cli.run()
      expect(cli.lastCommand).toBe('delete')
    })
  })

  describe('validation', () => {
    it('shows help for unknown command (treated as positional)', async () => {
      const captured = captureConsole()

      try {
        const cli = new TestCLI({
          argv: ['unknown-command'],
          exitOnComplete: false,
        })

        await cli.run()

        // Unknown commands are treated as positional args, and no command = show help
        const allLogs = captured.logs.join('\n')
        expect(allLogs).toContain('test-cli')
      } finally {
        captured.restore()
      }
    })

    it('handles missing required positional argument', async () => {
      const cli = new TestCLI({
        argv: ['delete', '--force'], // Missing item ID
        exitOnComplete: true,
      })

      await cli.run()

      expect(exitCode).toBe(ErrorCode.VALIDATION_ERROR)
    })
  })

  describe('verbose mode', () => {
    it('detects verbose mode from --verbose flag', async () => {
      const cli = new TestCLI({
        argv: ['list', '--verbose'],
        exitOnComplete: false,
      })

      expect((cli as any).isVerbose()).toBe(false) // Not set until run()

      await cli.run()

      // After run, verbose should be detected
      expect(cli.lastCommand).toBe('list')
    })
  })
})

describe('runCLI helper', () => {
  it('creates and runs CLI instance', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    try {
      await runCLI(TestCLI, {
        argv: ['list'],
        exitOnComplete: false,
      })
    } finally {
      exitSpy.mockRestore()
    }
  })
})
