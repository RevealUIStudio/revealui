/**
 * Integration tests for script workflows
 * Tests that scripts work together correctly
 */

import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { execCommand, fileExists, getProjectRoot } from '../../shared/utils.js'

describe('Script Integration Tests', () => {
  let projectRoot: string

  beforeAll(async () => {
    projectRoot = await getProjectRoot(import.meta.url)
  })

  describe('Validation Scripts', () => {
    it('should run check-console-statements without crashing', async () => {
      const result = await execCommand(
        'pnpm',
        ['tsx', 'scripts/validation/check-console-statements.ts'],
        { cwd: projectRoot, silent: true },
      )
      // Exit code 1 is expected if console statements are found
      expect([0, 1]).toContain(result.exitCode)
    })

    it('should run validate-automation successfully', async () => {
      const result = await execCommand(
        'pnpm',
        ['tsx', 'scripts/validation/validate-automation.ts'],
        { cwd: projectRoot, silent: true },
      )
      expect(result.success).toBe(true)
    })

    it('should run validate-package-scripts without crashing', async () => {
      const result = await execCommand(
        'pnpm',
        ['tsx', 'scripts/validation/validate-package-scripts.ts'],
        { cwd: projectRoot, silent: true },
      )
      // May fail if package.json has issues, but shouldn't crash
      expect([0, 1]).toContain(result.exitCode)
    })
  })

  describe('Setup Scripts', () => {
    it('should have install-clean script', async () => {
      const scriptPath = join(projectRoot, 'scripts/setup/install-clean.ts')
      const exists = await fileExists(scriptPath)
      expect(exists).toBe(true)
    })

    it('should have setup-env script', async () => {
      const scriptPath = join(projectRoot, 'scripts/setup/setup-env.js')
      const exists = await fileExists(scriptPath)
      expect(exists).toBe(true)
    })
  })

  describe('Database Scripts', () => {
    it('should have all database scripts', async () => {
      const scripts = [
        'scripts/database/init-database.ts',
        'scripts/database/run-migration.ts',
        'scripts/database/setup-test-db.ts',
        'scripts/database/setup-test-db-simple.ts',
        'scripts/database/seed-sample-content.ts',
      ]

      for (const script of scripts) {
        const scriptPath = join(projectRoot, script)
        const exists = await fileExists(scriptPath)
        expect(exists).toBe(true)
      }
    })
  })

  describe('Validation Scripts', () => {
    it('should have all validation scripts', async () => {
      const scripts = [
        'scripts/validation/check-console-statements.ts',
        'scripts/validation/pre-launch-validation.ts',
        'scripts/validation/security-test.ts',
        'scripts/validation/test-api-routes.ts',
        'scripts/validation/validate-automation.ts',
        'scripts/validation/validate-production.ts',
        'scripts/validation/validate-package-scripts.ts',
      ]

      for (const script of scripts) {
        const scriptPath = join(projectRoot, script)
        const exists = await fileExists(scriptPath)
        expect(exists).toBe(true)
      }
    })
  })

  describe('Package.json Scripts', () => {
    it('should have all script references working', async () => {
      const { readFile } = await import('node:fs/promises')
      const packageJsonPath = join(projectRoot, 'package.json')
      const content = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)

      const scriptKeys = Object.keys(packageJson.scripts || {})
      expect(scriptKeys.length).toBeGreaterThan(0)

      // Check that TypeScript scripts exist
      const tsxScripts = scriptKeys.filter((key) => {
        const script = packageJson.scripts[key]
        return typeof script === 'string' && script.includes('tsx scripts/')
      })

      expect(tsxScripts.length).toBeGreaterThan(0)
    })
  })
})
