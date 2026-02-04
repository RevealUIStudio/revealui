/**
 * Tests for Operations CLI
 *
 * @dependencies
 * - vitest - Testing framework (beforeEach, describe, expect, it)
 * - scripts/cli/ops.ts - Operations CLI class
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { OpsCLI } from '../../cli/ops.js'

describe('OpsCLI', () => {
  let cli: OpsCLI

  beforeEach(() => {
    cli = new OpsCLI()
  })

  describe('CLI metadata', () => {
    it('should have correct name and description', () => {
      expect(cli.name).toBe('ops')
      expect(cli.description).toBe('Operations and maintenance commands')
    })

    it('should have execution logging enabled', () => {
      // @ts-expect-error - Accessing protected property for testing
      expect(cli.enableExecutionLogging).toBe(true)
    })
  })

  describe('command definitions', () => {
    it('should define fix-imports command', () => {
      const commands = cli.defineCommands()
      const fixImports = commands.find((c) => c.name === 'fix-imports')

      expect(fixImports).toBeTruthy()
      expect(fixImports?.description).toContain('import')
    })

    it('should define fix-lint command', () => {
      const commands = cli.defineCommands()
      const fixLint = commands.find((c) => c.name === 'fix-lint')

      expect(fixLint).toBeTruthy()
      expect(fixLint?.description).toContain('lint')
    })

    it('should define fix-types command', () => {
      const commands = cli.defineCommands()
      const fixTypes = commands.find((c) => c.name === 'fix-types')

      expect(fixTypes).toBeTruthy()
      expect(fixTypes?.description).toContain('TypeScript')
    })

    it('should define fix-supabase command', () => {
      const commands = cli.defineCommands()
      const fixSupabase = commands.find((c) => c.name === 'fix-supabase')

      expect(fixSupabase).toBeTruthy()
      expect(fixSupabase?.description).toContain('Supabase')
    })

    it('should define audit-scripts command', () => {
      const commands = cli.defineCommands()
      const auditScripts = commands.find((c) => c.name === 'audit-scripts')

      expect(auditScripts).toBeTruthy()
      expect(auditScripts?.description).toContain('audit')
      expect(auditScripts?.args).toBeDefined()
      expect(auditScripts?.args?.some((a) => a.name === 'show-duplicates')).toBe(true)
    })

    it('should define validate-scripts command', () => {
      const commands = cli.defineCommands()
      const validateScripts = commands.find((c) => c.name === 'validate-scripts')

      expect(validateScripts).toBeTruthy()
      expect(validateScripts?.args).toBeDefined()
      expect(validateScripts?.args?.some((a) => a.name === 'package')).toBe(true)
      expect(validateScripts?.args?.some((a) => a.name === 'strict')).toBe(true)
    })

    it('should define fix-scripts command', () => {
      const commands = cli.defineCommands()
      const fixScripts = commands.find((c) => c.name === 'fix-scripts')

      expect(fixScripts).toBeTruthy()
      expect(fixScripts?.args).toBeDefined()
      expect(fixScripts?.args?.some((a) => a.name === 'backup')).toBe(true)
    })

    it('should define database commands', () => {
      const commands = cli.defineCommands()

      const dbSeed = commands.find((c) => c.name === 'db:seed')
      const dbReset = commands.find((c) => c.name === 'db:reset')
      const dbBackup = commands.find((c) => c.name === 'db:backup')
      const dbRestore = commands.find((c) => c.name === 'db:restore')

      expect(dbSeed).toBeTruthy()
      expect(dbReset).toBeTruthy()
      expect(dbBackup).toBeTruthy()
      expect(dbRestore).toBeTruthy()

      // Destructive operations should have confirm prompts
      expect(dbReset?.confirmPrompt).toBeTruthy()
      expect(dbRestore?.confirmPrompt).toBeTruthy()
    })

    it('should define migration commands', () => {
      const commands = cli.defineCommands()

      const migratePlan = commands.find((c) => c.name === 'migrate:plan')
      const migrateExecute = commands.find((c) => c.name === 'migrate:execute')
      const migrateCompare = commands.find((c) => c.name === 'migrate:compare')

      expect(migratePlan).toBeTruthy()
      expect(migrateExecute).toBeTruthy()
      expect(migrateCompare).toBeTruthy()

      // All should require script, from, to arguments
      for (const cmd of [migratePlan, migrateExecute, migrateCompare]) {
        expect(cmd?.args).toBeDefined()
        expect(cmd?.args?.some((a) => a.name === 'script')).toBe(true)
        expect(cmd?.args?.some((a) => a.name === 'from')).toBe(true)
        expect(cmd?.args?.some((a) => a.name === 'to')).toBe(true)
      }

      // Execute should have confirm prompt
      expect(migrateExecute?.confirmPrompt).toBeTruthy()
    })

    it('should define setup commands', () => {
      const commands = cli.defineCommands()

      const setupEnv = commands.find((c) => c.name === 'setup:env')
      const setupDeps = commands.find((c) => c.name === 'setup:deps')

      expect(setupEnv).toBeTruthy()
      expect(setupDeps).toBeTruthy()
    })

    it('should define rollback command', () => {
      const commands = cli.defineCommands()
      const rollback = commands.find((c) => c.name === 'rollback')

      expect(rollback).toBeTruthy()
      expect(rollback?.confirmPrompt).toBeTruthy()
      expect(rollback?.args).toBeDefined()
      expect(rollback?.args?.some((a) => a.name === 'checkpoint')).toBe(true)
    })

    it('should define clean command', () => {
      const commands = cli.defineCommands()
      const clean = commands.find((c) => c.name === 'clean')

      expect(clean).toBeTruthy()
      expect(clean?.confirmPrompt).toBeTruthy()
    })
  })

  describe('global args', () => {
    it('should define dry-run flag', () => {
      const globalArgs = cli.defineGlobalArgs()
      const dryRun = globalArgs.find((a) => a.name === 'dry-run')

      expect(dryRun).toBeTruthy()
      expect(dryRun?.type).toBe('boolean')
      expect(dryRun?.default).toBe(false)
    })

    it('should define path option', () => {
      const globalArgs = cli.defineGlobalArgs()
      const path = globalArgs.find((a) => a.name === 'path')

      expect(path).toBeTruthy()
      expect(path?.type).toBe('string')
    })
  })

  describe('command map', () => {
    it('should map fix commands to correct scripts', () => {
      // @ts-expect-error - Accessing protected property for testing
      const commandMap = cli.commandMap
      expect(commandMap['fix-imports']).toContain('fix-import-extensions.ts')
      expect(commandMap['fix-lint']).toContain('fix-linting-errors.ts')
      expect(commandMap['fix-types']).toContain('fix-typescript-errors.ts')
      expect(commandMap['fix-supabase']).toContain('fix-supabase-types.ts')
    })

    it('should map database commands to correct scripts', () => {
      // @ts-expect-error - Accessing protected property for testing
      const commandMap = cli.commandMap
      expect(commandMap['db:seed']).toContain('seed-sample-content.ts')
      expect(commandMap['db:reset']).toContain('reset-database.ts')
      expect(commandMap['db:backup']).toContain('backup.ts')
      expect(commandMap['db:restore']).toContain('restore.ts')
    })

    it('should map audit commands to correct scripts', () => {
      // @ts-expect-error - Accessing protected property for testing
      const commandMap = cli.commandMap
      expect(commandMap['audit-scripts']).toContain('audit-scripts.ts')
      expect(commandMap['audit:exit-codes']).toContain('audit-exit-codes.ts')
      expect(commandMap['validate-scripts']).toContain('validate-scripts.ts')
      expect(commandMap['fix-scripts']).toContain('fix-scripts.ts')
    })

    it('should map rollback commands to correct scripts', () => {
      // @ts-expect-error - Accessing protected property for testing
      const commandMap = cli.commandMap
      expect(commandMap['rollback:list']).toContain('rollback-list.ts')
      expect(commandMap['rollback:restore']).toContain('rollback-restore.ts')
      expect(commandMap['rollback:clear']).toContain('rollback-clear.ts')
    })

    it('should map setup commands to correct scripts', () => {
      // @ts-expect-error - Accessing protected property for testing
      const commandMap = cli.commandMap
      expect(commandMap['setup:env']).toContain('setup-env.ts')
      expect(commandMap['setup:deps']).toContain('install-dependencies.ts')
    })
  })

  describe('command handlers', () => {
    it('should have handler for clean command', () => {
      const commands = cli.defineCommands()
      const clean = commands.find((c) => c.name === 'clean')

      expect(clean?.handler).toBeDefined()
      expect(typeof clean?.handler).toBe('function')
    })

    it('should have handlers for migration commands', () => {
      const commands = cli.defineCommands()

      const migratePlan = commands.find((c) => c.name === 'migrate:plan')
      const migrateExecute = commands.find((c) => c.name === 'migrate:execute')
      const migrateCompare = commands.find((c) => c.name === 'migrate:compare')

      expect(migratePlan?.handler).toBeDefined()
      expect(migrateExecute?.handler).toBeDefined()
      expect(migrateCompare?.handler).toBeDefined()
    })

    it('should have handler for rollback command', () => {
      const commands = cli.defineCommands()
      const rollback = commands.find((c) => c.name === 'rollback')

      expect(rollback?.handler).toBeDefined()
      expect(typeof rollback?.handler).toBe('function')
    })
  })

  describe('command validation', () => {
    it('should have all required commands defined', () => {
      const commands = cli.defineCommands()
      const commandNames = commands.map((c) => c.name)

      const requiredCommands = [
        'fix-imports',
        'fix-lint',
        'fix-types',
        'fix-supabase',
        'audit-scripts',
        'validate-scripts',
        'fix-scripts',
        'db:seed',
        'db:reset',
        'db:backup',
        'db:restore',
        'migrate:plan',
        'migrate:execute',
        'migrate:compare',
        'setup:env',
        'setup:deps',
        'rollback',
        'clean',
      ]

      for (const required of requiredCommands) {
        expect(commandNames).toContain(required)
      }
    })

    it('should have unique command names', () => {
      const commands = cli.defineCommands()
      const commandNames = commands.map((c) => c.name)
      const uniqueNames = new Set(commandNames)

      expect(commandNames.length).toBe(uniqueNames.size)
    })

    it('should have descriptions for all commands', () => {
      const commands = cli.defineCommands()

      for (const command of commands) {
        expect(command.description).toBeTruthy()
        expect(typeof command.description).toBe('string')
        expect(command.description.length).toBeGreaterThan(0)
      }
    })

    it('should have handlers for all commands', () => {
      const commands = cli.defineCommands()

      for (const command of commands) {
        expect(command.handler).toBeDefined()
        expect(typeof command.handler).toBe('function')
      }
    })
  })

  describe('destructive command safety', () => {
    it('should require confirmation for db:reset', () => {
      const commands = cli.defineCommands()
      const dbReset = commands.find((c) => c.name === 'db:reset')

      expect(dbReset?.confirmPrompt).toBeTruthy()
      expect(dbReset?.confirmPrompt).toContain('delete')
    })

    it('should require confirmation for db:restore', () => {
      const commands = cli.defineCommands()
      const dbRestore = commands.find((c) => c.name === 'db:restore')

      expect(dbRestore?.confirmPrompt).toBeTruthy()
    })

    it('should require confirmation for migrate:execute', () => {
      const commands = cli.defineCommands()
      const migrateExecute = commands.find((c) => c.name === 'migrate:execute')

      expect(migrateExecute?.confirmPrompt).toBeTruthy()
    })

    it('should require confirmation for rollback', () => {
      const commands = cli.defineCommands()
      const rollback = commands.find((c) => c.name === 'rollback')

      expect(rollback?.confirmPrompt).toBeTruthy()
    })

    it('should require confirmation for clean', () => {
      const commands = cli.defineCommands()
      const clean = commands.find((c) => c.name === 'clean')

      expect(clean?.confirmPrompt).toBeTruthy()
    })
  })

  describe('command argument validation', () => {
    it('should validate audit-scripts args', () => {
      const commands = cli.defineCommands()
      const cmd = commands.find((c) => c.name === 'audit-scripts')

      expect(cmd?.args).toBeDefined()
      const showDuplicates = cmd?.args?.find((a) => a.name === 'show-duplicates')

      expect(showDuplicates?.type).toBe('boolean')
      expect(showDuplicates?.default).toBe(false)
    })

    it('should validate validate-scripts args', () => {
      const commands = cli.defineCommands()
      const cmd = commands.find((c) => c.name === 'validate-scripts')

      expect(cmd?.args).toBeDefined()
      const packageArg = cmd?.args?.find((a) => a.name === 'package')
      const strictArg = cmd?.args?.find((a) => a.name === 'strict')

      expect(packageArg?.type).toBe('string')
      expect(strictArg?.type).toBe('boolean')
      expect(strictArg?.default).toBe(false)
    })

    it('should validate fix-scripts args', () => {
      const commands = cli.defineCommands()
      const cmd = commands.find((c) => c.name === 'fix-scripts')

      expect(cmd?.args).toBeDefined()
      const packageArg = cmd?.args?.find((a) => a.name === 'package')
      const backupArg = cmd?.args?.find((a) => a.name === 'backup')

      expect(packageArg?.type).toBe('string')
      expect(backupArg?.type).toBe('boolean')
      expect(backupArg?.default).toBe(false)
    })

    it('should validate migration command args', () => {
      const commands = cli.defineCommands()
      const migratePlan = commands.find((c) => c.name === 'migrate:plan')

      expect(migratePlan?.args).toBeDefined()
      const scriptArg = migratePlan?.args?.find((a) => a.name === 'script')
      const fromArg = migratePlan?.args?.find((a) => a.name === 'from')
      const toArg = migratePlan?.args?.find((a) => a.name === 'to')

      expect(scriptArg?.required).toBe(true)
      expect(fromArg?.required).toBe(true)
      expect(toArg?.required).toBe(true)
    })

    it('should validate rollback args', () => {
      const commands = cli.defineCommands()
      const rollback = commands.find((c) => c.name === 'rollback')

      expect(rollback?.args).toBeDefined()
      const checkpointArg = rollback?.args?.find((a) => a.name === 'checkpoint')

      expect(checkpointArg?.type).toBe('string')
      expect(checkpointArg?.required).toBeFalsy() // Optional - uses last if not provided
    })
  })
})
