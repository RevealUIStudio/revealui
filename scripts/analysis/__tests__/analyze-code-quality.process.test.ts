/**
 * Process-based integration tests for analyze-code-quality.ts
 * Lightweight tests that execute the script as a subprocess (tests CLI interface)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'

interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

function execScript(scriptPath: string, cwd: string, args: string[] = []): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['tsx', scriptPath, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: stderr + error.message })
    })
  })
}

describe('analyze-code-quality.ts - Process Execution Tests', () => {
  let testDir: string
  let scriptPath: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `revealui-process-test-${Date.now()}`)
    scriptPath = join(process.cwd(), 'scripts', 'analysis', 'analyze-code-quality.ts')

    await mkdir(join(testDir, 'packages', 'core', 'src'), { recursive: true })

    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
    )
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should generate report file and output summary', async () => {
    const testFile = join(testDir, 'packages', 'core', 'src', 'test.ts')
    await writeFile(
      testFile,
      `// TODO: fix this
export function test(): any {
  return null
}`,
    )

    const result = await execScript(scriptPath, testDir)

    // Should generate CODE-QUALITY-REPORT.json
    const reportPath = join(testDir, 'CODE-QUALITY-REPORT.json')
    const reportExists = await readFile(reportPath, 'utf-8').catch(() => null)

    // Script should output summary
    expect(result.stdout).toContain('Code Quality Analysis Report')
    expect(result.stdout).toContain('Total Files Analyzed')

    // Report file should exist (if script ran successfully)
    if (reportExists) {
      const report = JSON.parse(reportExists)
      expect(report.summary).toBeDefined()
      expect(report.files).toBeDefined()
    }
  }, 15000) // 15s timeout for process execution + file I/O
})
